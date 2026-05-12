namespace TodoIssue.Core;

public sealed class TodoMatcher(AppOptions options, IActionLog log)
{
    public List<TodoItem> CleanUpTodos(List<TodoItem> found, IReadOnlyList<TodoItem> existing)
    {
        foreach (var foundTodo in found)
        {
            var todos = existing.Where(value => foundTodo.Title == value.Title).ToList();
            if (todos.Count == 0)
            {
                continue;
            }

            if (todos.Count > 1)
            {
                log.Warning($"More than one possible issue for TODO {foundTodo.Title} in file {foundTodo.Filename} line {foundTodo.ChangedLine} found, using first.");
            }

            foundTodo.IssueId = todos[0].IssueId;
        }

        foreach (var deleted in found)
        {
            foreach (var added in found)
            {
                if (deleted.Type is not TodoChangeType.Delete || added.Type is not TodoChangeType.Add)
                {
                    continue;
                }

                if (deleted.Title == added.Title)
                {
                    deleted.Type = TodoChangeType.Ignore;
                    added.Type = TodoChangeType.Ignore;
                    continue;
                }

                if (!Helpers.IsSimilar(options, deleted.Title, added.Title))
                {
                    continue;
                }

                added.Type = TodoChangeType.Update;
                deleted.Type = TodoChangeType.Ignore;

                var existingTodo = existing.FirstOrDefault(value => value.IssueId == deleted.IssueId);
                if (existingTodo is null)
                {
                    log.Error("No matching issue found!");
                    continue;
                }

                added.IssueId = existingTodo.IssueId;
                existingTodo.Title = added.Title;
            }
        }

        foreach (var deleted in found.Where(value => value.Type is TodoChangeType.Delete))
        {
            var existingTodo = existing.FirstOrDefault(each => each.IssueId == deleted.IssueId);
            if (existingTodo is not null)
            {
                existingTodo.Open = false;
            }
        }

        found = found.Where(value => value.Type is not TodoChangeType.Ignore).ToList();

        var groups = new List<List<TodoItem>>();
        foreach (var foundTodo in found.Where(value => value.Type is TodoChangeType.Add))
        {
            groups.Add([foundTodo]);

            foreach (var group in groups)
            {
                foreach (var groupTodo in group.ToList())
                {
                    if (!group.Contains(foundTodo) && Helpers.IsSimilar(options, foundTodo.Title, groupTodo.Title))
                    {
                        group.Add(foundTodo);
                    }
                }
            }
        }

        foreach (var group0 in groups.ToList())
        {
            var group = groups.FirstOrDefault(group1 => !ReferenceEquals(group1, group0) && group1.Any(group0.Contains));
            if (group is null)
            {
                continue;
            }

            foreach (var todo in group0.Where(value => !group.Contains(value)))
            {
                group.Add(todo);
            }

            groups.Remove(group0);
        }

        foreach (var group in groups)
        {
            var parent = existing.FirstOrDefault(existingTodo => group.Any(todo => Helpers.IsSimilar(options, todo.Title, existingTodo.Title))) ?? group[0];

            if (parent.Type is TodoChangeType.Exists && parent.Open == false)
            {
                var changedTodo = found.FirstOrDefault(each => each.IssueId.HasValue && each.IssueId == parent.IssueId);
                if (changedTodo?.Type is TodoChangeType.Delete)
                {
                    changedTodo.Type = TodoChangeType.Ignore;
                    parent.Open = true;
                }
            }

            foreach (var todo in group)
            {
                if (ReferenceEquals(todo, parent))
                {
                    continue;
                }

                todo.SimilarTodo = parent;
                todo.Type = TodoChangeType.AddReference;
                foreach (var assignee in todo.Assignees.Where(assignee => !parent.Assignees.Contains(assignee, StringComparer.Ordinal)))
                {
                    parent.Assignees.Add(assignee);
                }
            }
        }

        return found;
    }
}
