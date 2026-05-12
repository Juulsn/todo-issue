# Live Integration Tests

These tests create a private temporary GitHub repository, run the local action in GitHub Actions, assert the created issue, and delete the repository again.

They are skipped by default. Run them manually with a GitHub CLI token that has `repo`, `workflow`, and `delete_repo` scopes:

```bash
gh auth refresh -h github.com -s repo -s workflow -s delete_repo
TODO_ISSUE_RUN_LIVE_GITHUB_TESTS=true dotnet test tests/TodoIssue.LiveIntegrationTests/TodoIssue.LiveIntegrationTests.csproj
```

Set `TODO_ISSUE_LIVE_GITHUB_OWNER` to override the owner. If it is not set, the test uses the current `gh` user.
