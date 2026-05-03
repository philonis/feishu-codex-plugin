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

export function resolveSessionId(value) {
  const requested = value || process.env.CODEX_BRIDGE_SESSION_ID || "last";
  if (requested !== "last") {
    return requested;
  }

  const indexPath = join(codexHome(), "session_index.jsonl");
  const raw = readFileSync(indexPath, "utf8").trim();
  if (!raw) {
    throw new Error(`No Codex sessions found in ${indexPath}.`);
  }

  const lines = raw.split(/\r?\n/).filter(Boolean);
  const latest = JSON.parse(lines[lines.length - 1]);
  if (!latest.id) {
    throw new Error(`Latest session index entry has no id in ${indexPath}.`);
  }
  return latest.id;
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
