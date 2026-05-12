using TodoIssue.Core;

namespace TodoIssue.Tests;

public sealed class HelpersTests
{
    [Fact]
    public void SimilarityMatchesExistingBehavior()
    {
        var options = new AppOptions();

        Assert.True(Helpers.IsSimilar(options, "some text!", "some text!"));
        Assert.True(Helpers.IsSimilar(options, "some text!", "some text??"));
        Assert.True(Helpers.IsSimilar(options, "Title with number 3", "Title without number 3!"));
        Assert.False(Helpers.IsSimilar(options, "some text!", "some text???"));
        Assert.False(Helpers.IsSimilar(options, "some text", "a totally different text"));
    }

    [Fact]
    public void TagsAreReadOnlyFromTheEnd()
    {
        var (title, tags) = TodoDetails.SplitTagsFromTitle("Create a new [some note] GITHUB issue [Tag]");

        Assert.Equal("Create a new [some note] GITHUB issue", title);
        Assert.Equal(["Tag"], tags);
    }

    [Fact]
    public void MentionedAssigneesCanBeStripped()
    {
        var (title, assignees) = TodoDetails.GetMentionedAssignees("Create a new GITHUB issue @Juulsn", clipMentionedFromContent: true);

        Assert.Equal("Create a new GITHUB issue", title);
        Assert.Equal(["Juulsn"], assignees);
    }

    [Fact]
    public void AssignedToTextExplainsAutoAssignment()
    {
        var context = new TodoRunContext { Owner = "Juulsn", Repo = "todo-issue", Sha = "SHA", Workspace = ".", Username = "Juulsn" };

        var text = TodoDetails.GenerateAssignedTo(new AppOptions(), context, ["Juulsn"]);

        Assert.Equal(" It's been assigned to @Juulsn because they committed the code.", text);
    }
}
