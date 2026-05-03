# Feishu Codex Plugin / 飞书 Codex 插件

Optional Feishu control plugin for using a bot chat as a temporary mobile
surface for a local Codex session.

飞书 Codex 插件是一个可选的远程控制通道，可以把飞书机器人聊天临时用作本机
Codex 会话的移动端输入/输出界面。

The Mac remains the execution host. Feishu is only a temporary remote
input/output surface for one selected Codex session.

Mac 仍然是实际执行主体。飞书只负责把消息转发到一个指定的 Codex 会话，并接收
该会话的回复。

## Architecture / 架构说明

This project is a sidecar process. It does not patch Codex Desktop, Codex CLI,
or files under `/Applications/Codex.app`.

本项目是一个 sidecar 进程，不修改 Codex Desktop、Codex CLI，也不修改
`/Applications/Codex.app` 下的任何文件。

The bridge listens to Feishu events, runs the local `codex` CLI, and writes
runtime state under `~/.codex/feishu-codex-bridge/`.

Bridge 会监听飞书事件，调用本机 `codex` CLI，并把运行状态写到
`~/.codex/feishu-codex-bridge/`。

Normal Feishu messages are forwarded with:

普通飞书消息会通过以下方式进入指定 Codex 会话：

```bash
codex exec resume <session-id> <your-feishu-message>
```

Messages beginning with `/` are handled locally by the bridge and are never
forwarded to Codex.

以 `/` 开头的飞书消息会被 bridge 当成本地命令处理，永远不会转发给 Codex 模型。

## Installation / 安装

Use `install.md` as the detailed, AI-agent-friendly installation guide.

详细安装流程请优先阅读 `install.md`；该文件专门写给其他 AI 安装代理使用。

### 1. Prerequisites / 前置条件

- Codex Desktop or Codex CLI is installed and authenticated on the Mac.
- Mac 上已经安装并登录 Codex Desktop 或 Codex CLI。
- `codex` is available on `PATH`, or `CODEX_BRIDGE_CODEX_BIN` is set in `.env`.
- `codex` 命令可在 `PATH` 中找到，或在 `.env` 中设置 `CODEX_BRIDGE_CODEX_BIN`。
- Node.js and npm are installed. Node must provide global `fetch`.
- 已安装 Node.js 和 npm，并且 Node 版本支持全局 `fetch`。
- The Feishu app is an internal/self-built app with bot capability enabled.
- 飞书应用是内部应用/自建应用，并已开启机器人能力。
- The Feishu bot has been added to the target chat.
- 飞书机器人已加入目标会话。
- The target chat id is known, for example `oc_xxx`.
- 已知目标飞书会话 ID，例如 `oc_xxx`。

### 2. Clone And Install / 拉取代码并安装依赖

Clone from GitHub:

从 GitHub 拉取代码：

```bash
git clone git@github.com:philonis/feishu-codex-plugin.git
```

If SSH is not configured, use HTTPS:

如果没有配置 SSH key，也可以使用 HTTPS：

```bash
git clone https://github.com/philonis/feishu-codex-plugin.git
```

Install dependencies:

安装依赖：

```bash
export PLUGIN_DIR="/absolute/path/to/feishu-codex-plugin"
cd "$PLUGIN_DIR"
npm install
```

Do not assume that path exists on other machines. Always use the actual checkout
path.

不要假设任何固定路径存在；安装时必须使用真实 checkout 路径。

### 3. Feishu App Setup / 飞书应用配置

In the Feishu developer console:

在飞书开发者后台中：

1. Enable bot capability.
2. 开启机器人能力。
3. Enable long-connection event delivery.
4. 开启长连接事件投递；本机开发不需要公网 callback URL。
5. Subscribe to `im.message.receive_v1`.
6. 订阅 `im.message.receive_v1` 事件。
7. Grant message send/receive permissions required for bot chat messages.
8. 授权机器人收发消息所需权限。
9. Grant message reaction permissions if the `Typing` working indicator should
   be used.
10. 如果需要工作中表情状态，授权消息 reaction 相关权限。
11. Publish or apply permission changes if Feishu requires it.
12. 根据飞书后台要求发布或应用权限变更。
13. Add the bot to the target chat.
14. 把机器人加入目标飞书会话。

The bridge only handles messages from `FEISHU_BRIDGE_CHAT_ID`.

Bridge 只处理来自 `FEISHU_BRIDGE_CHAT_ID` 的消息。

### 4. Environment File / 环境变量文件

Create `.env` from the example. Do not commit `.env`.

从示例创建 `.env`。不要提交 `.env`。

```bash
cd "$PLUGIN_DIR"
cp .env.example .env
```

Required values:

必填配置：

```env
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BRIDGE_CHAT_ID=oc_xxx
```

Recommended values:

推荐配置：

```env
FEISHU_BASE_URL=https://open.feishu.cn
CODEX_BRIDGE_CODEX_BIN=codex
CODEX_BRIDGE_MODEL=gpt-5.5
CODEX_BRIDGE_REASONING_EFFORT=medium
FEISHU_BRIDGE_WORKING_EMOJI=Typing
CODEX_HOME=/absolute/path/to/.codex
```

