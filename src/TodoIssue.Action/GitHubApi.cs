using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using TodoIssue.Core;

namespace TodoIssue.Action;

public sealed class GitHubApi(GitHubEvent github, TemplateRenderer templates, IActionLog log, HttpClient client) : ITaskSystem
{
    private readonly HashSet<string> _existingLabels = new(StringComparer.Ordinal);
    private int _rateLimit;

    public async Task<string?> GetDiffAsync(string? before, string sha, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(before) || string.IsNullOrWhiteSpace(sha))
        {
            return null;
        }

        if (before.All(c => c == '0'))
        {
            log.Debug("Skipping diff lookup for initial push without a comparable base commit.");
            return null;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"repos/{github.Owner}/{github.Repo}/compare/{before}...{sha}");
        request.Headers.Accept.Clear();
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/vnd.github.diff"));

        var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            log.Error("Diff file might be too big");
            log.Error(await response.Content.ReadAsStringAsync(cancellationToken));
            return null;
        }

        return await response.Content.ReadAsStringAsync(cancellationToken);
    }

    public async Task CheckRateLimitAsync(bool decrease = true, CancellationToken cancellationToken = default)
    {
        if (_rateLimit == 0)
        {
            using var document = await GetJsonAsync("rate_limit", cancellationToken);
            var rate = document.RootElement.GetProperty("rate");
            _rateLimit = rate.GetProperty("remaining").GetInt32();

            if (_rateLimit == 0)
            {
                var reset = DateTimeOffset.FromUnixTimeSeconds(rate.GetProperty("reset").GetInt64());
                var delay = reset - DateTimeOffset.UtcNow;
                if (delay > TimeSpan.Zero)
                {
                    log.Debug($"Waiting {delay.TotalSeconds} seconds because of githubs api rate limit");
                    await Task.Delay(delay, cancellationToken);
                }
            }
        }

        if (decrease)
        {
            _rateLimit--;
        }
    }

    public async Task<IReadOnlyList<TodoItem>> GetTodosAsync(CancellationToken cancellationToken)
    {
        var todos = new List<TodoItem>();
        var page = 1;

        while (true)
        {
            log.Debug($"Requesting issues... page {page}");
            using var document = await GetJsonAsync($"repos/{github.Owner}/{github.Repo}/issues?state=all&per_page=100&page={page}", cancellationToken);
            var issues = document.RootElement.EnumerateArray().ToList();

            foreach (var issue in issues)
            {
                if (issue.TryGetProperty("pull_request", out _))
                {
                    continue;
                }

                var title = issue.GetProperty("title").GetString() ?? "";
                var number = issue.GetProperty("number").GetInt32();
                log.Debug($"Importing issue [#{number}]");

                todos.Add(new TodoItem
                {
                    Type = TodoChangeType.Exists,
                    Title = title,
                    IssueId = number,
                    Open = issue.GetProperty("state").GetString() == "open",
                    Assignees = issue.GetProperty("assignees").EnumerateArray()
                        .Select(assignee => assignee.GetProperty("login").GetString())
                        .Where(login => !string.IsNullOrWhiteSpace(login))
                        .Select(login => login!)
                        .ToList()
                });
            }

            await CheckRateLimitAsync(cancellationToken: cancellationToken);
            if (issues.Count < 100)
            {
                return todos;
            }

            page++;
        }
    }

    public async Task EnsureLabelExistsAsync(string name, string? color = null, CancellationToken cancellationToken = default)
    {
        if (!_existingLabels.Add(name))
        {
            return;
        }

        object payload = color is null ? new { name } : new { name, color };
        using var response = await PostJsonAsync($"repos/{github.Owner}/{github.Repo}/labels", payload, cancellationToken);
        if (!response.IsSuccessStatusCode && response.StatusCode != System.Net.HttpStatusCode.UnprocessableEntity)
        {
            response.EnsureSuccessStatusCode();
        }
    }

    public async Task AddTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        log.Notice($"Creating issue with title [{todo.Title}] because of a comment");
        using var document = await PostJsonForDocumentAsync($"repos/{github.Owner}/{github.Repo}/issues", new
        {
            title = todo.Title,
            body = templates.Issue(todo),
            labels = todo.Labels,
            assignees = todo.Assignees
        }, cancellationToken);

        todo.IssueId = document.RootElement.GetProperty("number").GetInt32();
        await CheckRateLimitAsync(cancellationToken: cancellationToken);
        log.Debug($"Issue [{todo.Title}] got ID {todo.IssueId}");
    }

    public async Task UpdateTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        if (todo.IssueId is null)
        {
            log.Error($"Can't update issue [{todo.Title}]! No issueId found");
            return;
        }

        log.Notice($"Updating issue #{todo.IssueId} because the title were changed");
        using var _ = await PatchJsonAsync($"repos/{github.Owner}/{github.Repo}/issues/{todo.IssueId}", new { title = todo.Title }, cancellationToken);
        await CheckRateLimitAsync(cancellationToken: cancellationToken);
    }

    public async Task CloseTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        if (todo.IssueId is null)
        {
            log.Error($"Can't close issue [{todo.Title}]! No issueId found");
            return;
        }

        log.Notice($"Closing issue #{todo.IssueId} because a comment with the title [{todo.Title}] were removed");
        using var comment = await PostJsonAsync($"repos/{github.Owner}/{github.Repo}/issues/{todo.IssueId}/comments", new { body = templates.Close(todo) }, cancellationToken);
        comment.EnsureSuccessStatusCode();
        await CheckRateLimitAsync(cancellationToken: cancellationToken);

        using var update = await PatchJsonAsync($"repos/{github.Owner}/{github.Repo}/issues/{todo.IssueId}", new { state = "closed" }, cancellationToken);
        update.EnsureSuccessStatusCode();
        await CheckRateLimitAsync(cancellationToken: cancellationToken);
    }

    public async Task ReopenTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        if (todo.IssueId is null)
        {
            log.Error($"Can't reopen issue [{todo.Title}]! No issueId found");
            return;
        }

        log.Notice($"Reopening issue #{todo.IssueId} because there is a new issue with the same or a similar name");
        using var update = await PatchJsonAsync($"repos/{github.Owner}/{github.Repo}/issues/{todo.IssueId}", new { state = "open" }, cancellationToken);
        update.EnsureSuccessStatusCode();
        await CheckRateLimitAsync(cancellationToken: cancellationToken);
    }

    public async Task UpdateAssigneesAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        if (todo.Assignees.Count == 0 || todo.IssueId is null)
        {
            return;
        }

        using var update = await PatchJsonAsync($"repos/{github.Owner}/{github.Repo}/issues/{todo.IssueId}", new { assignees = todo.Assignees }, cancellationToken);
        update.EnsureSuccessStatusCode();
        await CheckRateLimitAsync(cancellationToken: cancellationToken);
    }

    public async Task AddReferenceTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        if (todo.SimilarTodo?.IssueId is null)
        {
            log.Error($"Can't add reference for [{todo.Title}] to issue [{todo.SimilarTodo?.Title}]. No issueId found");
            return;
        }

        log.Notice($"Adding a reference to the issue #{todo.SimilarTodo.IssueId} with title [{todo.SimilarTodo.Title}] because it is similar to a the new issue [{todo.Title}]");
        using var comment = await PostJsonAsync($"repos/{github.Owner}/{github.Repo}/issues/{todo.SimilarTodo.IssueId}/comments", new { body = templates.Comment(todo) }, cancellationToken);
        comment.EnsureSuccessStatusCode();
        await CheckRateLimitAsync(cancellationToken: cancellationToken);
        await UpdateAssigneesAsync(todo.SimilarTodo, cancellationToken);
    }

    private async Task<JsonDocument> GetJsonAsync(string url, CancellationToken cancellationToken)
    {
        using var response = await client.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    private async Task<JsonDocument> PostJsonForDocumentAsync(string url, object payload, CancellationToken cancellationToken)
    {
        using var response = await PostJsonAsync(url, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    private Task<HttpResponseMessage> PostJsonAsync(string url, object payload, CancellationToken cancellationToken) =>
        client.PostAsync(url, Json(payload), cancellationToken);

    private Task<HttpResponseMessage> PatchJsonAsync(string url, object payload, CancellationToken cancellationToken) =>
        client.PatchAsync(url, Json(payload), cancellationToken);

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
}
