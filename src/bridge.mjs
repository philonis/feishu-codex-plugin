#!/usr/bin/env node

import { spawn } from "node:child_process";
import { openSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as Lark from "@larksuiteoapi/node-sdk";
import { FeishuClient } from "./feishu.mjs";
import { loadDotEnv, optionalEnv, PROJECT_ROOT } from "./env.mjs";
import { runCodexResume } from "./codex.mjs";
import {
  displayStatus,
  ensureBridgeDir,
  findSessionLog,
  getFileSize,
  logPath,
  pidPath,
  readState,
  resolveSessionId,
  writeState
} from "./state.mjs";
import { SessionLogForwarder } from "./session-log.mjs";

loadDotEnv();

const command = process.argv[2] || "help";
const flags = parseFlags(process.argv.slice(3));

try {
  if (command === "enable" || command === "handoff") {
    await enable(flags);
  } else if (command === "disable") {
    await disable(flags);
  } else if (command === "status") {
    console.log(displayStatus(readState()));
  } else if (command === "start") {
    startDaemon();
  } else if (command === "stop") {
    stopDaemon();
  } else if (command === "run") {
    await runDaemon();
  } else if (command === "send-test") {
    await sendTest(flags);
  } else {
    printHelp();
  }
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}

async function enable(options) {
  const chatId = options.chatId || optionalEnv("FEISHU_BRIDGE_CHAT_ID");
  const cwd = resolve(options.cwd || optionalEnv("CODEX_BRIDGE_CWD", process.cwd()));
  const sessionId = resolveSessionId(options.session, { cwd });
  if (!chatId) {
    throw new Error("Missing --chat-id or FEISHU_BRIDGE_CHAT_ID.");
  }

  const sessionLogPath = findSessionLog(sessionId);
  const state = writeState({
    active: true,
    sessionId,
    chatId,
    cwd,
    enabledAt: new Date().toISOString(),
    disabledAt: "",
    sessionLogPath,
    sessionLogOffset: sessionLogPath ? getFileSize(sessionLogPath) : 0
  });

  console.log(displayStatus(state));
  if (options.start !== false) {
    startDaemon();
  }

  const feishu = new FeishuClient();
  await feishu.sendText(chatId, [
    "Codex bridge enabled.",
    `session: ${sessionId}`,
    `cwd: ${cwd}`,
    "Send messages here to continue the selected Codex session.",
    "Use /codex off to disable."
  ].join("\n"));
}

async function disable(options) {
  const state = readState();
  const nextState = writeState({
    ...state,
    active: false,
    disabledAt: new Date().toISOString()
  });

  console.log(displayStatus(nextState));
  if (state.chatId) {
    const feishu = new FeishuClient();
    await feishu.sendText(state.chatId, "Codex bridge disabled. Desktop can continue the session normally.");
  }

  if (options.stop) {
    stopDaemon();
  }
}

function startDaemon() {
  ensureBridgeDir();
  if (isDaemonAlive()) {
    console.log(`daemon already running: ${readPid()}`);
    return;
  }

  const logFd = openSync(logPath(), "a");
  const child = spawn(process.execPath, [resolve(PROJECT_ROOT, "src/bridge.mjs"), "run"], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env
  });
  child.unref();
  writeFileSync(pidPath(), `${child.pid}\n`);
  console.log(`daemon started: ${child.pid}`);
  console.log(`log: ${logPath()}`);
}

function stopDaemon() {
  const pid = readPid();
  if (!pid) {
    console.log("daemon is not running");
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
    console.log(`daemon stopped: ${pid}`);
  } catch (error) {
    if (error.code === "ESRCH") {
      console.log("daemon pid file existed, but process was already gone");
    } else {
      throw error;
    }
  }
}

async function runDaemon() {
  const feishu = new FeishuClient();
  const forwarder = new SessionLogForwarder({ feishu });
  forwarder.start();

  const dispatcher = new Lark.EventDispatcher({
    loggerLevel: Lark.LoggerLevel.info
  }).register({
    "im.message.receive_v1": async (data) => {
      await handleFeishuMessage(data, { feishu, forwarder });
    }
  });

  const wsClient = new Lark.WSClient({
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    loggerLevel: Lark.LoggerLevel.info,
    onReady: () => console.log("[bridge] Feishu long connection ready"),
    onError: (error) => console.error(`[bridge] Feishu long connection error: ${error.message}`)
  });

  process.on("SIGTERM", () => {
    forwarder.stop();
    wsClient.close({ force: true });
    process.exit(0);
  });
  process.on("SIGINT", () => {
    forwarder.stop();
    wsClient.close({ force: true });
    process.exit(0);
  });

  console.log("[bridge] starting Feishu long connection");
  await wsClient.start({ eventDispatcher: dispatcher });
}

