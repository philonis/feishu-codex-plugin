# Feishu Codex Plugin

Optional Feishu control plugin for using a bot chat as a temporary mobile
surface for a local Codex session.

- [English Documentation](#english-documentation)
- [中文文档](#中文文档)

## English Documentation

### Overview

The Mac remains the execution host. Feishu is only a temporary remote
input/output surface for one selected Codex session.

This project is a sidecar process. It does not patch Codex Desktop, Codex CLI,
or files under `/Applications/Codex.app`. The bridge listens to Feishu events,
runs the local `codex` CLI, and writes runtime state under
`~/.codex/feishu-codex-bridge/`.

Normal Feishu messages are forwarded with:

```bash
codex exec resume <session-id> <your-feishu-message>
```

Messages beginning with `/` are handled locally by the bridge and are never
forwarded to Codex.

For a detailed AI-agent-friendly installation guide, read `install.md`.

### Installation

Prerequisites:

- Codex Desktop or Codex CLI is installed and authenticated on the Mac.
- `codex` is available on `PATH`, or `CODEX_BRIDGE_CODEX_BIN` is set in `.env`.
- Node.js and npm are installed. Node must provide global `fetch`.
- The Feishu app is an internal/self-built app with bot capability enabled.
- The Feishu bot has been added to the target chat.
- The target chat id is known, for example `oc_xxx`.

Clone and install:

```bash
git clone git@github.com:philonis/feishu-codex-plugin.git
export PLUGIN_DIR="/absolute/path/to/feishu-codex-plugin"
cd "$PLUGIN_DIR"
npm install
```

If SSH is not configured, use HTTPS:

```bash
git clone https://github.com/philonis/feishu-codex-plugin.git
```

Do not assume any fixed local path exists on other machines. Always use the
actual checkout path.

### Feishu App Setup

In the Feishu developer console:

1. Enable bot capability.
2. Enable long-connection event delivery.
3. Subscribe to `im.message.receive_v1`.
4. Grant message send/receive permissions required for bot chat messages.
5. Grant message reaction permissions if the `Typing` working indicator should
   be used.
6. Publish or apply permission changes if Feishu requires it.
7. Add the bot to the target chat.

The bridge only handles messages from `FEISHU_BRIDGE_CHAT_ID`.

### Environment File

Create `.env` from the example. Do not commit `.env`.

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

By default, the bridge removes `OPENAI_BASE_URL` and `OPENAI_API_KEY` inherited
from Codex Desktop before running nested `codex exec resume`. Leave that
behavior unchanged unless the user explicitly wants a custom API endpoint for
bridge runs.

### Install Codex Slash Prompts

Codex custom prompts live in `$CODEX_HOME/prompts` and are invoked as
`/prompts:<name>`.

```bash
cd "$PLUGIN_DIR"
npm run install:prompts
```

The installer writes the current checkout path into installed prompt files.
Rerun it after moving or renaming the project directory.

Installed prompts:

- `/prompts:feishu`
- `/prompts:feishu-on`
- `/prompts:feishu-off`
- `/prompts:feishu-status`
- `/prompts:feishu-test`

### Verify Installation

```bash
cd "$PLUGIN_DIR"
npm run bridge -- status
npm run bridge -- send-test
npm run bridge -- start
npm run bridge -- status
tail -n 80 ~/.codex/feishu-codex-bridge/daemon.log
```

The log should include:

```text
Feishu long connection ready
```

Stop the daemon if this was only an installation test:

```bash
npm run bridge -- stop
```

### Handoff A Session

From Codex, use the installed slash prompt:

```text
/prompts:feishu
```

Equivalent explicit prompt:

```text
/prompts:feishu-on
```

Equivalent shell command:

```bash
cd "$PLUGIN_DIR"
npm run bridge -- enable \
  --session last \
  --chat-id oc_xxx \
  --cwd "/absolute/path/to/workspace"
```

The bridge writes state under `~/.codex/feishu-codex-bridge/` and starts the
daemon in the background.

### Feishu Usage

Fast local commands. These return quickly and do not call Codex:

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

Any Feishu message beginning with `/` is treated as a local bridge command and
is not forwarded to Codex.

To send work to Codex, send a normal message without a leading slash:

```text
Please continue implementing the feature and run the tests.
```

Codex responses are sent back to the same Feishu chat as Markdown card
messages. While a Feishu message is being handled, the bridge adds a `Typing`
reaction to that message and removes it after the Codex run finishes or fails.
Override the reaction with `FEISHU_BRIDGE_WORKING_EMOJI`.

### Return To Desktop

From Codex:

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

Check status:

```text
/prompts:feishu status
```

```bash
npm run status
```

### Commands

- `enable --session <id|last> --chat-id <oc_xxx> --cwd <path>`: hand off a
  session to Feishu and start the daemon.
- `disable`: turn off the active bridge.
- `status`: print active session, chat, daemon, and log paths.
- `start`: start the daemon without changing active session.
- `stop`: stop the daemon.
- `run`: run the daemon in the foreground.
- `send-test --chat-id <oc_xxx>`: send a Feishu test message.

### Runtime Files

- State: `~/.codex/feishu-codex-bridge/state.json`
- Daemon log: `~/.codex/feishu-codex-bridge/daemon.log`
- Daemon pid: `~/.codex/feishu-codex-bridge/daemon.pid`
- Codex resume error log:
  `~/.codex/feishu-codex-bridge/codex-resume.log`

### Operational Notes For AI Agents

- Do not edit Codex Desktop or Codex CLI source code for this integration.
- Do not print or commit `.env` secrets.
- Only one selected Codex session should be handed off at a time.
- Feishu messages beginning with `/` are local bridge commands and are never
  forwarded to Codex.
- Normal Feishu messages are forwarded with `codex exec resume <session-id>`.
- Desktop-originated messages are not mirrored to Feishu.
- If Feishu is slow only for normal messages, inspect `codex_ms` and
  `first_stdout_ms` in the daemon log.

### Troubleshooting

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

## 中文文档

### 概览

飞书 Codex 插件是一个可选的远程控制通道，可以把飞书机器人聊天临时用作本机
Codex 会话的移动端输入/输出界面。

Mac 仍然是实际执行主体。飞书只负责把消息转发到一个指定的 Codex 会话，并接收
该会话的回复。

本项目是一个 sidecar 进程，不修改 Codex Desktop、Codex CLI，也不修改
`/Applications/Codex.app` 下的任何文件。Bridge 会监听飞书事件，调用本机
`codex` CLI，并把运行状态写到 `~/.codex/feishu-codex-bridge/`。

普通飞书消息会通过以下方式进入指定 Codex 会话：

```bash
codex exec resume <session-id> <your-feishu-message>
```

以 `/` 开头的飞书消息会被 bridge 当成本地命令处理，永远不会转发给 Codex。

更详细、面向 AI 安装代理的安装说明见 `install.md`。

### 安装

前置条件：

- Mac 上已经安装并登录 Codex Desktop 或 Codex CLI。
- `codex` 命令可在 `PATH` 中找到，或在 `.env` 中设置 `CODEX_BRIDGE_CODEX_BIN`。
- 已安装 Node.js 和 npm，并且 Node 版本支持全局 `fetch`。
- 飞书应用是内部应用/自建应用，并已开启机器人能力。
- 飞书机器人已加入目标会话。
- 已知目标飞书会话 ID，例如 `oc_xxx`。

拉取代码并安装依赖：

```bash
git clone git@github.com:philonis/feishu-codex-plugin.git
export PLUGIN_DIR="/absolute/path/to/feishu-codex-plugin"
cd "$PLUGIN_DIR"
npm install
```

如果没有配置 SSH key，也可以使用 HTTPS：

```bash
git clone https://github.com/philonis/feishu-codex-plugin.git
```

不要假设任何固定路径存在；安装时必须使用真实 checkout 路径。

### 飞书应用配置

在飞书开发者后台中：

1. 开启机器人能力。
2. 开启长连接事件投递；本机开发不需要公网 callback URL。
3. 订阅 `im.message.receive_v1` 事件。
4. 授权机器人收发消息所需权限。
5. 如果需要工作中表情状态，授权消息 reaction 相关权限。
6. 根据飞书后台要求发布或应用权限变更。
7. 把机器人加入目标飞书会话。

Bridge 只处理来自 `FEISHU_BRIDGE_CHAT_ID` 的消息。

### 环境变量文件

从示例创建 `.env`。不要提交 `.env`。

```bash
cd "$PLUGIN_DIR"
cp .env.example .env
```

必填配置：

```env
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BRIDGE_CHAT_ID=oc_xxx
```

推荐配置：

```env
FEISHU_BASE_URL=https://open.feishu.cn
CODEX_BRIDGE_CODEX_BIN=codex
CODEX_BRIDGE_MODEL=gpt-5.5
CODEX_BRIDGE_REASONING_EFFORT=medium
FEISHU_BRIDGE_WORKING_EMOJI=Typing
CODEX_HOME=/absolute/path/to/.codex
```

可选默认值：

```env
CODEX_BRIDGE_SESSION_ID=last
CODEX_BRIDGE_CWD=/absolute/path/to/workspace
```

默认情况下，bridge 会在运行嵌套 `codex exec resume` 前移除从 Codex Desktop
继承来的 `OPENAI_BASE_URL` 和 `OPENAI_API_KEY`。除非用户明确需要自定义 API
endpoint，否则不要修改这个默认行为。

### 安装 Codex 斜杠命令

Codex 自定义 prompt 位于 `$CODEX_HOME/prompts`，调用格式是
`/prompts:<name>`。

```bash
cd "$PLUGIN_DIR"
npm run install:prompts
```

安装脚本会把当前项目路径写入已安装的 prompt 文件。如果移动或重命名项目目录，
需要重新运行 `npm run install:prompts`。

已安装的 prompts：

- `/prompts:feishu`
- `/prompts:feishu-on`
- `/prompts:feishu-off`
- `/prompts:feishu-status`
- `/prompts:feishu-test`

### 验证安装

```bash
cd "$PLUGIN_DIR"
npm run bridge -- status
npm run bridge -- send-test
npm run bridge -- start
npm run bridge -- status
tail -n 80 ~/.codex/feishu-codex-bridge/daemon.log
```

预期日志：

```text
Feishu long connection ready
```

如果只是安装测试，可以停止 daemon：

```bash
npm run bridge -- stop
```

### 接管一个 Codex 会话

在 Codex 中使用已安装的 slash prompt：

```text
/prompts:feishu
```

等价的显式命令：

```text
/prompts:feishu-on
```

等价 shell 命令：

```bash
cd "$PLUGIN_DIR"
npm run bridge -- enable \
  --session last \
  --chat-id oc_xxx \
  --cwd "/absolute/path/to/workspace"
```

Bridge 会把状态写入 `~/.codex/feishu-codex-bridge/`，并在后台启动 daemon。

### 飞书使用方法

快速本地命令。这些命令会快速返回，不会调用 Codex：

```text
/ping
/status
/help
/off
```

兼容旧写法：

```text
/codex ping
/codex status
/codex help
/codex off
```

任何以 `/` 开头的飞书消息都会被当作本地 bridge 命令，不会转发给 Codex。

如果要让 Codex 真正继续开发，请发送不以 `/` 开头的普通消息：

```text
Please continue implementing the feature and run the tests.
```

Codex 回复会以 Markdown card 消息发送回同一个飞书会话。当飞书消息正在被处理
时，bridge 会在该消息下添加 `Typing` reaction；Codex 运行完成或失败后会移除
该 reaction。可以通过 `FEISHU_BRIDGE_WORKING_EMOJI` 修改工作中表情。

### 回到桌面端

从 Codex：

```text
/prompts:feishu off
```

从飞书：

```text
/off
```

从 shell：

```bash
cd "$PLUGIN_DIR"
npm run bridge -- disable
```

检查状态：

```text
/prompts:feishu status
```

```bash
npm run status
```

### 命令

- `enable --session <id|last> --chat-id <oc_xxx> --cwd <path>`：把某个会话
  交给飞书并启动 daemon。
- `disable`：关闭当前 bridge。
- `status`：打印当前会话、飞书 chat、daemon 和日志路径。
- `start`：启动 daemon，但不改变当前接管会话。
- `stop`：停止 daemon。
- `run`：以前台模式运行 daemon。
- `send-test --chat-id <oc_xxx>`：发送一条飞书测试消息。

### 运行时文件

- 状态文件：`~/.codex/feishu-codex-bridge/state.json`
- Daemon 日志：`~/.codex/feishu-codex-bridge/daemon.log`
- Daemon pid：`~/.codex/feishu-codex-bridge/daemon.pid`
- Codex resume 错误日志：
  `~/.codex/feishu-codex-bridge/codex-resume.log`

### AI 操作注意事项

- 不要为了这个集成修改 Codex Desktop 或 Codex CLI 源码。
- 不要打印或提交 `.env` 中的密钥。
- 同一时间只应该接管一个指定的 Codex 会话。
- 以 `/` 开头的飞书消息是本地 bridge 命令，永远不会转发给 Codex。
- 普通飞书消息会通过 `codex exec resume <session-id>` 转发。
- 桌面端发起的消息不会镜像到飞书。
- 如果只有普通飞书消息很慢，请检查 daemon 日志中的 `codex_ms` 和
  `first_stdout_ms`。

### 排障

如果飞书收不到消息：

1. 检查 `.env` 配置。
2. 确认机器人已加入目标会话。
3. 确认 `FEISHU_BRIDGE_CHAT_ID` 和目标 chat id 一致。
4. 运行 `npm run bridge -- send-test`。
5. 查看 `~/.codex/feishu-codex-bridge/daemon.log`。

如果飞书消息没有触发 Codex：

1. 用 `npm run bridge -- status` 确认 bridge 已启用。
2. 确认消息不是以 `/` 开头。
3. 确认 daemon 正在运行。
4. 在 `daemon.log` 中查找 `processing Feishu message`。

如果普通飞书消息很慢：

1. 检查 `daemon.log` 里的 `codex_ms` 和 `first_stdout_ms`。
2. 如果这些值很大，通常瓶颈在 `codex exec resume` 或模型首 token，而不是飞书网络。
3. 可以考虑设置 `CODEX_BRIDGE_REASONING_EFFORT=medium` 或 `low`。
4. 使用 `/ping` 和 `/status` 做快速本地检查。

如果 Codex Desktop 没有立刻显示飞书发起的 turn：

- 本插件不会 patch Codex Desktop。
- 飞书 turn 会通过 `codex exec resume` 持久化到会话历史。
- 当前可见桌面窗口可能需要重新打开或 resume 才会刷新。
