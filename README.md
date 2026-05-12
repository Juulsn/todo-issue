# todo-issue

`todo-issue` is a GitHub Action that turns configured TODO-style comments into GitHub Issues.

When a pushed diff contains a configured keyword, the action creates, closes, updates, reopens, or references an issue based on how the comment changed.

```js
/**
 * TODO Should we reinvent the wheel here?
 * We already have a good one. But could it be even rounder?
 */
function getWheel() {
    // Returns you this pizza like thing
}
```

## Setup

```yml
name: Create issues from TODOs

on:
  workflow_dispatch:
    inputs:
      importAll:
        default: false
        required: false
        type: boolean
        description: Import all TODOs from the checked out branch.
  push:
    branches:
      - main
      - master

permissions:
  issues: write
  contents: read

jobs:
  todos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Issue Bot
        uses: juulsn/todo-issue@main
        with:
          excludePattern: '^(node_modules/)'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Options

| Name              | Type                        | Description                                                                                                                            | Default    |
|-------------------|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------|------------|
| `autoAssign`      | `boolean, string[], string` | Assign new issues. `true` assigns the commit author; a string or list assigns specific users; `false` disables assignment.             | `true`     |
| `keywords`        | `string[]`                  | Keywords that produce issue titles.                                                                                                    | `TODO`     |
| `bodyKeywords`    | `string[]`                  | Keywords allowed on following comment lines for issue bodies. Empty means same-prefix following comment lines become the body.         | empty      |
| `blobLines`       | `number, false`             | Number of code lines to include in the generated link range.                                                                           | `5`        |
| `blobLinesBefore` | `number`                    | Number of code lines before the TODO line to include in the generated link range.                                                       | `0`        |
| `caseSensitive`   | `boolean`                   | Match keywords case-sensitively.                                                                                                       | `true`     |
| `label`           | `boolean, string[]`         | Add labels. `true` creates/uses `todo :spiral_notepad:`, a string/list uses custom labels, and `false` disables labels.                | `true`     |
| `reopenClosed`    | `boolean`                   | Reopen a matching closed issue instead of creating a duplicate reference only.                                                          | `true`     |
| `excludePattern`  | `string`                    | Regex for files or directories to exclude.                                                                                             | empty      |
| `titleSimilarity` | `number, false`             | Similarity percentage used to merge new TODOs into existing issues or detect small title edits.                                         | `80`       |

## Labels

Add labels with square brackets at the end of a comment:

```cs
// TODO make this button red [frontend]
// this button should be red to clarify something
```

That TODO creates or references an issue with the `frontend` label.

## Import All

Run the workflow manually with `importAll: true` to import all TODOs from the checked out branch.

This cannot be undone automatically, so set `excludePattern` carefully before running it.

## Styling

- Only symbols and whitespace may appear before the keyword.
- Body lines must use the exact same prefix as the title line.

```cs
//+TODO We have to do something about this
//-there is an error at line 28
```

The second line is not included as body text because `//+` and `//-` differ.

## Development

The project is a clean .NET solution:

- `src/TodoIssue.Core` contains parsing, matching, templating, and the task-system ports.
- `src/TodoIssue.Action` contains the GitHub Action shell and GitHub REST integration.
- `tests/TodoIssue.Tests` contains behavior tests using the original diff fixtures.

Run everything with:

```bash
dotnet test TodoIssue.slnx
```
