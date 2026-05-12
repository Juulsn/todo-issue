using System.Diagnostics;
using TodoIssue.Core;

namespace TodoIssue.Action;

public sealed class GitTodoSource(AppOptions options, GitHubEvent github, GitHubApi api, IActionLog log) : ITodoSource
{
    public async Task<IReadOnlyList<FileDiff>> GetFilesAsync(CancellationToken cancellationToken)
    {
        if (options.ImportAll)
        {
            return await ImportEverythingAsync(cancellationToken);
        }

        var diff = await api.GetDiffAsync(github.Before, github.Sha, cancellationToken);
        return string.IsNullOrWhiteSpace(diff) ? [] : DiffParser.Parse(diff);
    }

    private async Task<IReadOnlyList<FileDiff>> ImportEverythingAsync(CancellationToken cancellationToken)
    {
        log.Debug("Importing all TODOs...");

        var paths = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var keyword in options.Keywords)
        {
            var args = new List<string> { "grep" };
            if (!options.CaseSensitive)
            {
                args.Add("-i");
            }

            args.AddRange(["-I", "-l", "-F", "--", keyword]);
            var output = await RunGitAsync(args, cancellationToken);
            foreach (var path in output.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                paths.Add(path);
            }
        }

        var files = new List<FileDiff>();
        foreach (var path in paths)
        {
            var fullPath = Path.Combine(github.Workspace, path);
            if (File.Exists(fullPath))
            {
                files.Add(DiffParser.FromFile(path, await File.ReadAllTextAsync(fullPath, cancellationToken)));
            }
        }

        return files;
    }

    private async Task<string> RunGitAsync(IReadOnlyList<string> arguments, CancellationToken cancellationToken)
    {
        using var process = new Process();
        process.StartInfo = new ProcessStartInfo("git")
        {
            WorkingDirectory = github.Workspace,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        foreach (var argument in arguments)
        {
            process.StartInfo.ArgumentList.Add(argument);
        }

        process.Start();
        var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        var error = await process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);

        if (process.ExitCode is not 0 and not 1)
        {
            throw new InvalidOperationException($"git {string.Join(' ', arguments)} failed: {error}");
        }

        return output;
    }
}
