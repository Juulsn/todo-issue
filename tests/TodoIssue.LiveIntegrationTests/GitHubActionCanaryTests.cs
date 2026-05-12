using System.Diagnostics;
using System.Text.Json;

namespace TodoIssue.LiveIntegrationTests;

public sealed class GitHubActionCanaryTests
{
    [LiveGitHubFact]
    public async Task LocalActionCreatesIssueInPrivateCanaryRepository()
    {
        var owner = Environment.GetEnvironmentVariable("TODO_ISSUE_LIVE_GITHUB_OWNER");
        if (string.IsNullOrWhiteSpace(owner))
        {
            owner = (await RunAsync("gh", "api user --jq .login")).StdOut.Trim();
        }

        Assert.False(string.IsNullOrWhiteSpace(owner), "Could not resolve GitHub owner. Set TODO_ISSUE_LIVE_GITHUB_OWNER.");

        var repo = $"todo-issue-live-canary-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var temp = Path.Combine(Path.GetTempPath(), repo);
        var fullName = $"{owner}/{repo}";

        Directory.CreateDirectory(temp);
        try
        {
            await PrepareCanaryRepositoryAsync(temp);
            await RunCheckedAsync("git", "init -b main", temp);
            await RunCheckedAsync("git", "add .", temp);
            await RunCheckedAsync("git", "commit -m \"Initial live canary setup\"", temp);
            await RunCheckedAsync("gh", $"repo create {fullName} --private --source=. --remote=origin --push", temp);

            await PushTodoCommitAsync(temp);

            var runId = await WaitForRunAsync(fullName, "Add live canary TODO");
            await RunCheckedAsync("gh", $"run watch --repo {fullName} {runId} --exit-status");

            using var issues = JsonDocument.Parse((await RunCheckedAsync(
                "gh",
                $"issue list --repo {fullName} --state all --json number,title,state,labels,assignees,body,url")).StdOut);

            var issue = Assert.Single(issues.RootElement.EnumerateArray());
            Assert.Equal("prove the live integration test creates an issue", issue.GetProperty("title").GetString());
            Assert.Equal("OPEN", issue.GetProperty("state").GetString());
            Assert.Equal("todo :spiral_notepad:", issue.GetProperty("labels")[0].GetProperty("name").GetString());

            var body = issue.GetProperty("body").GetString() ?? "";
            Assert.Contains("/src/Widget.cs#L3-L4", body);
        }
        finally
        {
            await TryDeleteRepoAsync(fullName);
            if (Directory.Exists(temp))
            {
                Directory.Delete(temp, recursive: true);
            }
        }
    }

    private static async Task PrepareCanaryRepositoryAsync(string temp)
    {
        Directory.CreateDirectory(Path.Combine(temp, ".github/actions/todo-issue"));
        Directory.CreateDirectory(Path.Combine(temp, ".github/workflows"));
        Directory.CreateDirectory(Path.Combine(temp, "src"));

        CopyDirectory(RepoRoot(), Path.Combine(temp, ".github/actions/todo-issue"));

        await File.WriteAllTextAsync(Path.Combine(temp, ".github/workflows/todo-issue-canary.yml"), """
        name: todo-issue live canary

        on:
          push:
            branches:
              - main

        permissions:
          issues: write
          contents: read

        jobs:
          todos:
            runs-on: ubuntu-latest
            steps:
              - uses: actions/checkout@v4
              - name: Run local todo-issue action
                uses: ./.github/actions/todo-issue
                with:
                  excludePattern: '^(.github/actions/todo-issue/|.github/workflows/)'
                env:
                  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        """);

        await File.WriteAllTextAsync(Path.Combine(temp, "src/Widget.cs"), """
        public sealed class Widget
        {
            public int Count { get; init; }
        }
        """);
    }

    private static async Task PushTodoCommitAsync(string temp)
    {
        await File.WriteAllTextAsync(Path.Combine(temp, "src/Widget.cs"), """
        public sealed class Widget
        {
            // TODO prove the live integration test creates an issue
            public int Count { get; init; }
        }
        """);

        await RunCheckedAsync("git", "add src/Widget.cs", temp);
        await RunCheckedAsync("git", "commit -m \"Add live canary TODO\"", temp);
        await RunCheckedAsync("git", "push", temp);
    }

    private static async Task<string> WaitForRunAsync(string repo, string title)
    {
        for (var attempt = 0; attempt < 40; attempt++)
        {
            var result = await RunCheckedAsync("gh", $"run list --repo {repo} --limit 10 --json databaseId,displayTitle");
            using var runs = JsonDocument.Parse(result.StdOut);
            var run = runs.RootElement
                .EnumerateArray()
                .FirstOrDefault(item => string.Equals(item.GetProperty("displayTitle").GetString(), title, StringComparison.Ordinal));

            if (run.ValueKind is not JsonValueKind.Undefined)
            {
                return run.GetProperty("databaseId").GetInt64().ToString();
            }

            await Task.Delay(TimeSpan.FromSeconds(3));
        }

        throw new TimeoutException($"No GitHub Actions run appeared for [{title}] in {repo}.");
    }

    private static async Task TryDeleteRepoAsync(string repo)
    {
        var result = await RunAsync("gh", $"repo delete {repo} --yes");
        if (result.ExitCode != 0)
        {
            Console.WriteLine($"Failed to delete {repo}. You may need gh auth refresh -h github.com -s delete_repo.");
            Console.WriteLine(result.StdErr);
        }
    }

    private static async Task<ProcessResult> RunCheckedAsync(string fileName, string arguments, string? workingDirectory = null)
    {
        var result = await RunAsync(fileName, arguments, workingDirectory);
        Assert.True(result.ExitCode == 0, $"Command failed: {fileName} {arguments}\nSTDOUT:\n{result.StdOut}\nSTDERR:\n{result.StdErr}");
        return result;
    }

    private static async Task<ProcessResult> RunAsync(string fileName, string arguments, string? workingDirectory = null)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo(fileName, arguments)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = workingDirectory ?? RepoRoot()
        };

        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        return new ProcessResult(process.ExitCode, stdout, stderr);
    }

    private static string RepoRoot() =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../.."));

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);

        foreach (var directory in Directory.EnumerateDirectories(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, directory);
            if (ShouldSkip(relative))
            {
                continue;
            }

            Directory.CreateDirectory(Path.Combine(destination, relative));
        }

        foreach (var file in Directory.EnumerateFiles(source, "*", SearchOption.AllDirectories))
        {
            var relative = Path.GetRelativePath(source, file);
            if (ShouldSkip(relative))
            {
                continue;
            }

            var target = Path.Combine(destination, relative);
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            File.Copy(file, target, overwrite: true);
        }
    }

    private static bool ShouldSkip(string relativePath)
    {
        var parts = relativePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return parts.Any(part => part is ".git" or "bin" or "obj" or "TestResults" or "node_modules")
               || string.Equals(Path.GetFileName(relativePath), "Folder.DotSettings.user", StringComparison.Ordinal);
    }

    private sealed record ProcessResult(int ExitCode, string StdOut, string StdErr);
}
