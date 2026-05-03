---
description: "Feishu bridge quick command"
argument-hint: "on | off | status | test"
---
Handle the Feishu Codex bridge command from `$ARGUMENTS`.

Rules:

- If `$ARGUMENTS` is empty or `on`, enable the bridge by running:

```bash
npm --prefix __PLUGIN_DIR__ run bridge -- enable --session last --cwd "$PWD"
```

- If `$ARGUMENTS` is `off`, disable the bridge by running:

```bash
npm --prefix __PLUGIN_DIR__ run bridge -- disable
```

- If `$ARGUMENTS` is `status`, show status by running:

```bash
npm --prefix __PLUGIN_DIR__ run status
```

- If `$ARGUMENTS` is `test`, send a test message by running:

```bash
npm --prefix __PLUGIN_DIR__ run bridge -- send-test
```

After running the matching command, give a concise result summary. If `$ARGUMENTS` is none of these values, explain the valid forms:

```text
/prompts:feishu
/prompts:feishu on
/prompts:feishu off
/prompts:feishu status
/prompts:feishu test
```
