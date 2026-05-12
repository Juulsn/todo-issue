using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;

namespace TodoIssue.Tests;

public sealed class EndToEndActionTests
{
    [Fact]
    public async Task ActionExecutableCreatesIssueFromPushEvent()
    {
        var diff = await File.ReadAllTextAsync(Fixture("add/Add.txt"));
        await using var server = new FakeGitHubServer(diff);

        var temp = Directory.CreateTempSubdirectory("todo-issue-e2e-");
        try
        {
            var eventPath = Path.Combine(temp.FullName, "event.json");
            await File.WriteAllTextAsync(eventPath, """
            {
              "before": "base",
              "head_commit": {
                "author": {
                  "username": "TestUser"
                }
              }
            }
            """);

            var result = await RunActionAsync(temp.FullName, eventPath, server.Url);

            Assert.True(result.ExitCode == 0, $"Exit code: {result.ExitCode}\nSTDOUT:\n{result.StdOut}\nSTDERR:\n{result.StdErr}");
            Assert.Contains("::notice::Creating issue with title [Create a new GITHUB issue] because of a comment", result.StdOut);

            var issueCreate = Assert.Single(server.Requests, request => request.Method == "POST" && request.Path == "/repos/Juulsn/todo-issue/issues");
            using var payload = JsonDocument.Parse(issueCreate.Body);

            Assert.Equal("Create a new GITHUB issue", payload.RootElement.GetProperty("title").GetString());
            var body = payload.RootElement.GetProperty("body").GetString() ?? "";
            Assert.True(
                body.Contains("https://github.com/Juulsn/todo-issue/blob/head/.travis.yml#L9-L14", StringComparison.Ordinal),
                body);
            Assert.Equal("todo :spiral_notepad:", payload.RootElement.GetProperty("labels")[0].GetString());
            Assert.Equal("TestUser", payload.RootElement.GetProperty("assignees")[0].GetString());

            Assert.Contains(server.Requests, request => request.Method == "GET" && request.Path == "/rate_limit");
            Assert.Contains(server.Requests, request => request.Method == "GET" && request.Path == "/repos/Juulsn/todo-issue/compare/base...head");
            Assert.Contains(server.Requests, request => request.Method == "GET" && request.Path == "/repos/Juulsn/todo-issue/issues");
            Assert.Contains(server.Requests, request => request.Method == "POST" && request.Path == "/repos/Juulsn/todo-issue/labels");
        }
        finally
        {
            temp.Delete(recursive: true);
        }
    }

    private static async Task<ProcessResult> RunActionAsync(string workspace, string eventPath, string apiUrl)
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../.."));
        var project = Path.Combine(root, "src/TodoIssue.Action/TodoIssue.Action.csproj");

        using var process = new Process();
        process.StartInfo = new ProcessStartInfo("dotnet")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = root
        };
        process.StartInfo.ArgumentList.Add("run");
        process.StartInfo.ArgumentList.Add("--project");
        process.StartInfo.ArgumentList.Add(project);
        process.StartInfo.ArgumentList.Add("--configuration");
        process.StartInfo.ArgumentList.Add("Release");
        process.StartInfo.ArgumentList.Add("--no-launch-profile");

        process.StartInfo.Environment["GITHUB_EVENT_NAME"] = "push";
        process.StartInfo.Environment["GITHUB_EVENT_PATH"] = eventPath;
        process.StartInfo.Environment["GITHUB_REPOSITORY"] = "Juulsn/todo-issue";
        process.StartInfo.Environment["GITHUB_SHA"] = "head";
        process.StartInfo.Environment["GITHUB_WORKSPACE"] = workspace;
        process.StartInfo.Environment["GITHUB_API_URL"] = apiUrl;
        process.StartInfo.Environment["GITHUB_TOKEN"] = "test-token";

        process.Start();
        var stdout = await process.StandardOutput.ReadToEndAsync();
        var stderr = await process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        return new ProcessResult(process.ExitCode, stdout, stderr);
    }

    private static string Fixture(string name) =>
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../diffs", name));

    private sealed record ProcessResult(int ExitCode, string StdOut, string StdErr);

    private sealed class FakeGitHubServer : IAsyncDisposable
    {
        private readonly HttpListener _listener = new();
        private readonly string _diff;
        private readonly CancellationTokenSource _shutdown = new();
        private readonly Task _serverTask;
        private readonly object _sync = new();
        private readonly List<RequestRecord> _requests = [];

        public FakeGitHubServer(string diff)
        {
            _diff = diff;
            Url = $"http://127.0.0.1:{GetFreePort()}/";
            _listener.Prefixes.Add(Url);
            _listener.Start();
            _serverTask = Task.Run(ServeAsync);
        }

        public string Url { get; }

        public IReadOnlyList<RequestRecord> Requests
        {
            get
            {
                lock (_sync)
                {
                    return _requests.ToList();
                }
            }
        }

        public async ValueTask DisposeAsync()
        {
            _shutdown.Cancel();
            _listener.Stop();
            try
            {
                await _serverTask;
            }
            catch (HttpListenerException)
            {
            }
            catch (ObjectDisposedException)
            {
            }

            _listener.Close();
            _shutdown.Dispose();
        }

        private async Task ServeAsync()
        {
            while (!_shutdown.IsCancellationRequested)
            {
                var context = await _listener.GetContextAsync();
                _ = Task.Run(() => HandleAsync(context), _shutdown.Token);
            }
        }

        private async Task HandleAsync(HttpListenerContext context)
        {
            var body = "";
            if (context.Request.HasEntityBody)
            {
                using var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding);
                body = await reader.ReadToEndAsync();
            }

            var path = context.Request.Url?.AbsolutePath ?? "";
            lock (_sync)
            {
                _requests.Add(new RequestRecord(context.Request.HttpMethod, path, body));
            }

            if (context.Request.HttpMethod == "GET" && path == "/rate_limit")
            {
                await JsonAsync(context, """{"rate":{"remaining":5000,"reset":4102444800}}""");
            }
            else if (context.Request.HttpMethod == "GET" && path == "/repos/Juulsn/todo-issue/compare/base...head")
            {
                await TextAsync(context, _diff, "text/plain");
            }
            else if (context.Request.HttpMethod == "GET" && path == "/repos/Juulsn/todo-issue/issues")
            {
                await JsonAsync(context, "[]");
            }
            else if (context.Request.HttpMethod == "POST" && path == "/repos/Juulsn/todo-issue/labels")
            {
                context.Response.StatusCode = 201;
                await JsonAsync(context, """{"name":"todo :spiral_notepad:"}""");
            }
            else if (context.Request.HttpMethod == "POST" && path == "/repos/Juulsn/todo-issue/issues")
            {
                context.Response.StatusCode = 201;
                await JsonAsync(context, """{"number":123}""");
            }
            else
            {
                context.Response.StatusCode = 404;
                await JsonAsync(context, $$"""{"message":"Unexpected route {{context.Request.HttpMethod}} {{path}}"}""");
            }
        }

        private static async Task JsonAsync(HttpListenerContext context, string json) =>
            await TextAsync(context, json, "application/json");

        private static async Task TextAsync(HttpListenerContext context, string text, string contentType)
        {
            var bytes = Encoding.UTF8.GetBytes(text);
            context.Response.ContentType = contentType;
            context.Response.ContentLength64 = bytes.Length;
            await context.Response.OutputStream.WriteAsync(bytes);
            context.Response.Close();
        }

        private static int GetFreePort()
        {
            using var listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            return ((IPEndPoint)listener.LocalEndpoint).Port;
        }
    }

    public sealed record RequestRecord(string Method, string Path, string Body);
}
