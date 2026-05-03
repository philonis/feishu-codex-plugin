# Feishu Codex Bridge

Optional, per-session bridge for using a Feishu bot chat as a temporary mobile control surface for a local Codex session.

The Mac remains the execution host. Feishu only carries prompts, confirmations, status updates, and Codex replies.

## Setup

1. Copy `.env.example` to `.env` and fill in `FEISHU_APP_ID` and `FEISHU_APP_SECRET`.
2. In the Feishu developer console, enable bot capability.
3. Subscribe to the `im.message.receive_v1` event.
4. Use long-connection event delivery for local development, so the Mac does not need a public callback URL.
5. Add the bot to the target chat.

Install dependencies:

```bash
npm install
```

The bridge defaults nested Codex CLI runs to `gpt-5.4` because older global
Codex CLI builds may not support newer app defaults such as `gpt-5.5`. Override
with `CODEX_BRIDGE_MODEL` after upgrading your CLI.

## Handoff A Session

From Codex, use the installed slash prompt:

```text
/prompts:feishu
```

Equivalent explicit prompt:

```text
/prompts:feishu-on
```

This enables the bridge for the current workspace and the latest Codex session.

Enable the bridge for one Codex session and one Feishu chat:

```bash
npm run bridge -- enable \
  --session last \
  --chat-id oc_7256b38648813f7c0a372aa986604d17 \
  --cwd "/absolute/path/to/workspace"
```

This writes bridge state under `~/.codex/feishu-codex-bridge/` and starts the daemon in the background.

From Feishu, send normal messages to continue the selected Codex session. The bridge runs:

```bash
codex exec resume <session-id> <your-feishu-message>
```

Codex responses are sent back to the same Feishu chat.

## Return To Desktop

From Codex:

```text
/prompts:feishu off
```

Equivalent explicit prompt:

```text
/prompts:feishu-off
```

Disable bridge routing:

```bash
npm run bridge -- disable
```

You can also disable from Feishu:

```text
/codex off
```

Check status:

```text
/prompts:feishu status
```

Equivalent explicit prompt:

```text
/prompts:feishu-status
```

```bash
npm run status
```

## Install Codex Slash Prompts

Codex custom prompts live in `$CODEX_HOME/prompts` and are invoked as `/prompts:<name>`.

Install or refresh the prompts:

```bash
npm run install:prompts
```

Installed prompts:

- `/prompts:feishu`
- `/prompts:feishu-on`
- `/prompts:feishu-off`
- `/prompts:feishu-status`
- `/prompts:feishu-test`

## Commands

- `enable --session <id|last> --chat-id <oc_xxx> --cwd <path>`: hand off a session to Feishu and start the daemon.
- `disable`: turn off the active bridge.
- `status`: print active session, chat, daemon, and log paths.
- `start`: start the daemon without changing active session.
- `stop`: stop the daemon.
- `run`: run the daemon in the foreground.
- `send-test --chat-id <oc_xxx>`: send a Feishu test message.

## Feishu Commands

- `/codex status`: show current bridge status.
- `/codex off`: disable the bridge.
- `/codex help`: show Feishu-side commands.

Any other text in the enabled chat is forwarded to the selected Codex session.
