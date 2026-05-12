namespace TodoIssue.Core;

public sealed class TodoIssueRunner(
    AppOptions options,
    ITodoSource source,
    ITaskSystem taskSystem,
    TodoExtractor extractor,
    TodoMatcher matcher,
    IActionLog log)
{
    public async Task<int> RunAsync(string eventName, CancellationToken cancellationToken = default)
    {
        if (!CheckEventTrigger(eventName))
        {
            return 1;
        }

        if (!options.Keywords.Any())
        {
            log.SetFailed("No keywords were specified!");
            return 1;
        }

        await taskSystem.CheckRateLimitAsync(decrease: false, cancellationToken);
        log.Debug("Search for TODOs...");

        var files = await source.GetFilesAsync(cancellationToken);
        var todos = await extractor.ExtractAsync(files, cancellationToken);
        log.Debug($"{todos.Count} TODOs found");

        if (todos.Count == 0)
        {
            return 0;
        }

        var existingTodos = await taskSystem.GetTodosAsync(cancellationToken);
        log.Debug($"{existingTodos.Count} TODOs imported");

        todos = matcher.CleanUpTodos(todos, existingTodos);

        await HandleTodos(todos.Where(value => value.Type is TodoChangeType.Add), taskSystem.AddTodoAsync, cancellationToken);

        if (options.ImportAll)
        {
            return 0;
        }

        await HandleTodos(todos.Where(value => value.Type is TodoChangeType.Delete), taskSystem.CloseTodoAsync, cancellationToken);
        await HandleTodos(todos.Where(value => value.Type is TodoChangeType.Update), taskSystem.UpdateTodoAsync, cancellationToken);

        if (!options.ReopenClosed)
        {
            return 0;
        }

        var toAddReference = todos.Where(value => value.Type is TodoChangeType.AddReference).ToList();
        var toReopenIssues = toAddReference
            .Where(value => value.SimilarTodo?.Type is TodoChangeType.Exists && value.SimilarTodo.Open == false && value.SimilarTodo.IssueId.HasValue)
            .GroupBy(value => value.SimilarTodo!.IssueId)
            .Select(group => group.First())
            .ToList();

        await HandleTodos(toReopenIssues, taskSystem.ReopenTodoAsync, cancellationToken);
        await HandleTodos(toAddReference, taskSystem.AddReferenceTodoAsync, cancellationToken);
        return 0;
    }

    private bool CheckEventTrigger(string eventName)
    {
        if (options.ImportAll)
        {
            if (!string.Equals(eventName, "workflow_dispatch", StringComparison.Ordinal))
            {
                log.SetFailed("importAll can only be used on trigger workflow_dispatch");
                return false;
            }

            log.Info("Import all mode. Adding all TODOs from codebase which were not created yet");
            return true;
        }

        if (string.Equals(eventName, "push", StringComparison.Ordinal))
        {
            return true;
        }

        log.SetFailed("Action can only be used on trigger push or in manual and importAll mode");
        return false;
    }

    private async Task HandleTodos(IEnumerable<TodoItem> todos, Func<TodoItem, CancellationToken, Task> method, CancellationToken cancellationToken)
    {
        var list = todos.ToList();
        log.Debug($"Handle {list.Count} issues, {method.Method.Name}");

        foreach (var todo in list)
        {
            try
            {
                await method(todo, cancellationToken);
            }
            catch (Exception e) when (e.Message.Contains("rate limit", StringComparison.OrdinalIgnoreCase))
            {
                await taskSystem.CheckRateLimitAsync(decrease: false, cancellationToken);
                await method(todo, cancellationToken);
            }
        }
    }
}
