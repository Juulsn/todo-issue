using TodoIssue.Core;

namespace TodoIssue.Action;

public sealed class ActionLog : IActionLog
{
    public void Debug(string message) => Write("debug", message);
    public void Info(string message) => Console.WriteLine(message);
    public void Notice(string message) => Write("notice", message);
    public void Warning(string message) => Write("warning", message);
    public void Error(string message) => Write("error", message);
    public void SetFailed(string message) => Write("error", message);

    private static void Write(string command, string message) =>
        Console.WriteLine($"::{command}::{message.ReplaceLineEndings("%0A")}");
}
