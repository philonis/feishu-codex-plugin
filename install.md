# Feishu Codex Plugin Installation Guide For AI Agents

This file is written for an AI agent that needs to install and configure the
Feishu Codex Plugin on a user's Mac.

The plugin is a sidecar process. It must not modify Codex Desktop, Codex CLI, or
files under `/Applications/Codex.app`.

## Repository

Clone from:

```bash
git clone git@github.com:philonis/feishu-codex-plugin.git
```

If SSH access is not configured, use HTTPS instead:

```bash
git clone https://github.com/philonis/feishu-codex-plugin.git
```

Recommended local location:

```bash
export PLUGIN_DIR="$HOME/feishu-codex-plugin"
git clone git@github.com:philonis/feishu-codex-plugin.git "$PLUGIN_DIR"
cd "$PLUGIN_DIR"
```

Do not assume any fixed local path exists on other machines. Always use the
actual checkout path as `PLUGIN_DIR`.

## What This Plugin Does

- Listens to Feishu bot messages through Feishu long-connection events.
- For normal Feishu messages, runs `codex exec resume <session-id>` locally.
- Sends the final Codex response back to the configured Feishu chat.
- Handles Feishu messages beginning with `/` locally, without calling Codex.
- Stores runtime state and logs under `~/.codex/feishu-codex-bridge/`.

The Mac remains the execution host. Feishu is only a temporary remote control
surface for one selected Codex session.

## Prerequisites

Before installation, verify:

- Codex Desktop or Codex CLI is installed and authenticated on the Mac.
- `codex` is available on `PATH`, or the absolute CLI path is known.
- Node.js and npm are installed.
- The Feishu app is an internal/self-built app.
- Feishu bot capability is enabled for the app.
- The bot has been added to the target Feishu chat.
- The target Feishu chat id is known, for example `oc_xxx`.

## Feishu App Configuration

In the Feishu developer console:

1. Enable bot capability.
2. Enable long-connection event delivery.
3. Subscribe to `im.message.receive_v1`.
4. Grant message send and receive permissions required for bot chat messages.
5. Grant message reaction permissions if the `Typing` working indicator should
   be used.
6. Publish or apply app permission changes if Feishu requires it.
7. Add the bot to the target chat.

The plugin only processes events from the chat configured as
`FEISHU_BRIDGE_CHAT_ID`.

## Install Dependencies

```bash
cd "$PLUGIN_DIR"
npm install
```

## Create `.env`

Create a local `.env` file:

```bash
cd "$PLUGIN_DIR"
cp .env.example .env
```

Fill in at least:

```env
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BRIDGE_CHAT_ID=oc_xxx
```

Recommended settings:

```env
FEISHU_BASE_URL=https://open.feishu.cn
CODEX_BRIDGE_CODEX_BIN=codex
CODEX_BRIDGE_MODEL=gpt-5.5
CODEX_BRIDGE_REASONING_EFFORT=medium
FEISHU_BRIDGE_WORKING_EMOJI=Typing
CODEX_HOME=/absolute/path/to/.codex
```

Optional defaults:

```env
CODEX_BRIDGE_SESSION_ID=last
CODEX_BRIDGE_CWD=/absolute/path/to/workspace
```

Security rules:

- Do not print `.env`.
- Do not commit `.env`.
- Do not expose `FEISHU_APP_SECRET`.
- Leave `CODEX_BRIDGE_INHERIT_OPENAI_ENV` unset unless the user explicitly wants
  the bridge to inherit custom OpenAI endpoint variables.

## Install Codex Slash Prompts

Install prompts into `$CODEX_HOME/prompts`:

```bash
cd "$PLUGIN_DIR"
npm run install:prompts
```

This installs:

- `/prompts:feishu`
- `/prompts:feishu-on`
- `/prompts:feishu-off`
- `/prompts:feishu-status`
- `/prompts:feishu-test`

Important: rerun `npm run install:prompts` after moving or renaming the checkout
directory. The installer writes the current checkout path into the installed
prompt files.

## Verify Local Setup

Check configuration and state:

```bash
cd "$PLUGIN_DIR"
npm run bridge -- status
```

Send a Feishu test message:

```bash
npm run bridge -- send-test
```

Start the daemon:

```bash
npm run bridge -- start
```

Check the daemon log:

```bash
tail -n 80 ~/.codex/feishu-codex-bridge/daemon.log
```

Expected log line:

```text
Feishu long connection ready
```

If this was only a setup test, stop the daemon:

```bash
npm run bridge -- stop
```

## Enable A Codex Session From Codex Desktop

Open the Codex Desktop session that should be reachable from Feishu. In that
Codex session, run:

```text
/prompts:feishu
```

This enables the bridge for the current workspace and latest Codex session.

Equivalent CLI command:

```bash
cd "$PLUGIN_DIR"
npm run bridge -- enable --session last --chat-id "$FEISHU_BRIDGE_CHAT_ID" --cwd "/absolute/path/to/workspace"
```

## Feishu Usage

Fast local commands. These do not call Codex:

```text
/ping
/status
/help
/off
```

Compatibility aliases:

```text
/codex ping
/codex status
/codex help
/codex off
```

Any Feishu message beginning with `/` is treated as a local bridge command and is
not forwarded to Codex.

To send work to Codex, send a normal message without a leading slash:

```text
Please continue implementing the feature and run the tests.
```

## Return To Desktop

From Codex Desktop:

```text
/prompts:feishu off
```

From Feishu:

```text
/off
```

From shell:

```bash
cd "$PLUGIN_DIR"
npm run bridge -- disable
```

## Runtime Files

State:

```text
~/.codex/feishu-codex-bridge/state.json
```

Daemon log:

```text
~/.codex/feishu-codex-bridge/daemon.log
```

Daemon pid:

```text
~/.codex/feishu-codex-bridge/daemon.pid
```

Codex resume error log:

```text
~/.codex/feishu-codex-bridge/codex-resume.log
```

## Troubleshooting

If Feishu does not receive messages:

1. Verify `.env` values.
2. Verify the bot is in the target chat.
3. Verify `FEISHU_BRIDGE_CHAT_ID` matches the target chat id.
4. Run `npm run bridge -- send-test`.
5. Inspect `~/.codex/feishu-codex-bridge/daemon.log`.

If Feishu messages do not trigger Codex:

1. Confirm the bridge is active with `npm run bridge -- status`.
2. Confirm the message does not start with `/`.
3. Confirm the daemon is running.
4. Inspect `daemon.log` for `processing Feishu message`.

If normal Feishu messages are slow:

1. Inspect `codex_ms` and `first_stdout_ms` in `daemon.log`.
2. Large values usually mean `codex exec resume` or model first-token latency is
   the bottleneck, not Feishu networking.
3. Consider `CODEX_BRIDGE_REASONING_EFFORT=medium` or `low`.
4. Use `/ping` and `/status` for quick local checks.

If Codex Desktop does not visually show Feishu-originated turns immediately:

- This plugin does not patch Codex Desktop.
- Feishu turns are persisted through `codex exec resume`.
- The visible desktop window may need to be reopened or resumed to refresh.

## Final Sanity Check

Run:

```bash
cd "$PLUGIN_DIR"
node --check src/bridge.mjs
node --check src/codex.mjs
node --check src/install-prompts.mjs
npm run bridge -- status
```

Then send `/ping` in Feishu. It should return quickly without running Codex.
