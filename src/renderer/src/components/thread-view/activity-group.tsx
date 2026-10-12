import { useState } from "react";
import type { ItemStatus, TimelineItem } from "../../../../shared/types";
import { Icon } from "../shared/icon";
import { formatDuration } from "../../lib/format";

interface ActivityGroupProps {
  items: TimelineItem[];
  /** 是否是运行中对话的最后一组；仅标记，不自动展开 */
  live: boolean;
}

/** 一组连续的命令/工具调用，默认折叠成一行摘要 */
export function ActivityGroup({ items, live }: ActivityGroupProps) {
  return (
    <div className="flex flex-col gap-2 px-3" data-live={live}>
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  );
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
        className="flex w-full items-center gap-2 py-1 text-left text-[13px] text-subtle-foreground hover:text-foreground [&>svg]:shrink-0 [&>svg]:text-muted-foreground"
        aria-expanded={open}
      >
        <Icon name="terminal" size={14} />
        <span className="min-w-0 truncate" title={titleOf(item)}>
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
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
            {duration}
          </span>
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
