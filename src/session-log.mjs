import { existsSync, openSync, readSync, closeSync } from "node:fs";
import { findSessionLog, getFileSize, readState, writeState } from "./state.mjs";

export class SessionLogForwarder {
  constructor({ feishu }) {
    this.feishu = feishu;
    this.timer = null;
    this.forwardCounts = new Map();
    this.suppressedUserMessages = new Map();
  }

  start() {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      this.tick().catch((error) => {
        console.error(`[session-log] ${error.stack || error.message}`);
      });
    }, 1000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  countSince(mark) {
    return this.forwardCounts.get(mark) || 0;
  }

  mark() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  suppressUserMessage(message) {
    const key = normalizeMessage(message);
    if (!key) {
      return;
    }
    this.suppressedUserMessages.set(key, (this.suppressedUserMessages.get(key) || 0) + 1);
  }

  async tick() {
    const state = readState();
    if (!state.active || !state.sessionId || !state.chatId) {
      return;
    }

    let logPath = state.sessionLogPath;
    if (!logPath || !existsSync(logPath)) {
      logPath = findSessionLog(state.sessionId);
      if (!logPath) {
        return;
      }
      writeState({
        ...state,
        sessionLogPath: logPath,
        sessionLogOffset: getFileSize(logPath)
      });
      return;
    }

    const size = getFileSize(logPath);
    const offset = Number(state.sessionLogOffset || 0);
    if (size <= offset) {
      return;
    }

    const fd = openSync(logPath, "r");
    try {
      const buffer = Buffer.alloc(size - offset);
      readSync(fd, buffer, 0, buffer.length, offset);
      const lines = buffer.toString("utf8").split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        await this.forwardLine(state.chatId, line);
      }
    } finally {
      closeSync(fd);
    }

    writeState({
      ...readState(),
      sessionLogPath: logPath,
      sessionLogOffset: size
    });
  }

  async forwardLine(chatId, line) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      return;
    }

    if (record.type !== "event_msg") {
      return;
    }

    const payload = record.payload || {};
    if (payload.type === "user_message") {
      const message = cleanMessage(payload.message);
      if (!message || this.consumeSuppressedUserMessage(message)) {
        return;
      }
      await this.feishu.sendText(chatId, `Codex user:\n${message}`);
      return;
    }

    if (payload.type === "agent_message") {
      const message = cleanMessage(payload.message);
      if (!message) {
        return;
      }
      await this.feishu.sendText(chatId, `Codex:\n${message}`);
      for (const mark of this.forwardCounts.keys()) {
        this.forwardCounts.set(mark, this.forwardCounts.get(mark) + 1);
      }
    }
  }

  consumeSuppressedUserMessage(message) {
    const key = normalizeMessage(message);
    const count = this.suppressedUserMessages.get(key) || 0;
    if (count <= 0) {
      return false;
    }
    if (count === 1) {
      this.suppressedUserMessages.delete(key);
    } else {
      this.suppressedUserMessages.set(key, count - 1);
    }
    return true;
  }
}

function cleanMessage(value) {
  return String(value || "").trim();
}

function normalizeMessage(value) {
  return cleanMessage(value).replace(/\r\n/g, "\n");
}
