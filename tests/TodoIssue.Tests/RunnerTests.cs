using TodoIssue.Core;

namespace TodoIssue.Tests;

public sealed class RunnerTests
{
    [Fact]
    public async Task AddsOneTodo()
    {
        var taskSystem = await TestRunner.RunAsync("add/Add");

        Assert.Single(taskSystem.Added);
        Assert.Empty(taskSystem.References);
    }

    [Fact]
    public async Task SupportsChineseTitle()
    {
        var taskSystem = await TestRunner.RunAsync("add/AddChinese");

        Assert.Equal("你好世界", taskSystem.Added.Single().Title);
    }

    [Fact]
    public async Task KeywordListCanIncludeBug()
    {
        var taskSystem = await TestRunner.RunAsync("add/AddBUG", new AppOptions { Keywords = ["TODO", "BUG"] });

        Assert.Single(taskSystem.Added);
    }

    [Fact]
    public async Task SimilarExistingTodoGetsReference()
    {
        var taskSystem = await TestRunner.RunAsync("add/AddSecond", configure: fake =>
        {
            fake.AddExisting(new TodoItem
            {
                Type = TodoChangeType.Exists,
                Title = "should we reinvent the gear here??",
                IssueId = 2,
                Open = true
            });
        });

        Assert.Empty(taskSystem.Added);
        Assert.Single(taskSystem.References);
        Assert.Equal(2, taskSystem.References.Single().SimilarTodo?.IssueId);
    }

    [Fact]
    public async Task ClosedSimilarIssueIsReopenedAndReferenced()
    {
        var taskSystem = await TestRunner.RunAsync("add/AddSecond", configure: fake =>
        {
            fake.AddExisting(new TodoItem
            {
                Type = TodoChangeType.Exists,
                Title = "should we reinvent the gear here??",
                IssueId = 2,
                Open = false,
                Assignees = { "Juulsn" }
            });
        });

        Assert.Single(taskSystem.Reopened);
        Assert.Single(taskSystem.References);
        Assert.Contains("TestUser", taskSystem.References.Single().SimilarTodo!.Assignees);
    }

    [Fact]
    public async Task SameAddedTodosAreGrouped()
    {
        var taskSystem = await TestRunner.RunAsync("add/AddThreeSame");

        Assert.Single(taskSystem.Added);
        Assert.Equal(2, taskSystem.References.Count);
    }

    [Fact]
    public async Task DeletedTodoClosesExistingIssueWhenTitleMatches()
    {
        var taskSystem = await TestRunner.RunAsync("delete/Delete", configure: fake =>
        {
            fake.AddExisting(new TodoItem
            {
                Type = TodoChangeType.Exists,
                Title = "a totally different TODO in the next Line",
                IssueId = 2,
                Open = true
            });
        });

        Assert.Single(taskSystem.Closed);
    }

    [Fact]
    public async Task SmallRenameUpdatesExistingIssue()
    {
        var taskSystem = await TestRunner.RunAsync("rename/SmallRename", configure: fake =>
        {
            fake.AddExisting(new TodoItem
            {
                Type = TodoChangeType.Exists,
                Title = "should we reinvent the gear here??",
                IssueId = 8,
                Open = true
            });
        });

        Assert.Single(taskSystem.Updated);
        Assert.Empty(taskSystem.Closed);
    }

    [Fact]
    public async Task MoveIsIgnored()
    {
        var taskSystem = await TestRunner.RunAsync("other/MoveComment", configure: fake =>
        {
            fake.AddExisting(new TodoItem
            {
                Type = TodoChangeType.Exists,
                Title = "should we reinvent the gear here?? üäö",
                IssueId = 241,
                Open = true
            });
        });

        Assert.Empty(taskSystem.Added);
        Assert.Empty(taskSystem.Closed);
    }
}
