using TodoIssue.Core;

namespace TodoIssue.Tests;

internal sealed class FakeLog : IActionLog
{
    public void Debug(string message) { }
    public void Info(string message) { }
    public void Notice(string message) { }
    public void Warning(string message) { }
    public void Error(string message) { }
    public void SetFailed(string message) { }
}

internal sealed class FakeSource(string diff) : ITodoSource
{
    public Task<IReadOnlyList<FileDiff>> GetFilesAsync(CancellationToken cancellationToken) =>
        Task.FromResult(DiffParser.Parse(diff));
}

internal sealed class FakeTaskSystem : ITaskSystem
{
    private readonly List<TodoItem> _existing = [];

    public List<TodoItem> Added { get; } = [];
    public List<TodoItem> Updated { get; } = [];
    public List<TodoItem> Closed { get; } = [];
    public List<TodoItem> Reopened { get; } = [];
    public List<TodoItem> References { get; } = [];
    public List<string> Labels { get; } = [];

    public void AddExisting(TodoItem todo) => _existing.Add(todo);

    public Task CheckRateLimitAsync(bool decrease = true, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task<IReadOnlyList<TodoItem>> GetTodosAsync(IReadOnlyCollection<TodoItem> candidates, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<TodoItem>>(_existing);

    public Task EnsureLabelExistsAsync(string name, string? color = null, CancellationToken cancellationToken = default)
    {
        Labels.Add(name);
        return Task.CompletedTask;
    }

    public Task AddTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        Added.Add(todo);
        todo.IssueId = Added.Count;
        return Task.CompletedTask;
    }

    public Task UpdateTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        Updated.Add(todo);
        return Task.CompletedTask;
    }

    public Task CloseTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        Closed.Add(todo);
        return Task.CompletedTask;
    }

    public Task ReopenTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        Reopened.Add(todo);
        return Task.CompletedTask;
    }

    public Task UpdateAssigneesAsync(TodoItem todo, CancellationToken cancellationToken) => Task.CompletedTask;

    public Task AddReferenceTodoAsync(TodoItem todo, CancellationToken cancellationToken)
    {
        References.Add(todo);
        return Task.CompletedTask;
    }
}

internal static class TestRunner
{
    public static async Task<FakeTaskSystem> RunAsync(string fixture, AppOptions? options = null, Action<FakeTaskSystem>? configure = null)
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../diffs", fixture + ".txt"));
        var diff = await File.ReadAllTextAsync(path);
        var taskSystem = new FakeTaskSystem();
        configure?.Invoke(taskSystem);

        options ??= new AppOptions();
        var context = new TodoRunContext
        {
            Owner = "Juulsn",
            Repo = "todo-issue",
            Sha = "SHA",
            Workspace = Directory.GetCurrentDirectory(),
            Username = "TestUser"
        };
        var log = new FakeLog();
        var source = new FakeSource(diff);
        var extractor = new TodoExtractor(options, context, taskSystem, log);
        var matcher = new TodoMatcher(options, log);
        var runner = new TodoIssueRunner(options, source, taskSystem, extractor, matcher, log);

        var result = await runner.RunAsync("push");
        Assert.Equal(0, result);
        return taskSystem;
    }
}
