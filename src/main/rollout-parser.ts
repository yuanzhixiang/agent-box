import type {
  FileChangeEntry,
  ItemStatus,
  TimelineItem,
  TokenUsage,
} from "../shared/types";

// 单条命令输出最多传给界面的字符数，超长输出只保留头尾，避免 IPC 和渲染卡顿
const MAX_OUTPUT_CHARS = 20_000;
// 工具参数、MCP 结果的展示上限
const MAX_DETAIL_CHARS = 8_000;

/** 解析一个 rollout 文件过程中累积的状态，可以逐行增量喂入 */
export interface ParseState {
  /** 新格式：来自 item_completed 的高层条目，和 Codex app 看到的一致 */
  items: TimelineItem[];
  /** 旧格式兜底：没有 item_completed 时用 response_item 还原 */
  legacyItems: TimelineItem[];
  hasItemCompleted: boolean;
  openTurns: number;
  turnStartedAt: number | null;
  tokens: TokenUsage | null;
  legacyCalls: Map<string, number>;
  seq: number;
}

/** 新建一份空的解析状态 */
export function createParseState(): ParseState {
  return {
    items: [],
    legacyItems: [],
    hasItemCompleted: false,
    openTurns: 0,
    turnStartedAt: null,
    tokens: null,
    legacyCalls: new Map(),
    seq: 0,
  };
}

/** 当前应展示的时间线：有新格式条目就用新格式，否则回退旧格式 */
export function visibleItems(state: ParseState): TimelineItem[] {
  return state.hasItemCompleted ? state.items : state.legacyItems;
}

type Json = Record<string, unknown>;

/** 超长文本保留头尾，中间标注省略了多少字符 */
function clip(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const half = Math.floor(max / 2);
  const omitted = text.length - half * 2;
  return `${text.slice(0, half)}\n\n… 省略 ${omitted} 个字符 …\n\n${text.slice(-half)}`;
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  return JSON.stringify(value, null, 2);
}

/** 把 content 数组里所有文字片段拼起来，兼容 text / Text / input_text / output_text */
function joinText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part: Json) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function toStatus(value: unknown): ItemStatus {
  if (value === "failed" || value === "declined" || value === "in_progress") {
    return value;
  }
  return "completed";
}

function durationToMs(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const d = value as { secs?: number; nanos?: number };
  return Math.round((d.secs ?? 0) * 1000 + (d.nanos ?? 0) / 1e6);
}

/** zsh -lc "<cmd>" 这类包装只展示里面真正执行的命令 */
function formatCommand(command: unknown): string {
  if (typeof command === "string") {
    return command;
  }
  if (!Array.isArray(command)) {
    return "";
  }
  const parts = command.map(String);
  if (
    parts.length >= 3 &&
    /(^|\/)(ba|z)?sh$/.test(parts[0]) &&
    parts[1].startsWith("-")
  ) {
    return parts.slice(2).join(" ");
  }
  return parts.join(" ");
}