async function handleFeishuMessage(data, { feishu, forwarder }) {
  const event = data.event || data;
  const message = event.message || {};
  const chatId = message.chat_id;
  const messageId = message.message_id;
  const text = extractText(message.content);
  if (!chatId || !text) {
    return;
  }

  const state = readState();
  if (!state.active || chatId !== state.chatId) {
    return;
  }

  if (isProbablyFromSelf(event)) {
    return;
  }

  const commandResult = await handleBridgeCommand(text, state, feishu);
  if (commandResult.handled) {
    return;
  }

  const workingReaction = await addWorkingReaction(feishu, messageId);
  const mark = forwarder.mark();
  forwarder.suppressUserMessage(text);

  try {
    const result = await runCodexResume({
      sessionId: state.sessionId,
      cwd: state.cwd,
      prompt: text
    });

    if (!result.ok) {
      await feishu.sendText(chatId, [
        `Codex resume failed with code ${result.code}.`,
        result.stderr.trim() || "Details were written to ~/.codex/feishu-codex-bridge/codex-resume.log."
      ].join("\n"));
      return;
    }

    if (forwarder.countSince(mark) === 0 && result.finalMessage) {
      await feishu.sendText(chatId, `Codex:\n${result.finalMessage}`);
    }
  } finally {
    await removeWorkingReaction(feishu, workingReaction);
  }
}

async function handleBridgeCommand(text, state, feishu) {
  const normalized = text.trim();
  if (!normalized.startsWith("/codex")) {
    return { handled: false };
  }

  const rest = normalized.slice("/codex".length).trim();
  if (!rest || rest === "help") {
    await feishu.sendText(state.chatId, [
      "Codex bridge commands:",
      "/codex status",
      "/codex off",
      "/codex help",
      "",
      "Any other message is forwarded to the active Codex session."
    ].join("\n"));
    return { handled: true };
  }

  if (rest === "status") {
    await feishu.sendText(state.chatId, displayStatus(state));
    return { handled: true };
  }

  if (["off", "disable", "stop"].includes(rest)) {
    writeState({
      ...state,
      active: false,
      disabledAt: new Date().toISOString()
    });
    await feishu.sendText(state.chatId, "Codex bridge disabled.");
    return { handled: true };
  }

  return { handled: false };
}

async function sendTest(options) {
  const chatId = options.chatId || optionalEnv("FEISHU_BRIDGE_CHAT_ID");
  if (!chatId) {
    throw new Error("Missing --chat-id or FEISHU_BRIDGE_CHAT_ID.");
  }
  const feishu = new FeishuClient();
  await feishu.sendText(chatId, "Feishu Codex bridge test message.");
  console.log(`sent test message to ${chatId}`);
}

function parseFlags(args) {
  const result = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = toCamel(arg.slice(2));
    if (key.startsWith("no")) {
      const normalized = key.slice(2);
      result[normalized.charAt(0).toLowerCase() + normalized.slice(1)] = false;
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function extractText(content) {
  if (!content) {
    return "";
  }

  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return String(parsed.text || "").trim();
  } catch {
    return String(content || "").trim();
  }
}

function isProbablyFromSelf(event) {
  const sender = event.sender || {};
  const senderId = sender.sender_id || sender.id || {};
  return sender.sender_type === "app" || senderId.app_id === process.env.FEISHU_APP_ID;
}

async function addWorkingReaction(feishu, messageId) {
  if (!messageId) {
    return null;
  }

  try {
    const reactionId = await feishu.addReaction(messageId);
    return reactionId ? { messageId, reactionId } : null;
  } catch (error) {
    console.error(`[bridge] failed to add Feishu working reaction: ${error.message}`);
    return null;
  }
}

async function removeWorkingReaction(feishu, state) {
  if (!state) {
    return;
  }

  try {
    await feishu.removeReaction(state.messageId, state.reactionId);
  } catch (error) {
    console.error(`[bridge] failed to remove Feishu working reaction: ${error.message}`);
  }
}

function readPid() {
  try {
    return Number(readFileSync(pidPath(), "utf8").trim());
  } catch {
    return 0;
  }
}

function isDaemonAlive() {
  const pid = readPid();
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function printHelp() {
  console.log(`Usage:
  node src/bridge.mjs enable --session <id|last> --chat-id <oc_xxx> --cwd <path>
  node src/bridge.mjs disable [--stop]
  node src/bridge.mjs status
  node src/bridge.mjs start
  node src/bridge.mjs stop
  node src/bridge.mjs run
  node src/bridge.mjs send-test --chat-id <oc_xxx>`);
}
