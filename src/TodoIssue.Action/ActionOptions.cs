using TodoIssue.Core;

namespace TodoIssue.Action;

public static class ActionOptions
{
    public static AppOptions Read(GitHubEvent github)
    {
        return new AppOptions
        {
            Keywords = ReadArray("keywords", ["TODO"]),
            BodyKeywords = ReadArray("bodyKeywords", []),
            CaseSensitive = ReadBool("caseSensitive", true),
            TitleSimilarity = ReadDisableableInt("titleSimilarity", 80),
            LabelEnabled = !IsDisabled("label"),
            Labels = ReadBoolOrArray("label", defaultBool: true).Values,
            BlobLines = ReadDisableableInt("blobLines", 5),
            BlobLinesBefore = ReadInt("blobLinesBefore", 0),
            AutoAssignEnabled = !IsDisabled("autoAssign"),
            AutoAssignUsers = ReadBoolOrArray("autoAssign", defaultBool: true).Values,
            ExcludePattern = ReadString("excludePattern"),
            TaskSystem = ReadString("taskSystem") ?? "GitHub",
            ImportAll = github.ImportAll,
            ReopenClosed = ReadBool("reopenClosed", true)
        };
    }

    private static string? ReadString(string name)
    {
        var value = Environment.GetEnvironmentVariable("INPUT_" + name.ToUpperInvariant());
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static int ReadInt(string name, int fallback) =>
        int.TryParse(ReadString(name), out var value) ? value : fallback;

    private static bool ReadBool(string name, bool fallback)
    {
        var value = ReadString(name);
        return value is null ? fallback : value.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    private static int? ReadDisableableInt(string name, int fallback)
    {
        var value = ReadString(name);
        if (value is null)
        {
            return fallback;
        }

        return IsDisabledValue(value) ? null : int.Parse(value);
    }

    private static IReadOnlyList<string> ReadArray(string name, IReadOnlyList<string> fallback)
    {
        var value = ReadString(name);
        return value is null ? fallback : Split(value);
    }

    private static BoolOrArray ReadBoolOrArray(string name, bool defaultBool)
    {
        var value = ReadString(name);
        if (value is null)
        {
            return new BoolOrArray(defaultBool, null);
        }

        if (bool.TryParse(value, out var boolValue))
        {
            return new BoolOrArray(boolValue, null);
        }

        return new BoolOrArray(true, Split(value));
    }

    private static bool IsDisabled(string name)
    {
        var value = ReadString(name);
        return value is not null && IsDisabledValue(value);
    }

    private static bool IsDisabledValue(string value) =>
        value.Equals("false", StringComparison.OrdinalIgnoreCase) ||
        value.Equals("off", StringComparison.OrdinalIgnoreCase) ||
        value.Equals("0", StringComparison.OrdinalIgnoreCase);

    private static IReadOnlyList<string> Split(string value) =>
        value.Split([',', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private sealed record BoolOrArray(bool Enabled, IReadOnlyList<string>? Values);
}