function stripFileUrl(path: unknown): string {
  return typeof path === "string" ? path.replace(/^file:\/\//, "") : "";
}

/** 把一个 item_completed 里的 item 转成时间线条目，不认识的类型返回通用条目 */
function fromCompletedItem(item: Json, at: number): TimelineItem | null {
  const id = String(item.id ?? `item-${at}`);
  switch (item.type) {
    case "UserMessage": {
      const content = Array.isArray(item.content)
        ? (item.content as Json[])
        : [];
      const images = content
        .filter(
          (part) =>
            typeof part.path === "string" || typeof part.url === "string",
        )
        .map((part) => stripFileUrl(part.path ?? part.url));
      return { kind: "user", id, at, text: joinText(content), images };
    }
    case "AgentMessage": {
      const phase =
        item.phase === "commentary" || item.phase === "final_answer"
          ? item.phase
          : null;
      return { kind: "agent", id, at, text: joinText(item.content), phase };
    }
    case "Reasoning": {
      // 推理大多是加密的，只有带摘要时才值得展示
      const text = [joinText(item.summary_text), joinText(item.raw_content)]
        .filter(Boolean)
        .join("\n");
      return text ? { kind: "reasoning", id, at, text } : null;
    }
    case "CommandExecution":
      return {
        kind: "command",
        id,
        at,
        command: formatCommand(item.command),
        cwd: stripFileUrl(item.cwd) || null,
        output: clip(asString(item.aggregated_output), MAX_OUTPUT_CHARS),
        exitCode: typeof item.exit_code === "number" ? item.exit_code : null,
        durationMs: durationToMs(item.duration),
        status: toStatus(item.status),
      };
    case "FileChange": {
      const changes = (item.changes ?? {}) as Record<string, Json>;
      const files: FileChangeEntry[] = Object.entries(changes).map(
        ([path, change]) => ({
          path,
          type: String(change.type ?? "update"),
          diff: clip(
            asString(change.unified_diff ?? change.content ?? ""),
            MAX_OUTPUT_CHARS,
          ),
        }),
      );
      return {
        kind: "file_change",
        id,
        at,
        files,
        status: toStatus(item.status),
      };
    }
    case "McpToolCall": {
      const args = (item.arguments ?? {}) as Json;
      const result = (item.result ?? item.error ?? {}) as Json;
      return {
        kind: "mcp",
        id,
        at,
        server: String(item.server ?? ""),
        tool: String(item.tool ?? ""),
        title: typeof args.title === "string" ? args.title : null,
        args: clip(asString(args.code ?? args), MAX_DETAIL_CHARS),
        result: clip(
          joinText(result.content) || asString(result),
          MAX_DETAIL_CHARS,
        ),
        status: toStatus(item.status),
        durationMs: durationToMs(item.duration),
      };
    }
    case "ImageView":
      return { kind: "image", id, at, path: stripFileUrl(item.path) };
    case "ContextCompaction":
      return { kind: "compaction", id, at };
    default:
      return {
        kind: "other",
        id,
        at,
        label: String(item.type ?? "未知条目"),
        detail: clip(asString(item), MAX_DETAIL_CHARS),
      };
  }
}

// 旧格式里 Codex 注入的上下文消息（环境、AGENTS.md 等）不是用户真正说的话
const INJECTED_PREFIXES = [
  "<environment_context>",
  "<user_instructions>",
  "# AGENTS.md",
  "<permissions",
];

/** 旧格式兜底：从 response_item 还原用户消息、回复和工具调用 */
function applyLegacy(state: ParseState, payload: Json, at: number): void {
  const id = String(payload.id ?? payload.call_id ?? `legacy-${state.seq}`);
  if (payload.type === "message") {
    const text = joinText(payload.content);
    if (
      payload.role === "user" &&
      text &&
      !INJECTED_PREFIXES.some((p) => text.startsWith(p))
    ) {
      state.legacyItems.push({ kind: "user", id, at, text, images: [] });
    } else if (payload.role === "assistant" && text) {
      const phase =
        payload.phase === "commentary" || payload.phase === "final_answer"
          ? payload.phase
          : null;
      state.legacyItems.push({ kind: "agent", id, at, text, phase });
    }
    return;
  }
  // 工具调用先占位，等对应的 output 回来再填结果
  if (payload.type === "function_call" || payload.type === "custom_tool_call") {
    const input = asString(payload.arguments ?? payload.input);
    state.legacyCalls.set(String(payload.call_id), state.legacyItems.length);
    state.legacyItems.push({
      kind: "command",
      id,
      at,
      command: clip(`${payload.name}: ${input}`, MAX_DETAIL_CHARS),
      cwd: null,
      output: "",
      exitCode: null,
      durationMs: null,
      status: "in_progress",
    });
    return;
  }
  if (
    payload.type === "function_call_output" ||
    payload.type === "custom_tool_call_output"
  ) {
    const index = state.legacyCalls.get(String(payload.call_id));
    const target = index === undefined ? undefined : state.legacyItems[index];
    if (target?.kind === "command") {
      const output = payload.output as unknown;
      const text =
        joinText(output) || asString((output as Json)?.content ?? output);
      state.legacyItems[index!] = {
        ...target,
        output: clip(text, MAX_OUTPUT_CHARS),
        status: "completed",
      };
    }
  }
}

function parseTime(value: unknown): number {
  const time = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : Date.now();
}

/** 喂入一行 rollout 记录，更新解析状态；坏行直接跳过 */
export function applyLine(state: ParseState, line: string): void {
  if (!line.trim()) {
    return;
  }
  let record: Json;
  try {
    record = JSON.parse(line) as Json;
  } catch {
    return;
  }
  state.seq += 1;
  const at = parseTime(record.timestamp);
  const payload = (record.payload ?? {}) as Json;

  // 1. 回合上下文：记下这一回合用的模型和推理档位，作为回合起点
  if (record.type === "turn_context") {
    const settings = ((payload.collaboration_mode as Json)?.settings ??
      {}) as Json;
    const turn: TimelineItem = {
      kind: "turn_start",
      id: `turn-${String(payload.turn_id ?? state.seq)}`,
      at: state.turnStartedAt ?? at,
      model: (payload.model as string) ?? (settings.model as string) ?? null,
      effort:
        (payload.effort as string) ??
        (settings.reasoning_effort as string) ??
        null,
    };
    state.items.push(turn);
    state.legacyItems.push(turn);
    return;
  }

  // 2. 旧格式的 response_item 只用于兜底
  if (record.type === "response_item") {
    applyLegacy(state, payload, at);
    return;
  }

  if (record.type !== "event_msg") {
    return;
  }

  // 3. 事件：回合开始/结束、token 用量、条目完成
  switch (payload.type) {
    case "task_started":
      state.openTurns += 1;
      state.turnStartedAt =
        typeof payload.started_at === "number" ? payload.started_at * 1000 : at;
      return;
    case "task_complete":
    case "turn_aborted": {
      state.openTurns = Math.max(0, state.openTurns - 1);
      const end: TimelineItem = {
        kind: "turn_end",
        id: `end-${String(payload.turn_id ?? state.seq)}`,
        at,
        durationMs:
          state.turnStartedAt === null ? null : at - state.turnStartedAt,
        aborted: payload.type === "turn_aborted",
      };
      state.items.push(end);
      state.legacyItems.push(end);
      state.turnStartedAt = null;
      return;
    }
    case "token_count": {
      const info = (payload.info ?? null) as Json | null;
      const total = (info?.total_token_usage ?? null) as Json | null;
      if (info && total) {
        state.tokens = {
          total: Number(total.total_tokens ?? 0),
          input: Number(total.input_tokens ?? 0),
          cachedInput: Number(total.cached_input_tokens ?? 0),
          output: Number(total.output_tokens ?? 0),
          contextWindow:
            typeof info.model_context_window === "number"
              ? info.model_context_window
              : null,
          lastInput: Number((info.last_token_usage as Json)?.input_tokens ?? 0),
        };
      }
      return;
    }
    case "item_completed": {
      state.hasItemCompleted = true;
      const itemAt =
        typeof payload.started_at_ms === "number" ? payload.started_at_ms : at;
      const item = fromCompletedItem((payload.item ?? {}) as Json, itemAt);
      if (item) {
        state.items.push(item);
      }
      return;
    }
    default:
      return;
  }
}
