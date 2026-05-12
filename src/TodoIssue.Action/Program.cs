using Microsoft.Extensions.DependencyInjection;
using TodoIssue.Action;
using TodoIssue.Core;

var log = new ActionLog();

try
{
    await using var provider = new ServiceCollection()
        .AddTodoIssueAction(log)
        .BuildServiceProvider(validateScopes: true);

    var github = provider.GetRequiredService<GitHubEvent>();
    var runner = provider.GetRequiredService<TodoIssueRunner>();
    return await runner.RunAsync(github.EventName);
}
catch (Exception ex)
{
    log.SetFailed(ex.ToString());
    return 1;
}
