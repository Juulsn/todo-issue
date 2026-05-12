namespace TodoIssue.LiveIntegrationTests;

public sealed class LiveGitHubFactAttribute : FactAttribute
{
    public LiveGitHubFactAttribute()
    {
        if (!string.Equals(Environment.GetEnvironmentVariable("TODO_ISSUE_RUN_LIVE_GITHUB_TESTS"), "true", StringComparison.OrdinalIgnoreCase))
        {
            Skip = "Set TODO_ISSUE_RUN_LIVE_GITHUB_TESTS=true to run live GitHub integration tests.";
        }
    }
}
