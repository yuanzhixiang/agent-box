/** 对话在列表里的摘要信息，来自 Codex 的 threads 表 */
export interface ThreadSummary {
  id: string;
  title: string;
  cwd: string;
  model: string | null;
  reasoningEffort: string | null;
  createdAt: number;
  updatedAt: number;
  tokensUsed: number;
  rolloutPath: string;
  status: ThreadStatus;
}

export type ThreadStatus = "running" | "idle";

/** 一次命令或工具调用的执行状态 */
export type ItemStatus = "in_progress" | "completed" | "failed" | "declined";

export interface FileChangeEntry {
  path: string;
  type: string;
  diff: string;
}

/** 时间线上的一个条目，对应 rollout 里的一次 item_completed 或回合边界 */
export type TimelineItem =
  | { kind: "user"; id: string; at: number; text: string; images: string[] }
  | {
      kind: "agent";
      id: string;
      at: number;
      text: string;
      phase: "commentary" | "final_answer" | null;
    }
  | { kind: "reasoning"; id: string; at: number; text: string }
  | {
      kind: "command";
      id: string;
      at: number;
      command: string;
      cwd: string | null;
      output: string;
      exitCode: number | null;
      durationMs: number | null;
      status: ItemStatus;
    }
  | {
      kind: "file_change";
      id: string;
      at: number;
      files: FileChangeEntry[];
      status: ItemStatus;
    }
  | {
      kind: "mcp";
      id: string;
      at: number;
      server: string;
      tool: string;
      title: string | null;
      args: string;
      result: string;
      status: ItemStatus;
      durationMs: number | null;
    }
  | { kind: "image"; id: string; at: number; path: string }
  | { kind: "compaction"; id: string; at: number }
  | {
      kind: "turn_start";
      id: string;
      at: number;
      model: string | null;
      effort: string | null;
    }
  | {
      kind: "turn_end";
      id: string;
      at: number;
      durationMs: number | null;
      aborted: boolean;
    }
  | { kind: "other"; id: string; at: number; label: string; detail: string };

export interface TokenUsage {
  total: number;
  input: number;
  cachedInput: number;
  output: number;
  contextWindow: number | null;
  lastInput: number;
}

export interface ThreadDetail {
  thread: ThreadSummary;
  items: TimelineItem[];
  tokens: TokenUsage | null;
}

/** 主进程推给界面的增量：reset 为 true 时用 items 整体替换 */
export interface ThreadPatch {
  threadId: string;
  reset: boolean;
  items: TimelineItem[];
  status: ThreadStatus;
  tokens: TokenUsage | null;
}

export interface ModelOption {
  slug: string;
  displayName: string;
  efforts: string[];
  defaultEffort: string | null;
  supportsFast: boolean;
}

export interface Defaults {
  model: string | null;
  effort: string | null;
  fast: boolean;
  models: ModelOption[];
  recentCwds: string[];
}

export interface TaskOptions {
  prompt: string;
  cwd: string;
  model: string;
  effort: string;
  fast: boolean;
  autonomy?: "low" | "medium" | "high";
  workMode?: "normal" | "spec";
  attachments?: string[];
}

export interface ResumeOptions extends TaskOptions {
  threadId: string;
}

export interface ListFilter {
  query: string;
  cwd: string | null;
}

/** 由本应用启动的 codex 子进程的运行情况 */
export interface RunInfo {
  runId: string;
  threadId: string | null;
  running: boolean;
  exitCode: number | null;
  error: string | null;
  stderrTail: string;
}

export interface AgentBoxApi {
  listThreads(filter: ListFilter): Promise<ThreadSummary[]>;
  getThread(id: string): Promise<ThreadDetail | null>;
  subscribeThread(id: string): Promise<void>;
  unsubscribeThread(id: string): Promise<void>;
  getDefaults(): Promise<Defaults>;
  pickDirectory(): Promise<string | null>;
  pickAttachments(): Promise<string[]>;
  startTask(options: TaskOptions): Promise<RunInfo>;
  resumeTask(options: ResumeOptions): Promise<RunInfo>;
  stopRun(runId: string): Promise<void>;
  listRuns(): Promise<RunInfo[]>;
  onThreadPatch(listener: (patch: ThreadPatch) => void): () => void;
  onThreadsChanged(listener: () => void): () => void;
  onRunsChanged(listener: (runs: RunInfo[]) => void): () => void;
}
