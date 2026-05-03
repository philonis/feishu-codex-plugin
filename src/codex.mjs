import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function runCodexResume({ sessionId, cwd, prompt }) {
  return new Promise((resolve) => {
    const outputDir = join(tmpdir(), "feishu-codex-bridge");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = join(outputDir, `codex-${Date.now()}.txt`);
    const codexBin = process.env.CODEX_BRIDGE_CODEX_BIN || "codex";
    const model = process.env.CODEX_BRIDGE_MODEL || "gpt-5.4";
    const args = [
      "exec",
      "resume",
      "-m",
      model,
      "--skip-git-repo-check",
      "-o",
      outputPath,
      sessionId,
      "-"
    ];

    const child = spawn(codexBin, args, {
      cwd: cwd || process.cwd(),
      env: buildCodexEnv(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      logCodexOutput({ stdout, stderr: `${stderr}\n${error.message}`.trim() });
      resolve({
        ok: false,
        code: -1,
        stdout,
        stderr: summarizeCodexError(`${stderr}\n${error.message}`),
        finalMessage: ""
      });
    });
    child.on("close", (code) => {
      const finalMessage = existsSync(outputPath)
        ? readFileSync(outputPath, "utf8").trim()
        : "";
      if (code !== 0) {
        logCodexOutput({ stdout, stderr });
      }
      resolve({
        ok: code === 0,
        code,
        stdout,
        stderr: summarizeCodexError(stderr || stdout),
        finalMessage
      });
    });

    child.stdin.end(prompt);
  });
}

function buildCodexEnv() {
  if (process.env.CODEX_BRIDGE_INHERIT_OPENAI_ENV === "1") {
    return process.env;
  }

  const env = { ...process.env };

  // The bridge is often launched from inside Codex Desktop. Those sessions can
  // carry API proxy variables that are valid for the parent app but break the
  // nested `codex exec resume` subprocess.
  delete env.OPENAI_BASE_URL;
  delete env.OPENAI_API_KEY;
  delete env.CODEX_THREAD_ID;
  delete env.CODEX_INTERNAL_ORIGINATOR_OVERRIDE;
  delete env.CODEX_CI;
  delete env.CODEX_SHELL;

  if (process.env.CODEX_BRIDGE_OPENAI_BASE_URL) {
    env.OPENAI_BASE_URL = process.env.CODEX_BRIDGE_OPENAI_BASE_URL;
  }
  if (process.env.CODEX_BRIDGE_OPENAI_API_KEY) {
    env.OPENAI_API_KEY = process.env.CODEX_BRIDGE_OPENAI_API_KEY;
  }

  return env;
}

function summarizeCodexError(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isNoisyCodexLine(line));

  const important = lines.find((line) => /^(Error:|error:|ERROR\b)/i.test(line))
    || lines.find((line) => /thread\/resume|failed to connect|stream disconnected|usage|unauthorized|rate/i.test(line))
    || lines[0]
    || "Codex exited without a useful error message.";

  return truncate(important, 500);
}

function isNoisyCodexLine(line) {
  return [
    /\bWARN\b.*codex_core::plugins::manifest/,
    /ignoring interface\.defaultPrompt/,
    /maximum of 3 prompts is supported/,
    /prompt must be at most 128 characters/,
    /migration \d+ was previously applied/,
    /codex_state::runtime: failed to open state db/
  ].some((pattern) => pattern.test(line));
}

function logCodexOutput({ stdout, stderr }) {
  const path = "/absolute/path/to/.codex/feishu-codex-bridge/codex-resume.log";
  const body = [
    `\n--- ${new Date().toISOString()} ---`,
    stdout ? `[stdout]\n${stdout.trim()}` : "",
    stderr ? `[stderr]\n${stderr.trim()}` : ""
  ].filter(Boolean).join("\n");
  try {
    appendFileSync(path, `${body}\n`);
  } catch {
    // Best effort logging only.
  }
}

function truncate(value, maxLength) {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}
