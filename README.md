# Feishu Codex Plugin

Optional Feishu control plugin for using a bot chat as a temporary mobile surface for a local Codex session.

The Mac remains the execution host. Feishu is a temporary remote input/output
surface for one selected Codex session.

## Installation

This project is a sidecar process. It must not modify Codex Desktop, Codex CLI,
or files under `/Applications/Codex.app`. It listens to Feishu events, runs the
local `codex` CLI, and writes bridge state under
`~/.codex/feishu-codex-bridge/`.

Use this section as the source of truth for another AI agent installing the
plugin on a new Mac.

### 1. Prerequisites

- Codex Desktop or Codex CLI is installed and authenticated on the Mac that will
  keep doing the work.
- `codex` is available on `PATH`, or `CODEX_BRIDGE_CODEX_BIN` is set in `.env`.
- Node.js and npm are installed. Node must be recent enough to provide global
  `fetch`.
- The Feishu app is an internal/self-built app with bot capability enabled.
- The Feishu bot has been added to the target chat.
- The target chat id is known, for example `oc_xxx`.

### 2. Project Checkout

Put this repository anywhere stable. The examples below use `PLUGIN_DIR`; replace
it with the actual checkout path.

```bash
export PLUGIN_DIR="/absolute/path/to/feishu-codex-plugin"
cd "$PLUGIN_DIR"
npm install
```

For this machine, the current checkout is:

```bash
export PLUGIN_DIR="__PLUGIN_DIR__"
```

### 3. Feishu App Setup

In the Feishu developer console for the internal app:

1. Enable bot capability.
2. Enable long-connection event delivery. This is recommended for local Mac
   development because it does not require a public callback URL.
3. Subscribe to `im.message.receive_v1`.
4. Grant the app the message send/receive permissions required by Feishu for bot
   chat messages.
5. Grant message reaction permissions if the `Typing` working indicator should
   be added and removed while Codex is running.
6. Publish or apply the app permission changes as required by the Feishu console.
7. Add the bot to the target chat.

The bridge only handles messages from the configured `FEISHU_BRIDGE_CHAT_ID`.

### 4. Environment File

Create `.env` from the example and fill it in. Do not commit `.env`; it contains
the Feishu app secret.

```bash
cd "$PLUGIN_DIR"
cp .env.example .env
```

Required values:

```env
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BRIDGE_CHAT_ID=oc_xxx
```

Recommended values:

```env
CODEX_BRIDGE_CODEX_BIN=codex
CODEX_BRIDGE_MODEL=gpt-5.5
CODEX_BRIDGE_REASONING_EFFORT=medium
FEISHU_BRIDGE_WORKING_EMOJI=Typing
CODEX_HOME=/absolute/path/to/.codex
```

`CODEX_BRIDGE_CWD` may be set as a default workspace, but the Codex slash prompt
passes the current workspace explicitly when handing off a session.

By default, the bridge removes `OPENAI_BASE_URL` and `OPENAI_API_KEY` inherited
from Codex Desktop before running nested `codex exec resume`. Leave that default
in place unless the bridge intentionally needs a custom API endpoint.

### 5. Install Codex Slash Prompts

Codex custom prompts live in `$CODEX_HOME/prompts` and are invoked as
`/prompts:<name>`. Install or refresh them from this checkout:

```bash
cd "$PLUGIN_DIR"
npm run install:prompts
```

The installer writes the current checkout path into the installed prompts, so
another AI should rerun `npm run install:prompts` after moving or renaming the
project directory.

Installed prompts:

- `/prompts:feishu`
- `/prompts:feishu-on`
- `/prompts:feishu-off`
- `/prompts:feishu-status`
- `/prompts:feishu-test`

### 6. Verify The Installation

Check that the bridge can read configuration and show state:

```bash
cd "$PLUGIN_DIR"
npm run bridge -- status
```

Send a test message to the configured Feishu chat:

```bash
npm run bridge -- send-test
```

Start the long-connection daemon without handing off a session:

```bash
npm run bridge -- start
npm run bridge -- status
tail -n 80 ~/.codex/feishu-codex-bridge/daemon.log
```

The log should eventually include `Feishu long connection ready`.

Stop the daemon if this was only an installation test:

```bash
npm run bridge -- stop
```

### 7. Handoff Smoke Test

Open a Codex Desktop session in the workspace that should be controllable from
Feishu, then run:

```text
/prompts:feishu
```

From Feishu, send:

```text
/ping
```

The bot should reply `pong` quickly. This is a local bridge command and must not
run `codex exec resume`.

Then send a normal message without a leading slash, for example:

```text
Say pong once.
```

That message should be forwarded into the selected Codex session and the final
Codex answer should be sent back to Feishu.

### 8. Operational Notes For AI Agents

- Do not edit Codex Desktop or Codex CLI source code for this integration.
- Do not print or commit `.env` secrets.
- Only one selected Codex session should be handed off at a time.
- Feishu messages beginning with `/` are local bridge commands and are never
  forwarded to Codex.
- Normal Feishu messages are forwarded with `codex exec resume <session-id>`.
- Desktop-originated messages are not mirrored to Feishu.
- Logs are in `~/.codex/feishu-codex-bridge/daemon.log`.
- Runtime state is in `~/.codex/feishu-codex-bridge/state.json`.
- If Feishu is slow only for normal messages, inspect `codex_ms` and
  `first_stdout_ms` in the daemon log; that usually means `codex exec resume` is
  waiting on model output rather than Feishu networking.

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

From Feishu, send normal messages to continue the selected Codex session. Messages that start with `/` are handled locally by the bridge and are never forwarded to Codex. For normal Feishu messages, the bridge runs:

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
/off
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

## Commands

- `enable --session <id|last> --chat-id <oc_xxx> --cwd <path>`: hand off a session to Feishu and start the daemon.
- `disable`: turn off the active bridge.
- `status`: print active session, chat, daemon, and log paths.
- `start`: start the daemon without changing active session.
- `stop`: stop the daemon.
- `run`: run the daemon in the foreground.
- `send-test --chat-id <oc_xxx>`: send a Feishu test message.

## Feishu Commands

- `/ping`: quick liveness check, answered locally without resuming Codex.
- `/status`: show current bridge status.
- `/off`: disable the bridge.
- `/help`: show Feishu-side commands.
- `/codex ping`, `/codex status`, `/codex off`, and `/codex help`: compatibility aliases.

Any message that starts with `/` is treated as a local bridge command and returns quickly. Any other text in the enabled chat is forwarded to the selected Codex session.
