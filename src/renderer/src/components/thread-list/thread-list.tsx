import { useEffect, useMemo, useState } from "react";
import factoryLogo from "../../assets/factory-logo.svg";
import { Icon } from "../shared/icon";
import type { ThreadSummary } from "../../../../shared/types";
import { shortPath } from "../../lib/format";

interface ThreadListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

// 搜索输入停顿这么久再查库，避免每个字符都发一次请求
const SEARCH_DEBOUNCE_MS = 200;

/** 左侧栏：codex exec 对话列表，支持关键词搜索和按项目筛选，数据库有变化时自动刷新 */
export function ThreadList({ selectedId, onSelect }: ThreadListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [panel, setPanel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 关键词变化后防抖查询，主进程通知有变化时按当前关键词重查
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      window.agentBox
        .listThreads({ query, cwd: null })
        .then((rows) => {
          if (!cancelled) {
            setThreads(rows);
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : String(err));
          }
        });
    };
    const timer = setTimeout(load, SEARCH_DEBOUNCE_MS);
    const off = window.agentBox.onThreadsChanged(load);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      off();
    };
  }, [query]);

  // 项目下拉的选项从当前结果里取，按出现次数排序
  const cwdOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thread of threads ?? []) {
      counts.set(thread.cwd, (counts.get(thread.cwd) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([path]) => path);
  }, [threads]);

  const visible = useMemo(
    () => (threads ?? []).filter((thread) => !cwd || thread.cwd === cwd),
    [threads, cwd],
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setCollapsed(false);
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setPanel(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-sidebar text-[12px] text-subtle-foreground ${collapsed ? "w-[52px]" : "w-[260px] [@media(max-width:1050px)]:w-60"}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-3 [&_img]:h-auto [&_img]:w-[108px] [-webkit-app-region:drag]">
        {!collapsed && <img src={factoryLogo} alt="Factory" />}
        <button
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground [-webkit-app-region:no-drag]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        >
          <Icon name="panel" />
        </button>
      </div>
      <nav
        className={`[&>button]:flex [&>button]:h-[29px] [&>button]:w-full [&>button]:items-center [&>button]:gap-3 [&>button]:rounded-[2px] [&>button]:border [&>button]:border-transparent [&>button]:text-left [&>button:hover]:bg-muted [&_svg]:size-3 [&_svg]:shrink-0 ${collapsed ? "px-2 [&>button]:justify-center [&>button]:p-0 [&_span]:hidden [&_kbd]:hidden" : "px-3 [&>button]:px-1.5"}`}
        aria-label="Main navigation"
      >
        <button
          className="group"
          onClick={() => onSelect(null)}
          title="New Session"
        >
          <Icon name="plus" />
          <span>New Session</span>
        </button>
        <button
          className="group"
          onClick={() => setPanel("Mission Control")}
          title="Mission Control"
        >
          <Icon name="flag" />
          <span>Mission Control</span>
        </button>
        <button
          className="group"
          onClick={() => setPanel("Automations")}
          title="Automations"
        >
          <Icon name="sparkle" />
          <span>Automations</span>
        </button>
        <button
          className="group"
          onClick={() => {
            setCollapsed(false);
            setSearchOpen(!searchOpen);
          }}
          title="Search"
        >
          <Icon name="search" />
          <span>Search</span>
          <kbd className="ml-auto font-[inherit] text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100">
            ⌘K
          </kbd>
        </button>
      </nav>
      {!collapsed && (
        <>
          {searchOpen && (
            <div className="px-3 pt-2.5 [&_input]:w-full [&_input]:rounded-[2px] [&_input]:border [&_input]:border-input [&_input]:bg-white [&_input]:px-2 [&_input]:py-[7px] [&_input]:outline-none">
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setShowAll(true);
                }}
                placeholder="Search sessions..."
                aria-label="Search sessions"
              />
            </div>
          )}
          <div className="mt-[30px] mr-4 mb-2 ml-[18px] flex items-center justify-between text-muted-foreground">
            <span>Projects</span>
            <button
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Filter projects"
              onClick={() => setPanel("Projects")}
            >
              <Icon name="filter" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {error && <p className="p-2 text-danger">读取失败：{error}</p>}
            {threads === null && (
              <p className="p-2 text-muted-foreground">Loading sessions…</p>
            )}
            {cwdOptions
              .filter((path) => !cwd || path === cwd)
              .map((path) => {
                const rows = visible.filter((thread) => thread.cwd === path);
                return (
                  <section key={path} className="mb-3">
                    <button
                      className="flex h-[30px] w-full items-center gap-2.5 px-1.5 text-left text-muted-foreground hover:bg-muted [&_span]:truncate [&_svg]:w-3 [&_svg]:shrink-0"
                      title={path}
                      onClick={() => setCwd(cwd === path ? null : path)}
                    >
                      <Icon name="folder" />
                      <span>
                        {path.split("/").filter(Boolean).at(-1) ||
                          shortPath(path)}
                      </span>
                    </button>
                    <ul>
                      {(showAll ? rows : rows.slice(0, 5)).map((thread) => (
                        <li key={thread.id}>
                          <ThreadRow
                            thread={thread}
                            selected={thread.id === selectedId}
                            onSelect={onSelect}
                          />
                        </li>
                      ))}
                    </ul>
                    {rows.length > 5 && (
                      <button
                        className="px-7 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setShowAll(!showAll)}
                      >
                        {showAll ? "Show less" : "Show more"}
                      </button>
                    )}
                  </section>
                );
              })}
            {threads !== null && visible.length === 0 && !error && (
              <p className="p-2 text-muted-foreground">
                {query ? "No matching sessions" : "No sessions yet"}
              </p>
            )}
          </div>
        </>
      )}
      <div className="mt-auto flex h-14 shrink-0 items-center gap-1 p-2">
        <button
          className={`flex h-10 flex-1 items-center gap-2 rounded text-left hover:bg-muted ${collapsed ? "justify-center p-0" : "px-2 py-1.5"}`}
          onClick={() => setPanel("Account")}
          title="Account"
        >
          <span className="grid size-6 place-items-center rounded-full bg-[#e6e6e6] font-semibold">
            MA
          </span>
          {!collapsed && <span>Max Arden</span>}
        </button>
        {!collapsed && (
          <button
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Settings"
            onClick={() => setPanel("Settings")}
          >
            <Icon name="settings" />
          </button>
        )}
      </div>
      {panel && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/20"
          onClick={() => setPanel(null)}
        >
          <section
            className="max-h-[70vh] w-[min(480px,90vw)] overflow-y-auto rounded border border-border bg-white p-5 text-[13px] text-foreground shadow-[0_8px_12px_#0002] [&_header]:mb-5 [&_header]:flex [&_header]:items-center [&_header]:justify-between [&_h2]:text-base [&_h2]:font-medium [&_p]:leading-[1.6] [&_p]:text-subtle-foreground"
            role="dialog"
            aria-modal="true"
            aria-label={panel}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>{panel}</h2>
              <button
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
                onClick={() => setPanel(null)}
              >
                <Icon name="close" />
              </button>
            </header>
            {panel === "Projects" ? (
              <>
                <button
                  className="flex w-full items-center gap-2 px-2 py-2.5 text-left [overflow-wrap:anywhere] hover:bg-muted"
                  onClick={() => {
                    setCwd(null);
                    setPanel(null);
                  }}
                >
                  All projects
                </button>
                {cwdOptions.map((path) => (
                  <button
                    className="flex w-full items-center gap-2 px-2 py-2.5 text-left [overflow-wrap:anywhere] hover:bg-muted"
                    key={path}
                    onClick={() => {
                      setCwd(path);
                      setPanel(null);
                    }}
                  >
                    <Icon name="folder" />
                    {shortPath(path)}
                  </button>
                ))}
              </>
            ) : panel === "Mission Control" ? (
              <>
                <p>
                  {(threads ?? []).filter((t) => t.status === "running").length}{" "}
                  running sessions
                </p>
                {(threads ?? [])
                  .filter((t) => t.status === "running")
                  .map((t) => (
                    <button
                      className="flex w-full items-center gap-2 px-2 py-2.5 text-left [overflow-wrap:anywhere] hover:bg-muted"
                      key={t.id}
                      onClick={() => {
                        onSelect(t.id);
                        setPanel(null);
                      }}
                    >
                      {t.title}
                    </button>
                  ))}
              </>
            ) : (
              <p>
                {panel === "Automations"
                  ? "当前本地应用尚未接入定时任务。"
                  : panel === "Account"
                    ? "Max Arden · Local workspace"
                    : "模型、推理强度和执行模式可在输入框底部调整；默认设置读取自本地 Codex 配置。"}
              </p>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

interface ThreadRowProps {
  thread: ThreadSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}

/** 列表里的一行：标题、项目、时间、运行状态 */
function ThreadRow({ thread, selected, onSelect }: ThreadRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(thread.id)}
      className={`mb-0.5 flex h-[29px] w-full items-center gap-2 rounded-[2px] pr-1.5 pl-7 text-left hover:bg-muted ${selected ? "bg-accent text-foreground" : ""}`}
      title={thread.title || "New session"}
    >
      {thread.status === "running" && (
        <span
          className="size-[5px] shrink-0 rounded-full bg-success"
          aria-label="运行中"
        />
      )}
      <span className="min-w-0 flex-1 truncate">
        {thread.title || "New session"}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">
        {sessionAge(thread.updatedAt)}
      </span>
    </button>
  );
}

function sessionAge(at: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
