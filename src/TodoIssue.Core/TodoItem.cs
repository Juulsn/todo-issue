namespace TodoIssue.Core;

public enum TodoChangeType
{
    Add,
    Update,
    Delete,
    AddReference,
    Exists,
    Ignore,
    Normal
}

public sealed class TodoItem
{
    public TodoChangeType Type { get; set; }
    public string Keyword { get; init; } = "";
    public string? BodyComment { get; set; }
    public string Filename { get; init; } = "";
    public string EscapedFilename { get; init; } = "";
    public string Sha { get; init; } = "";
    public int ChangedLine { get; init; }
    public string Title { get; set; } = "";
    public DiffChunk? Chunk { get; init; }
    public int ChangeIndex { get; init; }
    public List<string> Labels { get; init; } = [];
    public TodoItem? SimilarTodo { get; set; }
    public string? Username { get; init; }
    public string AssignedToString { get; set; } = "";
    public List<string> Assignees { get; init; } = [];
    public int? IssueId { get; set; }
    public bool? Open { get; set; }
    public string? Range { get; init; }
}
