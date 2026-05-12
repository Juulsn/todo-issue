using System.Text.RegularExpressions;

namespace TodoIssue.Core;

public sealed class TodoExtractor(AppOptions options, TodoRunContext context, ITaskSystem taskSystem, IActionLog log)
{
    public async Task<List<TodoItem>> ExtractAsync(IReadOnlyList<FileDiff> files, CancellationToken cancellationToken)
    {
        var todos = new List<TodoItem>();
        var regex = CreateTodoRegex();

        foreach (var file in files)
        {
            if (string.IsNullOrWhiteSpace(file.ToPath) || ShouldExcludeFile(file.ToPath))
            {
                continue;
            }

            foreach (var chunk in file.Chunks)
            {
                for (var index = 0; index < chunk.Changes.Count; index++)
                {
                    var change = chunk.Changes[index];
                    if (change.Type is TodoChangeType.Normal)
                    {
                        continue;
                    }

                    var match = regex.Match(change.Content);
                    if (!match.Success)
                    {
                        continue;
                    }

                    var title = match.Groups["title"].Value.Trim();
                    if (string.IsNullOrEmpty(title))
                    {
                        continue;
                    }

                    var body = TodoDetails.CheckForBody(options, chunk.Changes, index, match.Groups["beforeTag"].Value);
                    var (newTitle, tags) = TodoDetails.SplitTagsFromTitle(title);
                    title = newTitle;

                    var details = GetDetails(chunk, change.Line);
                    var labels = await GetLabelsAsync(tags, cancellationToken);

                    var (titleWithoutAssignees, titleAssignees) = TodoDetails.GetMentionedAssignees(title, clipMentionedFromContent: true);
                    title = titleWithoutAssignees;
                    AddMissing(details.Assignees, titleAssignees);

                    if (!string.IsNullOrEmpty(body))
                    {
                        var (_, bodyAssignees) = TodoDetails.GetMentionedAssignees(body, clipMentionedFromContent: false);
                        AddMissing(details.Assignees, bodyAssignees);
                    }

                    if (title.Length > 256)
                    {
                        var wholeTitle = title + "<br><br>";
                        body = string.IsNullOrEmpty(body) ? wholeTitle : wholeTitle + body;
                        title = title[..100] + "...";
                    }

                    todos.Add(new TodoItem
                    {
                        Type = change.Type,
                        Keyword = match.Groups["keyword"].Value,
                        Filename = file.ToPath,
                        EscapedFilename = Helpers.EscapeFilenameForUrl(file.ToPath),
                        Sha = context.Sha,
                        BodyComment = body,
                        ChangedLine = change.Line,
                        Title = title,
                        Chunk = chunk,
                        ChangeIndex = index,
                        Labels = labels.ToList(),
                        Username = details.Username,
                        AssignedToString = TodoDetails.GenerateAssignedTo(options, context, details.Assignees),
                        Assignees = details.Assignees,
                        Range = details.Range
                    });

                    log.Debug($"Item found [{title}]");
                }
            }
        }

        return todos;
    }

    private Regex CreateTodoRegex()
    {
        var keywords = string.Join('|', options.Keywords.Select(Regex.Escape));
        var flags = RegexOptions.Compiled | RegexOptions.CultureInvariant;
        if (!options.CaseSensitive)
        {
            flags |= RegexOptions.IgnoreCase;
        }

        return new Regex($@"^(?<beforeTag>\W+)(?<keyword>{keywords})\b\S*(?<title>(?:(?!-->).)+)", flags);
    }

    private (string? Username, string? Range, List<string> Assignees) GetDetails(DiffChunk chunk, int line)
    {
        string? range = null;
        if (options.BlobLines is { } blobLines)
        {
            var (start, end) = TodoDetails.GetFileBoundaries(chunk.Changes, line, options.BlobLinesBefore, blobLines);
            range = start == end ? $"L{start}" : $"L{start}-L{end}";
        }

        return (context.Username, range, Helpers.AssignFlow(options, context.Username).ToList());
    }

    private async Task<IReadOnlyList<string>> GetLabelsAsync(IReadOnlyList<string> tags, CancellationToken cancellationToken)
    {
        if (tags.Count > 0)
        {
            foreach (var tag in tags)
            {
                await taskSystem.EnsureLabelExistsAsync(tag, cancellationToken: cancellationToken);
            }

            return tags;
        }

        if (!options.LabelEnabled)
        {
            return [];
        }

        if (options.Labels is { Count: > 0 })
        {
            foreach (var label in options.Labels)
            {
                await taskSystem.EnsureLabelExistsAsync(label, cancellationToken: cancellationToken);
            }

            return options.Labels;
        }

        await taskSystem.EnsureLabelExistsAsync("todo :spiral_notepad:", "00B0D8", cancellationToken);
        return ["todo :spiral_notepad:"];
    }

    private bool ShouldExcludeFile(string fileName)
    {
        if (fileName.StartsWith(".github", StringComparison.Ordinal) && fileName.EndsWith(".yml", StringComparison.Ordinal))
        {
            log.Debug($"Skipping {fileName} as it is a .yml file in the .github folder");
            return true;
        }

        if (fileName.Contains(".min.", StringComparison.Ordinal))
        {
            log.Debug($"Skipping {fileName} as it matches the alwaysExclude pattern");
            return true;
        }

        if (!string.IsNullOrWhiteSpace(options.ExcludePattern) && Regex.IsMatch(fileName, options.ExcludePattern))
        {
            log.Debug($"Skipping {fileName} as it matches the exclude pattern {options.ExcludePattern}");
            return true;
        }

        return false;
    }

    private static void AddMissing(List<string> target, IEnumerable<string> values)
    {
        foreach (var value in values.Where(value => !target.Contains(value, StringComparer.Ordinal)))
        {
            target.Add(value);
        }
    }
}
