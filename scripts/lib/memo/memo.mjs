import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { captureCommand } from "../platform/process.mjs";
import { ensureParentDir, readTextIfExists, writeText } from "../platform/fs.mjs";
import { runContextDbCli } from "../contextdb-cli.mjs";

const DEFAULT_SPACE = "default";
const WORKSPACE_MEMORY_AGENT = "workspace-memory";
const WORKSPACE_MEMORY_SESSION_PREFIX = "workspace-memory--";
const DEFAULT_LIST_LIMIT = 20;
const MAX_PRINT_CHARS = 12_000;

function usageError(message) {
  const error = new Error(`${message}\n\nRun: node scripts/aios.mjs memo --help`);
  error.code = "AIOS_MEMO_USAGE";
  return error;
}

function detectWorkspaceRoot(cwd = process.cwd()) {
  const result = captureCommand("git", ["-C", cwd, "rev-parse", "--show-toplevel"]);
  if (!result.error && result.status === 0) {
    const root = String(result.stdout || "").trim().split("\n")[0];
    if (root) return root;
  }
  return path.resolve(cwd);
}

function workspaceProjectName(workspaceRoot) {
  return path.basename(workspaceRoot);
}

function statePath(workspaceRoot) {
  return path.join(workspaceRoot, "memory", "context-db", ".workspace-memory.json");
}

function readActiveSpaceFromState(workspaceRoot) {
  const raw = readTextIfExists(statePath(workspaceRoot)).trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.activeSpace === "string" ? parsed.activeSpace.trim() : "";
  } catch {
    return "";
  }
}

function writeActiveSpaceToState(workspaceRoot, space) {
  const filePath = statePath(workspaceRoot);
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify({ activeSpace: space }, null, 2)}\n`, "utf8");
}

function normalizeSpace(raw) {
  const value = String(raw || "").trim();
  if (!value) return DEFAULT_SPACE;
  return value;
}

function resolveActiveSpace(workspaceRoot, env = process.env) {
  const envSpace = String(env.WORKSPACE_MEMORY_SPACE || "").trim();
  if (envSpace) return normalizeSpace(envSpace);
  const stored = readActiveSpaceFromState(workspaceRoot);
  if (stored) return normalizeSpace(stored);
  return DEFAULT_SPACE;
}

function sanitizeSpaceForSessionId(space) {
  const trimmed = normalizeSpace(space);
  const normalized = trimmed
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) return normalized;
  const hash = crypto.createHash("sha256").update(trimmed, "utf8").digest("hex").slice(0, 10);
  return `space-${hash}`;
}

function workspaceMemorySessionId(space) {
  return `${WORKSPACE_MEMORY_SESSION_PREFIX}${sanitizeSpaceForSessionId(space)}`;
}

function sessionDir(workspaceRoot, sessionId) {
  return path.join(workspaceRoot, "memory", "context-db", "sessions", sessionId);
}

function sessionMetaPath(workspaceRoot, sessionId) {
  return path.join(sessionDir(workspaceRoot, sessionId), "meta.json");
}

function hasWorkspaceMemorySession(workspaceRoot, space) {
  const sessionId = workspaceMemorySessionId(space);
  return fs.existsSync(sessionMetaPath(workspaceRoot, sessionId));
}

function ensureWorkspaceMemorySession(workspaceRoot, space) {
  const sessionId = workspaceMemorySessionId(space);
  if (fs.existsSync(sessionMetaPath(workspaceRoot, sessionId))) {
    return { sessionId, dir: sessionDir(workspaceRoot, sessionId) };
  }

  runContextDbCli(["init", "--workspace", workspaceRoot]);
  runContextDbCli([
    "session:new",
    "--workspace", workspaceRoot,
    "--agent", WORKSPACE_MEMORY_AGENT,
    "--project", workspaceProjectName(workspaceRoot),
    "--goal", `Workspace memory space "${normalizeSpace(space)}"`,
    "--session-id", sessionId,
    "--tags", `space:${normalizeSpace(space)}`,
  ]);

  return { sessionId, dir: sessionDir(workspaceRoot, sessionId) };
}

function pinnedPath(workspaceRoot, sessionId) {
  return path.join(sessionDir(workspaceRoot, sessionId), "pinned.md");
}

function readPinned(workspaceRoot, sessionId) {
  return readTextIfExists(pinnedPath(workspaceRoot, sessionId));
}

function writePinned(workspaceRoot, sessionId, content) {
  const normalized = String(content ?? "").trimEnd();
  writeText(pinnedPath(workspaceRoot, sessionId), normalized ? `${normalized}\n` : "");
}

function appendPinned(workspaceRoot, sessionId, content) {
  const existing = readPinned(workspaceRoot, sessionId).trimEnd();
  const addition = String(content ?? "").trim();
  if (!addition) return;
  const next = existing ? `${existing}\n\n${addition}\n` : `${addition}\n`;
  writeText(pinnedPath(workspaceRoot, sessionId), next);
}

function extractTags(text) {
  const tags = new Set();
  const input = String(text ?? "");
  const matches = input.matchAll(/#([\p{L}\p{N}_-]+)/gu);
  for (const match of matches) {
    const tag = String(match[1] || "").trim();
    if (tag) tags.add(tag);
  }
  return Array.from(tags);
}

function safePrintText(io, text) {
  const raw = String(text ?? "");
  if (!raw) {
    io.log("(none)");
    return;
  }
  const trimmed = raw.length > MAX_PRINT_CHARS ? `${raw.slice(0, MAX_PRINT_CHARS)}\n[truncated]` : raw;
  io.log(trimmed.trimEnd());
}

function parsePositiveLimit(raw) {
  const parsed = Number.parseInt(String(raw || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw usageError("--limit must be a positive integer");
  }
  return parsed;
}

function splitFlags(argv) {
  const flags = {
    limit: DEFAULT_LIST_LIMIT,
    semantic: false,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "--limit") {
      flags.limit = parsePositiveLimit(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--semantic") {
      flags.semantic = true;
      continue;
    }
    positionals.push(arg);
  }
  return { positionals, flags };
}

function formatRefs(refs = []) {
  if (!Array.isArray(refs) || refs.length === 0) return "";
  const tokens = refs
    .map((ref) => String(ref || "").trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((ref) => `#${ref}`);
  return tokens.length > 0 ? ` ${tokens.join(" ")}` : "";
}

