import { closeSync, openSync, readSync, statSync } from "node:fs";
import {
  applyLine,
  createParseState,
  visibleItems,
  type ParseState,
} from "./rollout-parser";
import type { TimelineItem, TokenUsage } from "../shared/types";

// 跟踪中的文件多久检查一次新内容；Codex 是逐行追加写，轮询 stat 比 fs.watch 稳定
const POLL_INTERVAL_MS = 700;
// 回合没收尾但文件这么久没动，就当作进程已经异常退出，不再显示运行中
const STALE_RUNNING_MS = 30 * 60 * 1000;
// 每次最多读这么多字节，大文件分几轮读完
const READ_CHUNK_BYTES = 4 * 1024 * 1024;

/** 一个被跟踪的 rollout 文件 */
interface Tracked {
  path: string;
  offset: number;
  partial: string;
  state: ParseState;
  mtimeMs: number;
  /** 上次推送时界面拿到的条目数和格式，用来算增量 */
  sentCount: number;
  sentLegacy: boolean;
}

export interface RolloutSnapshot {
  items: TimelineItem[];
  tokens: TokenUsage | null;
  openTurns: boolean;
  mtimeMs: number;
}

export interface RolloutChange {
  reset: boolean;
  items: TimelineItem[];
  snapshot: RolloutSnapshot;
}

/** 从上次读到的位置继续读文件，把新的完整行喂给解析器；返回是否读到了新内容 */
function readMore(tracked: Tracked): boolean {
  let stat;
  try {
    stat = statSync(tracked.path);
  } catch {
    return false;
  }
  // 文件被截断或替换时从头再来
  if (stat.size < tracked.offset) {
    tracked.offset = 0;
    tracked.partial = "";
    tracked.state = createParseState();
    tracked.sentCount = 0;
  }
  tracked.mtimeMs = stat.mtimeMs;
  if (stat.size === tracked.offset) {
    return false;
  }

  const fd = openSync(tracked.path, "r");
  try {
    while (tracked.offset < stat.size) {
      const length = Math.min(READ_CHUNK_BYTES, stat.size - tracked.offset);
      const buffer = Buffer.alloc(length);
      const read = readSync(fd, buffer, 0, length, tracked.offset);
      if (read <= 0) {
        break;
      }
      tracked.offset += read;
      // 最后一行可能还没写完，留到下一轮再解析
      const text = tracked.partial + buffer.subarray(0, read).toString("utf8");
      const lines = text.split("\n");
      tracked.partial = lines.pop() ?? "";
      for (const line of lines) {
        applyLine(tracked.state, line);
      }
    }
  } finally {
    closeSync(fd);
  }
  return true;
}

function snapshotOf(tracked: Tracked): RolloutSnapshot {
  const stale = Date.now() - tracked.mtimeMs > STALE_RUNNING_MS;
  return {
    items: visibleItems(tracked.state),
    tokens: tracked.state.tokens,
    openTurns: tracked.state.openTurns > 0 && !stale,
    mtimeMs: tracked.mtimeMs,
  };
}

/** 管理所有 rollout 文件的读取缓存和订阅轮询 */
export class RolloutWatcher {
  private tracked = new Map<string, Tracked>();
  private subscribers = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private onChange: (path: string, change: RolloutChange) => void,
  ) {}

  /** 读取（或增量刷新）一个文件，返回完整快照，并把它记为已推送 */
  load(path: string): RolloutSnapshot {
    const tracked = this.ensure(path);
    readMore(tracked);
    const snapshot = snapshotOf(tracked);
    tracked.sentCount = snapshot.items.length;
    tracked.sentLegacy = !tracked.state.hasItemCompleted;
    return snapshot;
  }

  /** 只看文件是否还有未收尾的回合，给列表算运行状态用 */
  peekRunning(path: string): boolean {
    const tracked = this.ensure(path);
    readMore(tracked);
    return snapshotOf(tracked).openTurns;
  }

  /** 订阅中的文件路径 */
  subscribedPaths(): string[] {
    return [...this.subscribers.keys()];
  }

  /** 不读新内容，只返回当前缓存的回合状态和 token 用量 */
  current(path: string): RolloutSnapshot {
    return snapshotOf(this.ensure(path));
  }

  subscribe(path: string): void {
    this.subscribers.set(path, (this.subscribers.get(path) ?? 0) + 1);
    this.ensureTimer();
  }

  unsubscribe(path: string): void {
    const count = (this.subscribers.get(path) ?? 0) - 1;
    if (count <= 0) {
      this.subscribers.delete(path);
    } else {
      this.subscribers.set(path, count);
    }
    if (this.subscribers.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensure(path: string): Tracked {
    let tracked = this.tracked.get(path);
    if (!tracked) {
      tracked = {
        path,
        offset: 0,
        partial: "",
        state: createParseState(),
        mtimeMs: 0,
        sentCount: 0,
        sentLegacy: true,
      };
      this.tracked.set(path, tracked);
    }
    return tracked;
  }

  private ensureTimer(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  /** 轮询所有订阅中的文件，有新内容就把新增条目推出去 */
  private poll(): void {
    for (const path of this.subscribers.keys()) {
      const tracked = this.ensure(path);
      const wasRunning = snapshotOf(tracked).openTurns;
      const changed = readMore(tracked);
      const snapshot = snapshotOf(tracked);
      // 没新内容且运行状态没变（例如变成超时），就不打扰界面
      if (!changed && wasRunning === snapshot.openTurns) {
        continue;
      }
      // 新旧格式切换或条目变少时整体替换，否则只推新增部分
      const legacy = !tracked.state.hasItemCompleted;
      const reset =
        legacy !== tracked.sentLegacy ||
        snapshot.items.length < tracked.sentCount;
      const items = reset
        ? snapshot.items
        : snapshot.items.slice(tracked.sentCount);
      tracked.sentCount = snapshot.items.length;
      tracked.sentLegacy = legacy;
      this.onChange(path, { reset, items, snapshot });
    }
  }
}
