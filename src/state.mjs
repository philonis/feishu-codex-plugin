import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

export function codexHome() {
  return process.env.CODEX_HOME || join(homedir(), ".codex");
}

export function bridgeDir() {
  return join(codexHome(), "feishu-codex-bridge");
}

export function statePath() {
  return join(bridgeDir(), "state.json");
}

export function pidPath() {
  return join(bridgeDir(), "daemon.pid");
}

export function logPath() {
  return join(bridgeDir(), "daemon.log");
}

export function ensureBridgeDir() {
  mkdirSync(bridgeDir(), { recursive: true });
}

export function readState() {
  ensureBridgeDir();
  if (!existsSync(statePath())) {
    return defaultState();
  }

  try {
    return {
      ...defaultState(),
      ...JSON.parse(readFileSync(statePath(), "utf8"))
    };
  } catch {
    return defaultState();
  }
}

export function writeState(nextState) {
  ensureBridgeDir();
  const value = {
    ...defaultState(),
    ...nextState,
    updatedAt: new Date().toISOString()
  };
  writeFileSync(statePath(), `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

export function defaultState() {
  return {
    version: 1,
    active: false,
    sessionId: "",
    chatId: "",
    cwd: "",
    enabledAt: "",
    disabledAt: "",
    sessionLogPath: "",
    sessionLogOffset: 0,
    updatedAt: ""
  };
}

export function resolveSessionId(value, options = {}) {
  const requested = value || process.env.CODEX_BRIDGE_SESSION_ID || "last";
  if (requested !== "last") {
    return requested;
  }

  const latest = findLatestSession({ cwd: options.cwd });
  if (latest?.id) {
    return latest.id;
  }

  throw new Error(`No resumable Codex session rollout found in ${join(codexHome(), "sessions")}.`);
}

export function findSessionLog(sessionId) {
  const root = join(codexHome(), "sessions");
  if (!existsSync(root)) {
    return "";
  }

  const matches = [];
  walk(root, (path) => {
    if (basename(path).includes(sessionId) && path.endsWith(".jsonl")) {
      matches.push(path);
    }
  });

  matches.sort();
  return matches[matches.length - 1] || "";
}

export function findLatestSession({ cwd } = {}) {
  const root = join(codexHome(), "sessions");
  if (!existsSync(root)) {
    return null;
  }

  const candidates = [];
  walk(root, (path) => {
    if (!basename(path).startsWith("rollout-") || !path.endsWith(".jsonl")) {
      return;
    }

    const meta = readSessionMeta(path);
    if (!meta.id) {
      return;
    }
    if (cwd && meta.cwd !== cwd) {
      return;
    }

    candidates.push({
      id: meta.id,
      cwd: meta.cwd || "",
      path,
      mtimeMs: statSync(path).mtimeMs
    });
  });

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

export function getFileSize(path) {
  if (!path || !existsSync(path)) {
    return 0;
  }
  return statSync(path).size;
}

export function displayStatus(state = readState()) {
  return [
    `active: ${state.active ? "yes" : "no"}`,
    `session: ${state.sessionId || "(none)"}`,
    `chat: ${state.chatId || "(none)"}`,
    `cwd: ${state.cwd || "(none)"}`,
    `state: ${statePath()}`,
    `log: ${logPath()}`
  ].join("\n");
}

function readSessionMeta(path) {
  try {
    const firstLine = readFileSync(path, "utf8").split(/\r?\n/, 1)[0];
    const record = JSON.parse(firstLine);
    if (record.type !== "session_meta") {
      return {};
    }
    return record.payload || {};
  } catch {
    return {};
  }
}

function walk(dir, onFile) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walk(path, onFile);
    } else if (entry.isFile()) {
      onFile(path);
    }
  }
}
