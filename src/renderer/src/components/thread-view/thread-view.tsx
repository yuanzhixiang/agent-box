import { useEffect, useState } from "react";
import type { ThreadDetail } from "../../../../shared/types";
import { Composer } from "../composer/composer";
import { ThreadHeader } from "./thread-header";
import { Timeline } from "./timeline";

interface ThreadViewProps {
  threadId: string;
}

// 刚创建的对话可能还没写进数据库，按这个间隔重试
const RETRY_INTERVAL_MS = 1_000;
// 最多等这么久，超过就提示找不到
const RETRY_LIMIT = 30;

/** 右侧对话详情：加载完整时间线，并订阅后续增量实时追加 */
export function ThreadView({ threadId }: ThreadViewProps) {
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let subscribed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // 1. 先订阅增量，详情没加载完之前到的增量直接丢弃，加载结果里已经包含它们
    const off = window.agentBox.onThreadPatch((patch) => {
      if (patch.threadId !== threadId) {
        return;
      }
      setDetail((prev) =>
        prev
          ? {
              thread: { ...prev.thread, status: patch.status },
              items: patch.reset
                ? patch.items
                : [...prev.items, ...patch.items],
              tokens: patch.tokens ?? prev.tokens,
            }
          : prev,
      );
    });

    // 2. 加载详情；对话还没落库时隔一秒重试，加载到之后再让主进程开始跟踪文件
    const load = (attempt: number) => {
      void window.agentBox.getThread(threadId).then((result) => {
        if (cancelled) {
          return;
        }
        if (!result) {
          if (attempt >= RETRY_LIMIT) {
            setMissing(true);
          } else {
            retryTimer = setTimeout(() => load(attempt + 1), RETRY_INTERVAL_MS);
          }
          return;
        }
        setDetail(result);
        subscribed = true;
        void window.agentBox.subscribeThread(threadId);
      });
    };
    load(0);

    return () => {
      cancelled = true;
      off();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (subscribed) {
        void window.agentBox.unsubscribeThread(threadId);
      }
    };
  }, [threadId]);

  if (missing) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        找不到这条对话（{threadId}）
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">
        正在加载对话…
      </div>
    );
  }

  // 刚建的对话数据库里还没标题，用时间线里第一条任务的首行顶上
  const firstTask = detail.items.find((item) => item.kind === "user");
  const title =
    detail.thread.title ||
    (firstTask?.kind === "user" ? firstTask.text.split("\n")[0].trim() : "") ||
    "新对话";

  return (
    <>
      <ThreadHeader
        thread={detail.thread}
        title={title}
        tokens={detail.tokens}
      />
      <Timeline
        items={detail.items}
        running={detail.thread.status === "running"}
      />
      <Composer mode="resume" thread={detail.thread} />
    </>
  );
}
