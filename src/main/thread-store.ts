import { DatabaseSync } from "node:sqlite";
import { stateDbPath } from "./codex-home";
import type { ListFilter } from "../shared/types";

/** threads 表里本应用用到的列 */
export interface ThreadRow {
  id: string;
  title: string;
  cwd: string;
  model: string | null;
  reasoningEffort: string | null;
  createdAt: number;
  updatedAt: number;
  tokensUsed: number;
  rolloutPath: string;
}

// 列表最多展示的对话数，再多界面也翻不过来
const LIST_LIMIT = 300;
// 标题只取首行的前若干字
const TITLE_MAX_CHARS = 120;

let db: DatabaseSync | null = null;

/** 只读打开 Codex 的状态库；Codex app 同时在写，只读连接不会抢写锁 */
function open(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(stateDbPath, { readOnly: true });
  }
  return db;
}

/** 把一行原始记录整理成 ThreadRow，标题按 name → title → 首条消息 回退；刚建的对话可能都为空 */
function toRow(raw: Record<string, unknown>): ThreadRow {
  const rawTitle =
    (raw.name as string | null) ||
    (raw.title as string) ||
    (raw.first_user_message as string) ||
    "";
  const createdAt = Number(raw.created_at_ms ?? Number(raw.created_at) * 1000);
  return {
    id: raw.id as string,
    title: rawTitle.split("\n")[0].trim().slice(0, TITLE_MAX_CHARS),
    cwd: raw.cwd as string,
    model: (raw.model as string | null) ?? null,
    reasoningEffort: (raw.reasoning_effort as string | null) ?? null,
    createdAt,
    updatedAt: Number(raw.updated_at_ms ?? Number(raw.updated_at) * 1000),
    tokensUsed: Number(raw.tokens_used ?? 0),
    rolloutPath: raw.rollout_path as string,
  };
}

const SELECT_COLUMNS = `id, name, title, first_user_message, cwd, model, reasoning_effort,
  created_at, created_at_ms, updated_at, updated_at_ms, tokens_used, rollout_path`;

/** 列出由 codex exec 创建、未归档的对话，按最近更新排序 */
export function listExecThreads(filter: ListFilter): ThreadRow[] {
  // 只看 exec 来源，这正是 Codex app 侧边栏过滤掉的那部分
  const where = ["source = 'exec'", "archived = 0"];
  const params: string[] = [];
  if (filter.cwd) {
    where.push("cwd = ?");
    params.push(filter.cwd);
  }
  // 关键词同时匹配标题、名字和首条消息
  const query = filter.query.trim();
  if (query) {
    where.push(
      "(title LIKE ? OR first_user_message LIKE ? OR IFNULL(name, '') LIKE ?)",
    );
    const like = `%${query}%`;
    params.push(like, like, like);
  }
  const rows = open()
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM threads WHERE ${where.join(" AND ")}
       ORDER BY updated_at DESC, id DESC LIMIT ${LIST_LIMIT}`,
    )
    .all(...params) as Record<string, unknown>[];
  return rows.map(toRow);
}

/** 按 id 读一条对话，不限来源（resume 后也能找到） */
export function getThreadRow(id: string): ThreadRow | null {
  const raw = open()
    .prepare(`SELECT ${SELECT_COLUMNS} FROM threads WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return raw ? toRow(raw) : null;
}

/** exec 对话的变化指纹：条数和最近更新时间，任何一个变了就说明列表要刷新 */
export function execFingerprint(): string {
  const raw = open()
    .prepare(
      `SELECT COUNT(*) AS c, MAX(updated_at_ms) AS u, MAX(updated_at) AS s
       FROM threads WHERE source = 'exec' AND archived = 0`,
    )
    .get() as Record<string, unknown>;
  return `${raw.c}:${raw.u}:${raw.s}`;
}

/** 最近用过的工作目录，给发任务时选目录用（包含所有来源） */
export function recentCwds(limit: number): string[] {
  const rows = open()
    .prepare(
      `SELECT cwd, MAX(updated_at) AS u FROM threads
       WHERE archived = 0 GROUP BY cwd ORDER BY u DESC LIMIT ?`,
    )
    .all(limit) as { cwd: string }[];
  return rows.map((row) => row.cwd);
}
