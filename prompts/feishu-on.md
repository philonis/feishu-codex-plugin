---
description: "Hand off this Codex session to Feishu"
argument-hint: "[optional note]"
---
Enable the Feishu Codex bridge for this current Codex session.

Run this command from the current workspace:

```bash
npm --prefix __PLUGIN_DIR__ run bridge -- enable --session last --cwd "$PWD"
```

Then briefly report the active session id, Feishu chat id, and whether the daemon started.

If `$ARGUMENTS` is not empty, include it as a short note in your final response after enabling:

```text
$ARGUMENTS
```
