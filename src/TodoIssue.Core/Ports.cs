namespace TodoIssue.Core;

public interface ITodoSource
{
    Task<IReadOnlyList<FileDiff>> GetFilesAsync(CancellationToken cancellationToken);
}

public interface ITaskSystem
{
    Task CheckRateLimitAsync(bool decrease = true, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TodoItem>> GetTodosAsync(CancellationToken cancellationToken);
    Task EnsureLabelExistsAsync(string name, string? color = null, CancellationToken cancellationToken = default);
    Task AddTodoAsync(TodoItem todo, CancellationToken cancellationToken);
    Task UpdateTodoAsync(TodoItem todo, CancellationToken cancellationToken);
    Task CloseTodoAsync(TodoItem todo, CancellationToken cancellationToken);
    Task ReopenTodoAsync(TodoItem todo, CancellationToken cancellationToken);
    Task UpdateAssigneesAsync(TodoItem todo, CancellationToken cancellationToken);
    Task AddReferenceTodoAsync(TodoItem todo, CancellationToken cancellationToken);
}

public interface IActionLog
{
    void Debug(string message);
    void Info(string message);
    void Notice(string message);
    void Warning(string message);
    void Error(string message);
    void SetFailed(string message);
}