Optional defaults:

可选默认值：

```env
CODEX_BRIDGE_SESSION_ID=last
CODEX_BRIDGE_CWD=/absolute/path/to/workspace
```

By default, the bridge removes `OPENAI_BASE_URL` and `OPENAI_API_KEY` inherited
from Codex Desktop before running nested `codex exec resume`.

默认情况下，bridge 会在运行嵌套 `codex exec resume` 前移除从 Codex Desktop
继承来的 `OPENAI_BASE_URL` 和 `OPENAI_API_KEY`。

Leave that behavior unchanged unless the user explicitly wants a custom API
endpoint for bridge runs.

除非用户明确需要自定义 API endpoint，否则不要修改这个默认行为。

### 5. Install Codex Slash Prompts / 安装 Codex 斜杠命令

Codex custom prompts live in `$CODEX_HOME/prompts` and are invoked as
`/prompts:<name>`.

Codex 自定义 prompt 位于 `$CODEX_HOME/prompts`，调用格式是
`/prompts:<name>`。

Install or refresh prompts:

安装或刷新 prompts：

```bash
cd "$PLUGIN_DIR"
npm run install:prompts
```

The installer writes the current checkout path into installed prompt files.
Rerun it after moving or renaming the project directory.

安装脚本会把当前项目路径写入已安装的 prompt 文件。如果移动或重命名项目目录，
需要重新运行 `npm run install:prompts`。

Installed prompts:

已安装的 prompts：

- `/prompts:feishu`
- `/prompts:feishu-on`
- `/prompts:feishu-off`
- `/prompts:feishu-status`
- `/prompts:feishu-test`

### 6. Verify Installation / 验证安装

Check bridge status:

检查 bridge 状态：

```bash
cd "$PLUGIN_DIR"
npm run bridge -- status
```

Send a test message:

发送测试消息：

```bash
npm run bridge -- send-test
```

Start the daemon:

启动 daemon：

```bash
npm run bridge -- start
npm run bridge -- status
tail -n 80 ~/.codex/feishu-codex-bridge/daemon.log
```

Expected log line:

预期日志：

```text
Feishu long connection ready
```

Stop the daemon if this was only an installation test:

如果只是安装测试，可以停止 daemon：

```bash
npm run bridge -- stop
```

## Handoff A Session / 接管一个 Codex 会话

From Codex, use the installed slash prompt:

在 Codex 中使用已安装的 slash prompt：

```text
/prompts:feishu
```

Equivalent explicit prompt:

等价的显式命令：

```text
/prompts:feishu-on
```

This enables the bridge for the current workspace and the latest Codex session.

这会为当前 workspace 和最新 Codex 会话启用 bridge。

Equivalent shell command:

等价 shell 命令：

```bash
cd "$PLUGIN_DIR"
npm run bridge -- enable \
  --session last \
  --chat-id oc_xxx \
  --cwd "/absolute/path/to/workspace"
```

The bridge writes state under `~/.codex/feishu-codex-bridge/` and starts the
daemon in the background.

Bridge 会把状态写入 `~/.codex/feishu-codex-bridge/`，并在后台启动 daemon。

## Feishu Usage / 飞书使用方法

Fast local commands. These return quickly and do not call Codex:

快速本地命令。这些命令会快速返回，不会调用 Codex：

```text
/ping
/status
/help
/off
```

Compatibility aliases:

兼容旧写法：

```text
/codex ping
/codex status
/codex help
/codex off
```

Any Feishu message beginning with `/` is treated as a local bridge command and
is not forwarded to Codex.

任何以 `/` 开头的飞书消息都会被当作本地 bridge 命令，不会转发给 Codex。

To send work to Codex, send a normal message without a leading slash:

如果要让 Codex 真正继续开发，请发送不以 `/` 开头的普通消息：

```text
Please continue implementing the feature and run the tests.
```

Codex responses are sent back to the same Feishu chat as Markdown card messages.

Codex 回复会以 Markdown card 消息发送回同一个飞书会话。

While a Feishu message is being handled, the bridge adds a `Typing` reaction to
that message and removes it after the Codex run finishes or fails.

当飞书消息正在被处理时，bridge 会在该消息下添加 `Typing` reaction；Codex 运行
完成或失败后会移除该 reaction。

Override the reaction with `FEISHU_BRIDGE_WORKING_EMOJI`.

可以通过 `FEISHU_BRIDGE_WORKING_EMOJI` 修改工作中表情。

## Return To Desktop / 回到桌面端

From Codex:

从 Codex：

```text
/prompts:feishu off
```

Equivalent explicit prompt:

等价显式命令：

```text
/prompts:feishu-off
```

From Feishu:

从飞书：

```text
/off
```

From shell:

从 shell：

```bash
cd "$PLUGIN_DIR"
npm run bridge -- disable
```

Check status:

检查状态：

```text
/prompts:feishu status
```

```bash
npm run status
```

## Commands / 命令

