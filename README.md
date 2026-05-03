# Feishu Codex Bridge

Optional, per-session bridge for using a Feishu bot chat as a temporary mobile control surface for a local Codex session.

The Mac remains the execution host. Feishu is a temporary remote input/output
surface for one selected Codex session.

## Setup

1. Copy `.env.example` to `.env` and fill in `FEISHU_APP_ID` and `FEISHU_APP_SECRET`.
2. In the Feishu developer console, enable bot capability.
3. Subscribe to the `im.message.receive_v1` event.
4. Enable message reaction permissions if you want the remote working indicator.
5. Use long-connection event delivery for local development, so the Mac does not need a public callback URL.
6. Add the bot to the target chat.

Install dependencies:

```bash
npm install
```

The bridge defaults nested Codex CLI runs to `gpt-5.5`. Override with
`CODEX_BRIDGE_MODEL` if you want to pin a different model.

By default, Feishu-initiated turns inherit the selected Codex session's
reasoning effort. For faster remote feedback, set
`CODEX_BRIDGE_REASONING_EFFORT=medium` or `low` in `.env`.

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

Codex responses are sent back to the same Feishu chat as Markdown card
messages, so normal Markdown formatting renders in Feishu.

While a Feishu message is being handled, the bridge adds a `Typing` reaction to
that message and removes it after the Codex run finishes or fails. Override the
reaction with `FEISHU_BRIDGE_WORKING_EMOJI`.

The bridge logs per-message latency to
`~/.codex/feishu-codex-bridge/daemon.log`, including queue time, Feishu event
delivery time, Codex resume time, Feishu send time, and reaction API time.

Feishu inputs are forwarded as plain Codex user messages through
`codex exec resume`, so the selected Codex session history stays readable and
recoverable on the Mac side. Desktop-originated messages are not mirrored to
Feishu; Feishu only receives replies for prompts sent from Feishu.

Live UI refresh in an already-open Codex Desktop window depends on Codex's
app-server exposing a control socket. This bridge does not patch or replace any
Codex Desktop code, so if the desktop app is running without that socket the
Feishu turn is still persisted to the same session history, but the visible
window may need to be reopened or resumed to show it.

Incoming Feishu events are acknowledged immediately, deduped by `message_id`,
and processed serially. This avoids Feishu retrying the same message while a
long Codex turn is still running.

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