function renderMemoRow(row) {
  const ts = row?.ts ? String(row.ts) : "";
  const eventId = row?.eventId ? String(row.eventId) : "";
  const text = row?.text ? String(row.text).replace(/\s+/g, " ").trim() : "";
  const refsLabel = formatRefs(row?.refs || []);
  const idLabel = eventId ? ` (${eventId})` : "";
  return `- [${ts}]${idLabel}${refsLabel}: ${text}`;
}

export async function runMemo(rawOptions = {}, { io = console } = {}) {
  const argv = Array.isArray(rawOptions.argv) ? rawOptions.argv : [];
  const workspaceRoot = detectWorkspaceRoot(process.cwd());
  const activeSpace = resolveActiveSpace(workspaceRoot);

  const [primary, secondary, ...rest] = argv;
  if (!primary) {
    throw usageError("Missing memo subcommand");
  }

  if (primary === "use") {
    const space = normalizeSpace([secondary, ...rest].join(" "));
    writeActiveSpaceToState(workspaceRoot, space);
    io.log(`Active space: ${space}`);
    io.log(`Workspace: ${workspaceRoot}`);
    return;
  }

  if (primary === "space") {
    if ((secondary || "").toLowerCase() !== "list") {
      throw usageError("Usage: memo space list");
    }
    const sessionsRoot = path.join(workspaceRoot, "memory", "context-db", "sessions");
    const entries = fs.existsSync(sessionsRoot)
      ? fs.readdirSync(sessionsRoot, { withFileTypes: true })
      : [];
    const spaces = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(WORKSPACE_MEMORY_SESSION_PREFIX))
      .map((entry) => entry.name.slice(WORKSPACE_MEMORY_SESSION_PREFIX.length))
      .sort((a, b) => a.localeCompare(b));
    if (spaces.length === 0) {
      io.log("(none)");
      return;
    }
    const activeSuffix = sanitizeSpaceForSessionId(activeSpace);
    for (const spaceSuffix of spaces) {
      const marker = spaceSuffix === activeSuffix ? "*" : " ";
      io.log(`${marker} ${spaceSuffix}`);
    }
    return;
  }

  if (primary === "pin") {
    const action = String(secondary || "").toLowerCase();
    if (!action) throw usageError("Usage: memo pin <show|set|add> ...");

    const space = activeSpace;
    const sessionId = workspaceMemorySessionId(space);

    if (action === "show") {
      if (!fs.existsSync(pinnedPath(workspaceRoot, sessionId))) {
        io.log("(none)");
        return;
      }
      safePrintText(io, readPinned(workspaceRoot, sessionId));
      return;
    }

    const text = rest.join(" ").trim();
    if (!text) throw usageError("pin set/add requires text");

    ensureWorkspaceMemorySession(workspaceRoot, space);
    if (action === "set") {
      writePinned(workspaceRoot, sessionId, text);
      io.log("Pinned memory updated.");
      return;
    }
    if (action === "add") {
      appendPinned(workspaceRoot, sessionId, text);
      io.log("Pinned memory appended.");
      return;
    }
    throw usageError(`Unknown pin action: ${secondary}`);
  }

  if (primary === "add") {
    const text = [secondary, ...rest].join(" ").trim();
    if (!text) throw usageError("memo add requires text");

    const space = activeSpace;
    const { sessionId } = ensureWorkspaceMemorySession(workspaceRoot, space);
    const refs = extractTags(text);
    const args = [
      "event:add",
      "--workspace", workspaceRoot,
      "--session", sessionId,
      "--role", "user",
      "--kind", "memo",
      "--text", text,
    ];
    if (refs.length > 0) {
      args.push("--refs", refs.join(","));
    }
    const event = runContextDbCli(args);
    const eventId = event?.seq ? `${sessionId}#${event.seq}` : "";
    io.log(`Memo added${eventId ? `: ${eventId}` : "."}`);
    return;
  }

  if (primary === "list") {
    const { positionals, flags } = splitFlags(argv);
    if (positionals[0] !== "list") throw usageError("Usage: memo list [--limit N]");
    const limit = flags.limit;

    const space = activeSpace;
    if (!hasWorkspaceMemorySession(workspaceRoot, space)) {
      io.log("(none)");
      return;
    }
    const sessionId = workspaceMemorySessionId(space);
    const result = runContextDbCli([
      "search",
      "--workspace", workspaceRoot,
      "--session", sessionId,
      "--kinds", "memo",
      "--limit", String(limit),
    ]);
    const rows = Array.isArray(result?.results) ? result.results : [];
    if (rows.length === 0) {
      io.log("(none)");
      return;
    }
    for (const row of rows.reverse()) {
      io.log(renderMemoRow(row));
    }
    return;
  }

  if (primary === "search") {
    const { positionals, flags } = splitFlags(argv);
    if (positionals[0] !== "search") throw usageError("Usage: memo search <query> [--limit N] [--semantic]");
    const query = positionals.slice(1).join(" ").trim();
    if (!query) throw usageError("memo search requires query text");
    const limit = flags.limit;

    const space = activeSpace;
    if (!hasWorkspaceMemorySession(workspaceRoot, space)) {
      io.log("(none)");
      return;
    }
    const sessionId = workspaceMemorySessionId(space);
    const result = runContextDbCli([
      "search",
      "--workspace", workspaceRoot,
      "--session", sessionId,
      "--kinds", "memo",
      "--query", query,
      "--limit", String(limit),
      ...(flags.semantic ? ["--semantic"] : []),
    ]);
    const rows = Array.isArray(result?.results) ? result.results : [];
    if (rows.length === 0) {
      io.log("(none)");
      return;
    }
    for (const row of rows.reverse()) {
      io.log(renderMemoRow(row));
    }
    return;
  }

  throw usageError(`Unknown memo subcommand: ${primary}`);
}

