module.exports = `This issue has been reopened because the **\`{{ keyword }}\`** comment still exists in [**{{ filename }}**](https://{{ githubHost }}/{{ owner }}/{{ repo }}/blob/{{ sha }}/{{ escapedFilename }}), as of {{ sha }}.

---

###### If this was not intentional, just remove the comment from your code. You can also set the [\`reopenClosed\`](https://github.com/DerJuulsn/todo-issue#available-options) config if you don't want this to happen at all anymore.`
