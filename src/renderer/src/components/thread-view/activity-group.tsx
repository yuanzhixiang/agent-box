import { useState } from "react";
import type { ItemStatus, TimelineItem } from "../../../../shared/types";
import { formatDuration } from "../../lib/format";

interface ActivityGroupProps {
  items: TimelineItem[];
  /** 是否是运行中对话的最后一组；是的话默认展开，方便实时看 */
  live: boolean;
}

/** 一组连续的命令/工具调用，默认折叠成一行摘要 */
export function ActivityGroup({ items, live }: ActivityGroupProps) {
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? live;
  const failed = items.filter((item) => statusOf(item) === "failed").length;
  const last = items.at(-1)!;

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-muted-foreground hover:bg-muted"
      >
        <span className="w-3 shrink-0">{expanded ? "▾" : "▸"}</span>
        <span className="shrink-0">{summarize(items)}</span>
        {failed > 0 && (
          <span className="shrink-0 text-danger">{failed} 个失败</span>
        )}
        {!expanded && (
          <span className="min-w-0 truncate font-mono opacity-70">
            {titleOf(last)}
          </span>
        )}
      </button>
      {expanded && (
        <ul className="flex flex-col border-t border-border">
          {items.map((item) => (
            <li
              key={item.id}
              className="border-b border-border last:border-b-0"
            >
              <ActivityRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 组摘要：执行了 N 条命令、修改了 N 个文件… */
function summarize(items: TimelineItem[]): string {
  const counts = { command: 0, file_change: 0, mcp: 0, image: 0, other: 0 };
  for (const item of items) {
    if (item.kind in counts) {
      counts[item.kind as keyof typeof counts] += 1;
    }
  }
  const parts = [
    counts.command && `${counts.command} 条命令`,
    counts.file_change && `${counts.file_change} 次改文件`,
    counts.mcp && `${counts.mcp} 次工具调用`,
    counts.image && `${counts.image} 次看图`,
    counts.other && `${counts.other} 个其他操作`,
  ].filter(Boolean);
  return parts.join("，");
}

function statusOf(item: TimelineItem): ItemStatus | null {
  if (item.kind === "command") {
    return item.exitCode !== null && item.exitCode !== 0
      ? "failed"
      : item.status;
  }
  if (item.kind === "file_change" || item.kind === "mcp") {
    return item.status;
  }
  return null;
}

/** 单行标题：命令文本、文件名、工具名 */
function titleOf(item: TimelineItem): string {
  switch (item.kind) {
    case "command":
      return item.command;
    case "file_change":
      return item.files.map((file) => file.path.split("/").at(-1)).join("，");
    case "mcp":
      return `${item.server}.${item.tool}${item.title ? ` · ${item.title}` : ""}`;
    case "image":
      return item.path;
    case "other":
      return item.label;
    default:
      return "";
  }
}

const KIND_LABEL: Partial<Record<TimelineItem["kind"], string>> = {
  command: "$",
  file_change: "改",
  mcp: "工具",
  image: "图",
  other: "其他",
};

/** 活动组里的一行，可以点开看输出 / diff / 参数 */
function ActivityRow({ item }: { item: TimelineItem }) {
  const [open, setOpen] = useState(false);
  const status = statusOf(item);
  const duration =
    item.kind === "command" || item.kind === "mcp"
      ? formatDuration(item.durationMs)
      : "";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted"
      >
        <span className="w-8 shrink-0 text-muted-foreground">
          {KIND_LABEL[item.kind]}
        </span>
        <span
          className="min-w-0 flex-1 truncate font-mono"
          title={titleOf(item)}
        >
          {titleOf(item)}
        </span>
        {item.kind === "command" &&
          item.exitCode !== null &&
          item.exitCode !== 0 && (
            <span className="shrink-0 text-danger">exit {item.exitCode}</span>
          )}
        {status === "failed" && item.kind !== "command" && (
          <span className="shrink-0 text-danger">失败</span>
        )}
        {status === "declined" && (
          <span className="shrink-0 text-warning">已拒绝</span>
        )}
        {duration && (
          <span className="shrink-0 text-muted-foreground">{duration}</span>
        )}
      </button>
      {open && <ActivityDetail item={item} />}
    </div>
  );
}

const PRE_CLASS =
  "max-h-96 overflow-auto bg-muted px-3 py-2 font-mono text-[11.5px] leading-5 whitespace-pre-wrap break-all select-text";

function ActivityDetail({ item }: { item: TimelineItem }) {
  switch (item.kind) {
    case "command":
      return (
        <div>
          <pre className={PRE_CLASS}>
            <span className="text-muted-foreground">
              {item.cwd ? `${item.cwd}\n` : ""}${" "}
            </span>
            {item.command}
          </pre>
          <pre className={`${PRE_CLASS} border-t border-border`}>
            {item.output || "（无输出）"}
          </pre>
        </div>
      );
    case "file_change":
      return (
        <div className="flex flex-col">
          {item.files.map((file) => (
            <div key={file.path} className="border-t border-border">
              <p className="px-3 py-1 font-mono text-[11.5px] text-subtle-foreground">
                {file.type} {file.path}
              </p>
              <DiffView diff={file.diff} />
            </div>
          ))}
        </div>
      );
    case "mcp":
      return (
        <div>
          <pre className={PRE_CLASS}>{item.args}</pre>
          <pre className={`${PRE_CLASS} border-t border-border`}>
            {item.result || "（无结果）"}
          </pre>
        </div>
      );
    case "image":
      return <pre className={PRE_CLASS}>{item.path}</pre>;
    case "other":
      return <pre className={PRE_CLASS}>{item.detail}</pre>;
    default:
      return null;
  }
}

/** 统一 diff 按行着色：新增绿、删除红、块头灰 */
function DiffView({ diff }: { diff: string }) {
  return (
    <pre className={PRE_CLASS}>
      {diff.split("\n").map((line, index) => (
        <div
          key={index}
          className={
            line.startsWith("+")
              ? "text-success"
              : line.startsWith("-")
                ? "text-danger"
                : line.startsWith("@@")
                  ? "text-muted-foreground"
                  : ""
          }
        >
          {line || " "}
        </div>
      ))}
    </pre>
  );
}
