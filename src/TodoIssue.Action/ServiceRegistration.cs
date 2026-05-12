using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection;
using TodoIssue.Core;

namespace TodoIssue.Action;

public static class ServiceRegistration
{
    public static IServiceCollection AddTodoIssueAction(this IServiceCollection services, IActionLog log)
    {
        services.AddSingleton(log);
        services.AddSingleton<GitHubEvent>(_ => GitHubEvent.Read());
        services.AddSingleton(sp => ActionOptions.Read(sp.GetRequiredService<GitHubEvent>()));
        services.AddSingleton(sp => sp.GetRequiredService<GitHubEvent>().ToRunContext());
        services.AddSingleton<TemplateRenderer>();
        services.AddSingleton(CreateGitHubClient);
        services.AddSingleton<GitHubApi>();
        services.AddSingleton<ITaskSystem>(sp =>
        {
            var options = sp.GetRequiredService<AppOptions>();
            if (!string.Equals(options.TaskSystem, "GitHub", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"{options.TaskSystem} can not be used at the time. You may open a Issue or PR to support this task system");
            }

            return sp.GetRequiredService<GitHubApi>();
        });
        services.AddSingleton<ITodoSource, GitTodoSource>();
        services.AddSingleton<TodoExtractor>();
        services.AddSingleton<TodoMatcher>();
        services.AddSingleton<TodoIssueRunner>();

        return services;
    }

    private static HttpClient CreateGitHubClient(IServiceProvider provider)
    {
        var github = provider.GetRequiredService<GitHubEvent>();
        var client = new HttpClient { BaseAddress = github.ApiUrl };
        client.DefaultRequestHeaders.UserAgent.ParseAdd("todo-issue-dotnet");
        client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

        var token = Environment.GetEnvironmentVariable("PRIVAT_READ_TOKEN") ?? Environment.GetEnvironmentVariable("GITHUB_TOKEN");
        if (!string.IsNullOrWhiteSpace(token))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        return client;
    }
}
