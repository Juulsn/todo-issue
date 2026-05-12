using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using TodoIssue.Core;

namespace TodoIssue.Action;

public sealed class GitHubApi(GitHubEvent github, TemplateRenderer templates, IActionLog log, HttpClient client) : ITaskSystem
{
    private const int MaxTokenBatchSize = 5;
    private const int MaxSearchResultsPerQuery = 300;
    private static readonly HashSet<string> IgnoredSearchTerms = new(StringComparer.OrdinalIgnoreCase)
    {
        "about", "after", "again", "all", "also", "and", "any", "are", "because", "but", "can", "create", "data", "delete", "does",
        "error", "file", "fix", "for", "from", "get", "handle", "has", "have", "into", "issue", "make", "new", "not", "old",
        "page", "remove", "set", "should", "support", "that", "the", "this", "todo", "update", "use", "user", "when", "with", "you"
    };

    private const string IssuesQuery = """
        query($owner: String!, $repo: String!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            issues(first: 100, after: $cursor, states: [OPEN, CLOSED], orderBy: { field: CREATED_AT, direction: ASC }) {
              nodes {
                number
                title
                state
                assignees(first: 100) {
                  nodes {
                    login
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
        """;

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

    public async Task<IReadOnlyList<TodoItem>> GetTodosAsync(IReadOnlyCollection<TodoItem> candidates, CancellationToken cancellationToken)
    {
        if (candidates.Count == 0)
        {
            return [];
        }

        try
        {
            return await SearchTodosAsync(candidates, cancellationToken);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.Warning($"Issue search failed, falling back to slim issue import: {e.Message}");
            return await GetTodosSlimAsync(cancellationToken);
        }
    }

    private async Task<IReadOnlyList<TodoItem>> SearchTodosAsync(IReadOnlyCollection<TodoItem> candidates, CancellationToken cancellationToken)
    {
        var todos = new Dictionary<int, TodoItem>();

        foreach (var title in candidates.Select(todo => todo.Title).Where(title => !string.IsNullOrWhiteSpace(title)).Distinct(StringComparer.Ordinal))
        {
            var exact = CleanSearchText(title);
            if (exact.Length > 0)
            {
                await AddSearchResultsAsync(SearchQuery($"\"{exact}\""), todos, cancellationToken);
            }
        }

        var tokens = candidates
            .SelectMany(todo => SearchTokens(todo.Title))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(token => token.Length)
            .ThenBy(token => token, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (tokens.Count == 0)
        {
            return todos.Values.ToList();
        }

        foreach (var batch in tokens.Chunk(MaxTokenBatchSize))
        {
            await AddTokenSearchResultsAsync(batch, todos, cancellationToken);
        }

        return todos.Values.ToList();
    }

    private async Task AddTokenSearchResultsAsync(IReadOnlyList<string> tokens, Dictionary<int, TodoItem> todos, CancellationToken cancellationToken)
    {
        var result = await ReadSearchResultsAsync(SearchQuery("(" + string.Join(" OR ", tokens) + ")"), cancellationToken);
        if (!result.TooBroad)
        {
            AddSearchResults(result.Items, todos);
            return;
        }

        if (tokens.Count == 1)
        {
            log.Debug($"Skipping broad issue search token [{tokens[0]}] with {result.TotalCount} matches.");
            return;
        }

        foreach (var token in tokens)
        {
            await AddTokenSearchResultsAsync([token], todos, cancellationToken);
        }
    }

    private async Task AddSearchResultsAsync(string query, Dictionary<int, TodoItem> todos, CancellationToken cancellationToken)
    {
        var result = await ReadSearchResultsAsync(query, cancellationToken);
        if (result.TooBroad)
        {
            log.Debug($"Skipping broad issue search [{query}] with {result.TotalCount} matches.");
            return;
        }

        AddSearchResults(result.Items, todos);
    }

    private async Task<SearchResult> ReadSearchResultsAsync(string query, CancellationToken cancellationToken)
    {
        log.Debug($"Searching issues for [{query}]");
        using var document = await GetJsonAsync($"search/issues?q={Uri.EscapeDataString(query)}&per_page=100", cancellationToken);
        var root = document.RootElement;
        var totalCount = root.GetProperty("total_count").GetInt32();
        if (root.GetProperty("incomplete_results").GetBoolean() || totalCount > MaxSearchResultsPerQuery)
        {
            await CheckRateLimitAsync(cancellationToken: cancellationToken);
            return new SearchResult(totalCount, true, []);
        }

        var items = ParseSearchItems(root.GetProperty("items").EnumerateArray()).ToList();
        var page = 2;
        while (items.Count < totalCount)
        {
            using var pageDocument = await GetJsonAsync($"search/issues?q={Uri.EscapeDataString(query)}&per_page=100&page={page}", cancellationToken);
            var pageRoot = pageDocument.RootElement;
            if (pageRoot.GetProperty("incomplete_results").GetBoolean())
            {
                await CheckRateLimitAsync(cancellationToken: cancellationToken);
                return new SearchResult(totalCount, true, []);
            }

            items.AddRange(ParseSearchItems(pageRoot.GetProperty("items").EnumerateArray()));
            page++;
            await CheckRateLimitAsync(cancellationToken: cancellationToken);
        }

        await CheckRateLimitAsync(cancellationToken: cancellationToken);
        return new SearchResult(totalCount, false, items);
    }

    private static IEnumerable<TodoItem> ParseSearchItems(IEnumerable<JsonElement> issues)
    {
        foreach (var issue in issues)
        {
            if (issue.TryGetProperty("pull_request", out _))
            {
                continue;
            }

            yield return ParseRestIssue(issue);
        }
    }

    private static void AddSearchResults(IEnumerable<TodoItem> issues, Dictionary<int, TodoItem> todos)
    {
        foreach (var todo in issues)
        {
            todos.TryAdd(todo.IssueId!.Value, todo);
        }
    }

    private string SearchQuery(string text) =>
        $"repo:{github.Owner}/{github.Repo} is:issue in:title {text}";

    private static string CleanSearchText(string text) =>
        text.Replace('"', ' ').Trim();

    private static IEnumerable<string> SearchTokens(string title) =>
        Regex.Matches(title, @"[\p{L}\p{Nd}]+")
            .Select(match => match.Value.ToLowerInvariant())
            .Where(term => term.Length >= 3 && !IgnoredSearchTerms.Contains(term))
            .Take(6);

    private sealed record SearchResult(int TotalCount, bool TooBroad, IReadOnlyList<TodoItem> Items);

    private async Task<IReadOnlyList<TodoItem>> GetTodosSlimAsync(CancellationToken cancellationToken)
    {
        try
        {
            return await GetTodosGraphQlAsync(cancellationToken);
        }
        catch (Exception e) when (e is not OperationCanceledException)
        {
            log.Warning($"Slim issue import failed, falling back to REST issue import: {e.Message}");
            return await GetTodosRestAsync(cancellationToken);
        }
    }

    private async Task<IReadOnlyList<TodoItem>> GetTodosGraphQlAsync(CancellationToken cancellationToken)
    {
        var todos = new List<TodoItem>();
        string? cursor = null;

        while (true)
        {
            log.Debug($"Requesting issues... cursor {cursor ?? "start"}");
            using var document = await PostJsonForDocumentAsync(GraphQlUrl(), new
            {
                query = IssuesQuery,
                variables = new
                {
                    owner = github.Owner,
                    repo = github.Repo,
                    cursor
                }
            }, cancellationToken);

            var root = document.RootElement;
            if (root.TryGetProperty("errors", out var errors))
            {
                throw new InvalidOperationException(errors.ToString());
            }

            var issues = root.GetProperty("data").GetProperty("repository").GetProperty("issues");
            foreach (var issue in issues.GetProperty("nodes").EnumerateArray())
            {
                var number = issue.GetProperty("number").GetInt32();
                log.Debug($"Importing issue [#{number}]");
                todos.Add(ParseGraphQlIssue(issue));
            }

            await CheckRateLimitAsync(cancellationToken: cancellationToken);

            var pageInfo = issues.GetProperty("pageInfo");
            if (!pageInfo.GetProperty("hasNextPage").GetBoolean())
            {
                return todos;
            }

            cursor = pageInfo.GetProperty("endCursor").GetString();
        }
    }

    private async Task<IReadOnlyList<TodoItem>> GetTodosRestAsync(CancellationToken cancellationToken)
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

                var number = issue.GetProperty("number").GetInt32();
                log.Debug($"Importing issue [#{number}]");
                todos.Add(ParseRestIssue(issue));
            }

