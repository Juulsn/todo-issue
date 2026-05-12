using System.Text.RegularExpressions;

namespace TodoIssue.Core;

public static partial class TodoDetails
{
    public static (int Start, int End) GetFileBoundaries(IReadOnlyList<DiffChange> changes, int line, int paddingTop = 0, int paddingBottom = 2)
    {
        var firstChangedLine = changes[0].Line;
        var lastChangedLine = changes[^1].Line;
        var start = line == firstChangedLine ? Math.Max(1, line - paddingTop) : Math.Max(line - paddingTop, firstChangedLine);
        var end = Math.Min(line + paddingBottom, lastChangedLine);
        return (start, end);
    }

    public static string? CheckForBody(AppOptions options, IReadOnlyList<DiffChange> changes, int changeIndex, string beforeTag)
    {
        var body = new List<string>();

        foreach (var change in changes.Skip(changeIndex + 1))
        {
            if (!TryReadBodyLine(options, change.Content, beforeTag, out var line))
            {
                break;
            }

            if (string.IsNullOrEmpty(line))
            {
                body.Add("\n");
                continue;
            }

            if (body.Count > 0 && body[^1] != "\n")
            {
                body.Add(" ");
            }

            body.Add(Helpers.LineBreak(line).Trim());
        }

        return body.Count == 0 ? null : string.Concat(body);
    }

    public static (string Title, IReadOnlyList<string> Tags) SplitTagsFromTitle(string title)
    {
        var tags = new List<string>();

        while (true)
        {
            var match = TagRegex().Match(title);
            if (!match.Success)
            {
                return (title, tags);
            }

            tags.Add(match.Groups[1].Value.Trim());
            title = TagRegex().Replace(title, "").TrimEnd();
        }
    }

    public static (string Content, IReadOnlyList<string> Assignees) GetMentionedAssignees(string content, bool clipMentionedFromContent)
    {
        var matches = MentionRegex().Matches(content);
        var assignees = matches.Select(match => Helpers.StripAt(match.Value)).Distinct(StringComparer.Ordinal).ToList();
        return (clipMentionedFromContent ? MentionRegex().Replace(content, "").Trim() : content, assignees);
    }

    public static string GenerateAssignedTo(AppOptions options, TodoRunContext context, IReadOnlyList<string> assignees)
    {
        if (assignees.Count == 0)
        {
            return "";
        }

        var assigner = Helpers.ReduceToList(assignees.Select(Helpers.AddAt));
        var customUsers = options.AutoAssignUsers?.Select(Helpers.StripAt).Order(StringComparer.Ordinal).ToArray();
        var sortedAssignees = assignees.Order(StringComparer.Ordinal).ToArray();

        if (customUsers is not null && customUsers.SequenceEqual(sortedAssignees))
        {
            return context.IssueNumber is not null ? $" cc {assigner}" : $" It's been automagically assigned to {assigner}.";
        }

        if (options.AutoAssignEnabled && context.Username is not null && assignees.SequenceEqual([context.Username]))
        {
            return context.IssueNumber is not null ? $" cc @{assigner}." : $" It's been assigned to {assigner} because they committed the code.";
        }

        return context.IssueNumber is not null ? $" cc {assigner}" : $" It's been assigned to {assigner} because they were mentioned in the comment.";
    }

    private static bool TryReadBodyLine(AppOptions options, string content, string beforeTag, out string body)
    {
        body = "";

        if (!content.StartsWith(beforeTag, options.CaseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var rest = content[beforeTag.Length..];
        rest = TrimNonWordStart(rest);

        if (options.BodyKeywords.Count == 0)
        {
            body = rest;
            return true;
        }

        var comparison = options.CaseSensitive ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
        foreach (var keyword in options.BodyKeywords)
        {
            if (!rest.StartsWith(keyword, comparison))
            {
                continue;
            }

            var afterKeyword = rest[keyword.Length..];
            if (afterKeyword.Length > 0 && IsWord(afterKeyword[0]))
            {
                continue;
            }

            body = TrimNonWordStart(afterKeyword);
            return true;
        }

        return false;
    }

    private static string TrimNonWordStart(string value)
    {
        var index = 0;
        while (index < value.Length && !IsWord(value[index]))
        {
            index++;
        }

        return value[index..];
    }

    private static bool IsWord(char c) => char.IsLetterOrDigit(c) || c == '_';

    [GeneratedRegex(@"\[([^\]]+)]$")]
    private static partial Regex TagRegex();

    [GeneratedRegex(@"@[a-zA-Z\d@._-]+\b")]
    private static partial Regex MentionRegex();
}
