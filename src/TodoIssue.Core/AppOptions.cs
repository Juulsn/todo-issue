namespace TodoIssue.Core;

public sealed class AppOptions
{
    public IReadOnlyList<string> Keywords { get; init; } = ["TODO"];
    public IReadOnlyList<string> BodyKeywords { get; init; } = [];
    public bool CaseSensitive { get; init; } = true;
    public int? TitleSimilarity { get; init; } = 80;
    public bool LabelEnabled { get; init; } = true;
    public IReadOnlyList<string>? Labels { get; init; }
    public int? BlobLines { get; init; } = 5;
    public int BlobLinesBefore { get; init; }
    public bool AutoAssignEnabled { get; init; } = true;
    public IReadOnlyList<string>? AutoAssignUsers { get; init; }
    public string? ExcludePattern { get; init; }
    public string TaskSystem { get; init; } = "GitHub";
    public bool ImportAll { get; init; }
    public bool ReopenClosed { get; init; } = true;
}