- `enable --session <id|last> --chat-id <oc_xxx> --cwd <path>`: hand off a
  session to Feishu and start the daemon.
- `enable --session <id|last> --chat-id <oc_xxx> --cwd <path>`：把某个会话
  交给飞书并启动 daemon。
- `disable`: turn off the active bridge.
- `disable`：关闭当前 bridge。
- `status`: print active session, chat, daemon, and log paths.
- `status`：打印当前会话、飞书 chat、daemon 和日志路径。
- `start`: start the daemon without changing active session.
- `start`：启动 daemon，但不改变当前接管会话。
- `stop`: stop the daemon.
- `stop`：停止 daemon。
- `run`: run the daemon in the foreground.
- `run`：以前台模式运行 daemon。
- `send-test --chat-id <oc_xxx>`: send a Feishu test message.
- `send-test --chat-id <oc_xxx>`：发送一条飞书测试消息。

## Runtime Files / 运行时文件

State:

状态文件：

```text
~/.codex/feishu-codex-bridge/state.json
```

Daemon log:

Daemon 日志：

```text
~/.codex/feishu-codex-bridge/daemon.log
```

Daemon pid:

Daemon pid：

```text
~/.codex/feishu-codex-bridge/daemon.pid
```

Codex resume error log:

Codex resume 错误日志：

```text
~/.codex/feishu-codex-bridge/codex-resume.log
```

## Operational Notes For AI Agents / AI 操作注意事项

- Do not edit Codex Desktop or Codex CLI source code for this integration.
- 不要为了这个集成修改 Codex Desktop 或 Codex CLI 源码。
- Do not print or commit `.env` secrets.
- 不要打印或提交 `.env` 中的密钥。
- Only one selected Codex session should be handed off at a time.
- 同一时间只应该接管一个指定的 Codex 会话。
- Feishu messages beginning with `/` are local bridge commands and are never
  forwarded to Codex.
- 以 `/` 开头的飞书消息是本地 bridge 命令，永远不会转发给 Codex。
- Normal Feishu messages are forwarded with `codex exec resume <session-id>`.
- 普通飞书消息会通过 `codex exec resume <session-id>` 转发。
- Desktop-originated messages are not mirrored to Feishu.
- 桌面端发起的消息不会镜像到飞书。
- If Feishu is slow only for normal messages, inspect `codex_ms` and
  `first_stdout_ms` in the daemon log.
- 如果只有普通飞书消息很慢，请检查 daemon 日志中的 `codex_ms` 和
  `first_stdout_ms`。

## Troubleshooting / 排障

If Feishu does not receive messages:

如果飞书收不到消息：

1. Verify `.env` values.
2. 检查 `.env` 配置。
3. Verify the bot is in the target chat.
4. 确认机器人已加入目标会话。
5. Verify `FEISHU_BRIDGE_CHAT_ID` matches the target chat id.
6. 确认 `FEISHU_BRIDGE_CHAT_ID` 和目标 chat id 一致。
7. Run `npm run bridge -- send-test`.
8. 运行 `npm run bridge -- send-test`。
9. Inspect `~/.codex/feishu-codex-bridge/daemon.log`.
10. 查看 `~/.codex/feishu-codex-bridge/daemon.log`。

If Feishu messages do not trigger Codex:

如果飞书消息没有触发 Codex：

1. Confirm the bridge is active with `npm run bridge -- status`.
2. 用 `npm run bridge -- status` 确认 bridge 已启用。
3. Confirm the message does not start with `/`.
4. 确认消息不是以 `/` 开头。
5. Confirm the daemon is running.
6. 确认 daemon 正在运行。
7. Inspect `daemon.log` for `processing Feishu message`.
8. 在 `daemon.log` 中查找 `processing Feishu message`。

If normal Feishu messages are slow:

如果普通飞书消息很慢：

1. Inspect `codex_ms` and `first_stdout_ms` in `daemon.log`.
2. 检查 `daemon.log` 里的 `codex_ms` 和 `first_stdout_ms`。
3. Large values usually mean `codex exec resume` or model first-token latency is
   the bottleneck, not Feishu networking.
4. 如果这些值很大，通常瓶颈在 `codex exec resume` 或模型首 token，而不是飞书网络。
5. Consider `CODEX_BRIDGE_REASONING_EFFORT=medium` or `low`.
6. 可以考虑设置 `CODEX_BRIDGE_REASONING_EFFORT=medium` 或 `low`。
7. Use `/ping` and `/status` for quick local checks.
8. 使用 `/ping` 和 `/status` 做快速本地检查。

If Codex Desktop does not visually show Feishu-originated turns immediately:

如果 Codex Desktop 没有立刻显示飞书发起的 turn：

- This plugin does not patch Codex Desktop.
- 本插件不会 patch Codex Desktop。
- Feishu turns are persisted through `codex exec resume`.
- 飞书 turn 会通过 `codex exec resume` 持久化到会话历史。
- The visible desktop window may need to be reopened or resumed to refresh.
- 当前可见桌面窗口可能需要重新打开或 resume 才会刷新。
