using System.Text.Json;
using TodoIssue.Core;

namespace TodoIssue.Action;

public sealed class GitHubEvent
{
    public required string EventName { get; init; }
    public required string Repository { get; init; }
    public required string Sha { get; init; }
    public required string Workspace { get; init; }
    public string? Before { get; init; }
    public string? Username { get; init; }
    public bool ImportAll { get; init; }
    public int? IssueNumber { get; init; }
    public string GitHubHost { get; init; } = "github.com";
    public Uri ApiUrl { get; init; } = new("https://api.github.com/");

    public string Owner => Repository.Split('/')[0];
    public string Repo => Repository.Split('/')[1];

    public TodoRunContext ToRunContext() => new()
    {
        Owner = Owner,
        Repo = Repo,
        Sha = Sha,
        Workspace = Workspace,
        Username = Username,
        IssueNumber = IssueNumber,
        GitHubHost = GitHubHost
    };

    public static GitHubEvent Read()
    {
        var eventPath = Environment.GetEnvironmentVariable("GITHUB_EVENT_PATH");
        using var document = !string.IsNullOrWhiteSpace(eventPath) && File.Exists(eventPath)
            ? JsonDocument.Parse(File.ReadAllText(eventPath))
            : JsonDocument.Parse("{}");

        var root = document.RootElement;
        var repository = Environment.GetEnvironmentVariable("GITHUB_REPOSITORY") ?? throw new InvalidOperationException("GITHUB_REPOSITORY is required.");

        return new GitHubEvent
        {
            EventName = Environment.GetEnvironmentVariable("GITHUB_EVENT_NAME") ?? "",
            Repository = repository,
            Sha = Environment.GetEnvironmentVariable("GITHUB_SHA") ?? "",
            Workspace = Environment.GetEnvironmentVariable("GITHUB_WORKSPACE") ?? Directory.GetCurrentDirectory(),
            Before = ReadString(root, "before"),
            Username = ReadString(root, "head_commit", "author", "username"),
            ImportAll = ReadString(root, "inputs", "importAll")?.Equals("true", StringComparison.OrdinalIgnoreCase) == true,
            IssueNumber = ReadInt(root, "issue", "number"),
            GitHubHost = Environment.GetEnvironmentVariable("GHE_HOST") ?? "github.com",
            ApiUrl = ReadApiUrl()
        };
    }

    private static Uri ReadApiUrl()
    {
        var apiUrl = Environment.GetEnvironmentVariable("GITHUB_API_URL");
        if (!string.IsNullOrWhiteSpace(apiUrl))
        {
            return EnsureTrailingSlash(apiUrl);
        }

        var gheHost = Environment.GetEnvironmentVariable("GHE_HOST");
        return string.IsNullOrWhiteSpace(gheHost)
            ? new Uri("https://api.github.com/")
            : EnsureTrailingSlash($"https://{gheHost}/api/v3/");
    }

    private static Uri EnsureTrailingSlash(string value) =>
        new(value.EndsWith("/", StringComparison.Ordinal) ? value : value + "/");

    private static string? ReadString(JsonElement root, params string[] path)
    {
        if (!TryGet(root, path, out var value))
        {
            return null;
        }

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Number => value.GetRawText(),
            _ => null
        };
    }

    private static int? ReadInt(JsonElement root, params string[] path) =>
        TryGet(root, path, out var value) && value.TryGetInt32(out var number) ? number : null;

    private static bool TryGet(JsonElement root, IReadOnlyList<string> path, out JsonElement value)
    {
        value = root;
        foreach (var segment in path)
        {
            if (value.ValueKind is not JsonValueKind.Object || !value.TryGetProperty(segment, out value))
            {
                return false;
            }
        }

        return true;
    }
}