            await CheckRateLimitAsync(cancellationToken: cancellationToken);
            if (issues.Count < 100)
            {
                return todos;
            }

            page++;
        }
    }

    private static TodoItem ParseRestIssue(JsonElement issue)
    {
        return new TodoItem
        {
            Type = TodoChangeType.Exists,
            Title = issue.GetProperty("title").GetString() ?? "",
            IssueId = issue.GetProperty("number").GetInt32(),
            Open = issue.GetProperty("state").GetString() == "open",
            Assignees = issue.GetProperty("assignees").EnumerateArray()
                .Select(assignee => assignee.GetProperty("login").GetString())
                .Where(login => !string.IsNullOrWhiteSpace(login))
                .Select(login => login!)
                .ToList()
        };
    }

    private static TodoItem ParseGraphQlIssue(JsonElement issue)
    {
        return new TodoItem
        {
            Type = TodoChangeType.Exists,
            Title = issue.GetProperty("title").GetString() ?? "",
            IssueId = issue.GetProperty("number").GetInt32(),
            Open = issue.GetProperty("state").GetString() == "OPEN",
            Assignees = issue.GetProperty("assignees").GetProperty("nodes").EnumerateArray()
                .Select(assignee => assignee.GetProperty("login").GetString())
                .Where(login => !string.IsNullOrWhiteSpace(login))
                .Select(login => login!)
                .ToList()
        };
    }

    private Uri GraphQlUrl()
    {
        var builder = new UriBuilder(github.ApiUrl) { Query = "" };
        var path = builder.Path.TrimEnd('/');
        builder.Path = path.EndsWith("/api/v3", StringComparison.OrdinalIgnoreCase)
            ? path[..^"/api/v3".Length] + "/api/graphql"
            : "/graphql";
        return builder.Uri;
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

    private async Task<JsonDocument> PostJsonForDocumentAsync(Uri url, object payload, CancellationToken cancellationToken)
    {
        using var response = await PostJsonAsync(url, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
        return JsonDocument.Parse(await response.Content.ReadAsStreamAsync(cancellationToken));
    }

    private Task<HttpResponseMessage> PostJsonAsync(string url, object payload, CancellationToken cancellationToken) =>
        client.PostAsync(url, Json(payload), cancellationToken);

    private Task<HttpResponseMessage> PostJsonAsync(Uri url, object payload, CancellationToken cancellationToken) =>
        client.PostAsync(url, Json(payload), cancellationToken);

    private Task<HttpResponseMessage> PatchJsonAsync(string url, object payload, CancellationToken cancellationToken) =>
        client.PatchAsync(url, Json(payload), cancellationToken);

    private static StringContent Json(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
}
