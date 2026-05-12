namespace TodoIssue.Core;

public sealed class TodoRunContext
{
    public required string Owner { get; init; }
    public required string Repo { get; init; }
    public required string Sha { get; init; }
    public required string Workspace { get; init; }
    public string? Username { get; init; }
    public int? IssueNumber { get; init; }
    public string GitHubHost { get; init; } = "github.com";
}
