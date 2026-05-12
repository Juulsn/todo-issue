using System.Text.RegularExpressions;

namespace TodoIssue.Core;

public static partial class Helpers
{
    public static string AddAt(string value) => value.StartsWith('@') ? value : $"@{value}";

    public static string StripAt(string value) => value.StartsWith('@') ? value[1..] : value;

    public static string ReduceToList(IEnumerable<string> values)
    {
        var list = values.ToList();
        return list.Count switch
        {
            0 => string.Empty,
            1 => list[0],
            _ => string.Join(", ", list.Take(list.Count - 1)) + $" and {list[^1]}"
        };
    }

    public static IReadOnlyList<string> AssignFlow(AppOptions options, string? author)
    {
        if (options.AutoAssignUsers is { Count: > 0 })
        {
            return options.AutoAssignUsers.Select(StripAt).ToList();
        }

        return options.AutoAssignEnabled && !string.IsNullOrWhiteSpace(author) ? [author] : [];
    }

    public static string LineBreak(string body) => HtmlBreakRegex().Replace(body, "<br>");

    public static bool IsSimilar(AppOptions options, string title0, string title1)
    {
        if (options.TitleSimilarity is not { } similarity)
        {
            return false;
        }

        var threshold = ((title0.Length + title1.Length) / 2.0) * (1 - similarity / 100.0);
        return Levenshtein(title0, title1) <= threshold;
    }

    public static int Levenshtein(string left, string right)
    {
        if (left.Length == 0)
        {
            return right.Length;
        }

        if (right.Length == 0)
        {
            return left.Length;
        }

        var previous = Enumerable.Range(0, right.Length + 1).ToArray();
        var current = new int[right.Length + 1];

        for (var i = 0; i < left.Length; i++)
        {
            current[0] = i + 1;
            for (var j = 0; j < right.Length; j++)
            {
                var cost = left[i] == right[j] ? 0 : 1;
                current[j + 1] = Math.Min(Math.Min(current[j] + 1, previous[j + 1] + 1), previous[j] + cost);
            }

            (previous, current) = (current, previous);
        }

        return previous[right.Length];
    }

    public static string EscapeFilenameForUrl(string filename) =>
        string.Join("/", filename.Split('/').Select(Uri.EscapeDataString));

    [GeneratedRegex(@"/?&lt;br(?:\s/)?&gt;")]
    private static partial Regex HtmlBreakRegex();
}
