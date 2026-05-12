using System.Text.RegularExpressions;

namespace TodoIssue.Core;

public sealed class FileDiff
{
    public string? ToPath { get; init; }
    public List<DiffChunk> Chunks { get; } = [];
}

public sealed class DiffChunk
{
    public List<DiffChange> Changes { get; } = [];
}

public sealed class DiffChange
{
    public required TodoChangeType Type { get; init; }
    public required string Content { get; init; }
    public int Line { get; init; }
    public int? NewLine { get; init; }
}

public static class DiffParser
{
    private static readonly Regex HunkHeader = new(@"@@ -(?<old>\d+)(?:,\d+)? \+(?<new>\d+)(?:,\d+)? @@", RegexOptions.Compiled);

    public static IReadOnlyList<FileDiff> Parse(string diff)
    {
        var files = new List<FileDiff>();
        FileDiff? file = null;
        DiffChunk? chunk = null;
        var oldLine = 0;
        var newLine = 0;

        foreach (var rawLine in diff.ReplaceLineEndings("\n").Split('\n'))
        {
            if (rawLine.StartsWith("diff --git ", StringComparison.Ordinal))
            {
                file = new FileDiff();
                files.Add(file);
                chunk = null;
                continue;
            }

            if (file is null)
            {
                continue;
            }

            if (rawLine.StartsWith("+++ ", StringComparison.Ordinal))
            {
                file = new FileDiff { ToPath = NormalizePath(rawLine[4..]) };
                files[^1] = file;
                continue;
            }

            var hunk = HunkHeader.Match(rawLine);
            if (hunk.Success)
            {
                chunk = new DiffChunk();
                file.Chunks.Add(chunk);
                oldLine = int.Parse(hunk.Groups["old"].Value);
                newLine = int.Parse(hunk.Groups["new"].Value);
                continue;
            }

            if (chunk is null || rawLine.StartsWith(@"\ No newline", StringComparison.Ordinal))
            {
                continue;
            }

            if (rawLine.StartsWith('+') && !rawLine.StartsWith("+++", StringComparison.Ordinal))
            {
                chunk.Changes.Add(new DiffChange { Type = TodoChangeType.Add, Content = rawLine[1..], Line = newLine, NewLine = newLine });
                newLine++;
                continue;
            }

            if (rawLine.StartsWith('-') && !rawLine.StartsWith("---", StringComparison.Ordinal))
            {
                chunk.Changes.Add(new DiffChange { Type = TodoChangeType.Delete, Content = rawLine[1..], Line = oldLine });
                oldLine++;
                continue;
            }

            if (rawLine.StartsWith(' '))
            {
                chunk.Changes.Add(new DiffChange { Type = TodoChangeType.Normal, Content = rawLine[1..], Line = oldLine, NewLine = newLine });
                oldLine++;
                newLine++;
            }
        }

        return files.Where(f => f.ToPath is not null).ToList();
    }

    public static FileDiff FromFile(string path, string content)
    {
        var file = new FileDiff { ToPath = path };
        var chunk = new DiffChunk();
        file.Chunks.Add(chunk);

        var line = 1;
        foreach (var text in content.ReplaceLineEndings("\n").Split('\n'))
        {
            chunk.Changes.Add(new DiffChange { Type = TodoChangeType.Add, Content = text, Line = line, NewLine = line });
            line++;
        }

        return file;
    }

    private static string? NormalizePath(string path)
    {
        var trimmed = path.Trim();
        if (trimmed is "/dev/null")
        {
            return null;
        }

        return trimmed.StartsWith("b/", StringComparison.Ordinal) ? trimmed[2..] : trimmed;
    }
}
