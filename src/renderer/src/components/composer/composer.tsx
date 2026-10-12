import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  Defaults,
  RunInfo,
  ThreadSummary,
} from "../../../../shared/types";
import { Icon } from "../shared/icon";
import { useDefaults } from "./use-defaults";
import { useRuns } from "./use-runs";

type ComposerProps =
  | { mode: "new"; onThreadCreated: (threadId: string) => void }
  | { mode: "resume"; thread: ThreadSummary };
type Autonomy = "low" | "medium" | "high";
interface Overrides {
  cwd?: string;
  model?: string;
  effort?: string;
  fast?: boolean;
}
interface DictationRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
function dictationConstructor() {
  const host = window as unknown as {
    SpeechRecognition?: new () => DictationRecognition;
    webkitSpeechRecognition?: new () => DictationRecognition;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}
const toolbarButtonClass =
  "inline-flex h-7 max-w-[170px] items-center gap-1.5 rounded border border-input bg-white text-[12px] text-subtle-foreground hover:bg-muted hover:text-foreground disabled:cursor-default disabled:text-muted-foreground disabled:opacity-100 disabled:hover:bg-white [@media(max-width:1050px)]:text-[11px]";
const toolbarSquareClass = `${toolbarButtonClass} w-7 justify-center p-0 [@media(max-width:1050px)]:px-1.5`;

const AUTONOMY: Autonomy[] = ["low", "medium", "high"];
const AUTONOMY_DESCRIPTION = {
  low: "File edits and read-only commands",
  medium: "Adds reversible commands",
  high: "Runs all commands",
};
function LevelBars({ level }: { level: number }) {
  return (
    <span
      className="inline-flex h-3 shrink-0 items-center gap-0.5 [@media(max-width:1050px)]:gap-px"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-3 w-1 rounded-[1px] [@media(max-width:1050px)]:w-[3px] ${i < level ? "bg-[#aaa]" : "bg-[#dedede]"}`}
        />
      ))}
    </span>
  );
}

export function Composer(props: ComposerProps) {
  const defaults = useDefaults();
  const runs = useRuns();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<DictationRecognition | null>(null);
  const [prompt, setPrompt] = useState("");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [menu, setMenu] = useState<"model" | "mode" | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [autonomy, setAutonomy] = useState<Autonomy>("low");
  const [workMode, setWorkMode] = useState<"normal" | "spec">("normal");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const modeRef = useRef<HTMLButtonElement>(null);
  const escapeRef = useRef(0);
  const helpDialogRef = useRef<HTMLDivElement>(null);
  const threadId = props.mode === "resume" ? props.thread.id : null;
  const settings = resolveSettings(
    defaults,
    props.mode === "resume" ? props.thread : null,
    overrides,
  );
  const model =
    defaults?.models.find((option) => option.slug === settings.model) ?? null;
  const pendingRun = runs.find((run) => run.runId === pendingRunId) ?? null;
  const activeRun =
    runs.find(
      (run) => run.running && threadId !== null && run.threadId === threadId,
    ) ?? (pendingRun?.running ? pendingRun : null);
  const busyElsewhere =
    props.mode === "resume" && props.thread.status === "running" && !activeRun;
  const canSend = !!(
    prompt.trim() &&
    settings.cwd &&
    settings.model &&
    settings.effort &&
    !activeRun &&
    !busyElsewhere &&
    !submitting
  );
  const createdThreadId = pendingRun?.threadId ?? null;
  const onThreadCreated = props.mode === "new" ? props.onThreadCreated : null;
  const shownError =
    error ?? (pendingRun && !pendingRun.running ? pendingRun.error : null);
  useEffect(() => {
    if (onThreadCreated && createdThreadId) onThreadCreated(createdThreadId);
  }, [createdThreadId, onThreadCreated]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.style.height = "auto";
      input.style.height = `${Math.max(42, Math.min(input.scrollHeight, 240))}px`;
    }
  }, [prompt]);
  useEffect(() => {
    if (!menu) return;
    rootRef.current
      ?.querySelector<HTMLButtonElement>("[role=menu] button:not(:disabled)")
      ?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        (menu === "model" ? modelRef : modeRef).current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", keydown, true);
    };
  }, [menu]);
  useEffect(() => {
    if (!helpOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = helpDialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setHelpOpen(false);
      }
      if (event.key === "Tab") {
        event.preventDefault();
        dialog?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      previous?.focus();
    };
  }, [helpOpen]);
  const cycleEffort = () => {
    const efforts = model?.efforts ?? [];
    if (efforts.length)
      setOverrides((prev) => ({
        ...prev,
        effort:
          efforts[
            (efforts.indexOf(settings.effort ?? "") + 1) % efforts.length
          ],
      }));
  };
  const cycleAutonomy = () =>
    setAutonomy((prev) => AUTONOMY[(AUTONOMY.indexOf(prev) + 1) % 3]);
  async function send() {
    if (!canSend) return;
    setError(null);
    setSubmitting(true);
    const options = {
      prompt: prompt.trim(),
      cwd: settings.cwd!,
      model: settings.model!,
      effort: settings.effort!,
      fast: settings.fast,
      autonomy,
      workMode,
      attachments,
    };
    try {
      const run: RunInfo = threadId
        ? await window.agentBox.resumeTask({ ...options, threadId })
        : await window.agentBox.startTask(options);
      setPendingRunId(run.runId);
      setPrompt("");
      setAttachments([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }
  useEffect(
    () => () => {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.onend = null;
        recognition.onerror = null;
        recognition.onresult = null;
        recognition.abort();
      }
    },
    [],
  );
  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Recognition = dictationConstructor();
    if (!Recognition) {
      setError("Voice dictation is not supported by this runtime.");
      return;
    }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = navigator.language;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let text = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index++
      ) {
        if (event.results[index].isFinal)
          text += event.results[index][0].transcript;
      }
      if (text)
        setPrompt(
          (previous) =>
            previous + (previous && !/\s$/.test(previous) ? " " : "") + text,
        );
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = (event) => {
      setListening(false);
      setError(`Voice dictation: ${event.error}`);
    };
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function attachFiles() {
    try {
      const paths = await window.agentBox.pickAttachments();
      setAttachments((prev) => [...new Set([...prev, ...paths])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function pickDirectory() {
    const path = await window.agentBox.pickDirectory();
    if (path) setOverrides((prev) => ({ ...prev, cwd: path }));
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    } else if (event.key === "Tab") {
      event.preventDefault();
      if (event.shiftKey)
        setWorkMode((prev) => (prev === "normal" ? "spec" : "normal"));
      else cycleEffort();
    } else if (event.ctrlKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      setMenu("model");
    } else if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "l"
    ) {
      event.preventDefault();
      cycleAutonomy();
    } else if (event.key === "Escape") {
      if (activeRun) {
        void window.agentBox.stopRun(activeRun.runId);
        return;
      }
      const now = event.timeStamp;
      if (escapeRef.current > 0 && now - escapeRef.current < 700) {
        setPrompt("");
        setAttachments([]);
      }
      escapeRef.current = now;
    }
  }
  const effortLevel = Math.min(
    3,
    Math.max(
      1,
      model?.efforts.indexOf(settings.effort ?? "") !== undefined
        ? (model?.efforts.indexOf(settings.effort ?? "") ?? 0) + 1
        : 1,
    ),
  );
  return (
    <div className="shrink-0 px-6 pt-2 pb-3 [@media(max-width:1050px)]:px-4">
      {props.mode === "new" && (
        <div className="mx-auto mb-2 flex max-w-[736px] justify-end [&_button]:flex [&_button]:max-w-[220px] [&_button]:items-center [&_button]:gap-1.5 [&_button]:text-[12px] [&_button]:text-subtle-foreground [&_span]:truncate">
          <button
            type="button"
            title={settings.cwd ?? "Select workspace"}
            onClick={() => void pickDirectory()}
          >
            <Icon name="folder" size={12} />
            <span>
              {settings.cwd?.split("/").filter(Boolean).at(-1) ??
                "Select workspace"}
            </span>
            <Icon name="chevron" size={12} />
          </button>
        </div>
      )}
      <div
        className="relative mx-auto w-full max-w-[736px] rounded border border-input bg-white focus-within:border-[#999]"
        ref={rootRef}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {attachments.map((path) => (
              <span
                className="flex max-w-[220px] items-center gap-1.5 rounded border border-input bg-muted px-1.5 py-1 text-[11px] [overflow-wrap:anywhere] [&_button]:flex [&_button]:shrink-0"
                key={path}
                title={path}
              >
                {path.split("/").at(-1)}
                <button
                  aria-label={`Remove ${path.split("/").at(-1)}`}
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((item) => item !== path),
                    )
                  }
                >
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={
            props.mode === "new"
              ? "What would you like to work on?"
              : "Type your message..."
          }
          aria-label="Message"
          className="block max-h-60 min-h-[42px] w-full resize-none p-3 text-[13px] leading-5 outline-none placeholder:text-subtle-foreground"
        />
        <div className="flex h-11 min-h-11 flex-nowrap items-center gap-2 border-t border-input p-2 text-[12px] whitespace-nowrap text-muted-foreground [@media(max-width:1050px)]:gap-1.5 [@media(max-width:1050px)]:px-1.5 [&>*]:shrink-0">
          <button
            type="button"
            className={toolbarSquareClass}
            aria-label="Attach a file"
            title="Attach a file"
            onClick={() => void attachFiles()}
          >
            <Icon name="plus" size={12} />
          </button>
          <div className="flex max-w-[190px] min-w-20 items-center [@media(max-width:1050px)]:max-w-[150px] [&&]:shrink">
            <button
              ref={modelRef}
              type="button"
              className={`${toolbarButtonClass} min-w-0 max-w-[148px]! justify-start rounded-r-none border-r-0 px-2 [@media(max-width:1050px)]:px-1.5 [&_span]:truncate`}
              aria-label="Select model"
              aria-haspopup="menu"
              aria-expanded={menu === "model"}
              title={model?.displayName ?? settings.model ?? "Loading model"}
              onClick={() => setMenu(menu === "model" ? null : "model")}
            >
              <span>{model?.displayName ?? settings.model ?? "Loading…"}</span>
            </button>
            <button
              type="button"
              className={`${toolbarButtonClass} w-[30px] shrink-0 justify-center rounded-l-none border-l-0 px-1.5 [@media(max-width:1050px)]:w-[26px] [@media(max-width:1050px)]:px-1`}
              aria-label={`Reasoning: ${settings.effort ?? "loading"}`}
              title={`Reasoning: ${settings.effort ?? "loading"} (Tab)`}
              disabled={!model?.efforts.length}
              onClick={cycleEffort}
            >
              <LevelBars level={effortLevel} />
            </button>
          </div>
          <button
            type="button"
            className={`${toolbarButtonClass} min-w-[88px] justify-between px-2 [@media(max-width:1050px)]:min-w-[76px] [@media(max-width:1050px)]:px-1.5`}
            aria-label={`Autonomy: ${autonomy}`}
            title={`Autonomy: ${autonomy} — ${AUTONOMY_DESCRIPTION[autonomy]} (⌘L)`}
            onClick={cycleAutonomy}
          >
            <span>{autonomy[0].toUpperCase() + autonomy.slice(1)}</span>
            <LevelBars level={AUTONOMY.indexOf(autonomy) + 1} />
          </button>
          <button
            ref={modeRef}
            type="button"
            className={`${toolbarButtonClass} justify-center px-2 [@media(max-width:1050px)]:px-1.5`}
            title={`${workMode === "normal" ? "Normal" : "Spec"} Mode (Shift+Tab)`}
            aria-haspopup="menu"
            aria-expanded={menu === "mode"}
            onClick={() => setMenu(menu === "mode" ? null : "mode")}
          >
            {workMode === "normal" ? "Normal Mode" : "Spec Mode"}
          </button>
          <button
            type="button"
            className={`${toolbarButtonClass} justify-center px-2 [@media(max-width:1050px)]:px-1.5`}
            disabled
            title="No connectors available in this local workspace"
          >
            <span className="size-1.5 rounded-full bg-[#999]" />
            Connectors
          </button>
          <button
            type="button"
            className={`${toolbarButtonClass} justify-center px-2 [@media(max-width:1050px)]:px-1.5`}
            aria-label="Skills"
            disabled
            title="Skill selection is not available in the local runner"
          >
            Skills
          </button>
          <button
            type="button"
            className={toolbarSquareClass}
            aria-label="Show keyboard shortcuts"
            title="Show keyboard shortcuts"
            onClick={() => {
              setMenu(null);
              setHelpOpen(true);
            }}
          >
            ?
          </button>
          <div className="ml-auto flex items-center">
            {listening ? (
              <button
                type="button"
                className={`${toolbarSquareClass} border-danger! text-danger!`}
                aria-label="Stop voice dictation"
                title="Stop voice dictation"
                onClick={toggleDictation}
              >
                <Icon name="mic" size={12} />
              </button>
            ) : activeRun ? (
              <button
                type="button"
                className={toolbarSquareClass}
                aria-label="Stop execution"
                title="Stop generating (Esc)"
                onClick={() => void window.agentBox.stopRun(activeRun.runId)}
              >
                <Icon name="stop" size={12} />
              </button>
            ) : prompt.trim() ? (
              <button
                type="button"
                disabled={!canSend}
                className={`${toolbarButtonClass} w-7 justify-center p-0 enabled:border-foreground enabled:bg-foreground enabled:text-white [@media(max-width:1050px)]:px-1.5`}
                aria-label="Send message"
                title="Send (Enter)"
                onClick={() => void send()}
              >
                <Icon name="arrow" size={12} />
              </button>
            ) : (
              <button
                type="button"
                className={toolbarSquareClass}
                aria-label="Start voice dictation"
                title={
                  dictationConstructor()
                    ? "Start voice dictation"
                    : "Voice dictation is not supported by this runtime"
                }
                disabled={!dictationConstructor()}
                onClick={toggleDictation}
              >
                <Icon name="mic" size={12} />
              </button>
            )}
          </div>
        </div>
        {menu === "model" && (
          <div
            className="absolute bottom-12 z-20 max-h-[min(440px,65vh)] overflow-y-auto rounded border border-input bg-white p-1 text-[12px] shadow-[0_8px_12px_#0002] left-11 w-[308px]"
            role="menu"
            aria-label="Models"
            onKeyDown={menuNavigation}
          >
            {defaults?.models.map((option) => (
              <button
                role="menuitemradio"
                aria-checked={settings.model === option.slug}
                key={option.slug}
                className="flex w-full items-center justify-between gap-3 rounded-[2px] px-2.5 py-[9px] text-left hover:bg-muted focus:bg-muted disabled:text-muted-foreground disabled:hover:bg-white"
                onClick={() => {
                  setOverrides((prev) => ({
                    ...prev,
                    model: option.slug,
                    effort: undefined,
                    fast: option.supportsFast ? prev.fast : false,
                  }));
                  setMenu(null);
                  inputRef.current?.focus();
                }}
              >
                <span>{option.displayName}</span>
                {settings.model === option.slug && <span>✓</span>}
              </button>
            ))}
            <div className="mt-1 border-t border-border px-2.5 py-2 [&_label]:flex [&_label]:items-center [&_label]:justify-between [&_label]:gap-3 [&_label]:py-[5px] [&_select]:rounded-[2px] [&_select]:border [&_select]:border-input [&_select]:bg-white [&_select]:px-1.5 [&_select]:py-[3px] [&_select]:capitalize">
              <label>
                Reasoning
                <select
                  aria-label="Reasoning effort"
                  value={settings.effort ?? ""}
                  onChange={(event) =>
                    setOverrides((prev) => ({
                      ...prev,
                      effort: event.target.value,
                    }))
                  }
                >
                  {(model?.efforts ?? []).map((effort) => (
                    <option key={effort}>{effort}</option>
                  ))}
                </select>
              </label>
              {model?.supportsFast && (
                <label>
                  Fast
                  <input
                    type="checkbox"
                    aria-label="Fast model"
                    checked={settings.fast}
                    onChange={(event) =>
                      setOverrides((prev) => ({
                        ...prev,
                        fast: event.target.checked,
                      }))
                    }
                  />
                </label>
              )}
            </div>
          </div>
        )}
        {menu === "mode" && (
          <div
            className="absolute bottom-12 z-20 max-h-[min(440px,65vh)] overflow-y-auto rounded border border-input bg-white p-1 text-[12px] shadow-[0_8px_12px_#0002] left-[min(260px,20%)] w-[min(390px,calc(100%_-_16px))]"
            role="menu"
            aria-label="Work mode"
            onKeyDown={menuNavigation}
          >
            <button
              role="menuitemradio"
              aria-checked={workMode === "normal"}
              className="flex w-full items-center justify-between gap-3 rounded-[2px] px-2.5 py-[9px] text-left hover:bg-muted focus:bg-muted disabled:text-muted-foreground disabled:hover:bg-white [&_strong]:block [&_strong]:font-medium [&_small]:mt-[5px] [&_small]:block [&_small]:text-[11px] [&_small]:whitespace-normal [&_small]:text-muted-foreground"
              onClick={() => {
                setWorkMode("normal");
                setMenu(null);
                inputRef.current?.focus();
              }}
            >
              <span>
                <strong>Normal Mode</strong>
                <small>The default way of working with your agent.</small>
              </span>
              {workMode === "normal" && <span>✓</span>}
            </button>
            <button
              role="menuitemradio"
              aria-checked={workMode === "spec"}
              className="flex w-full items-center justify-between gap-3 rounded-[2px] px-2.5 py-[9px] text-left hover:bg-muted focus:bg-muted disabled:text-muted-foreground disabled:hover:bg-white [&_strong]:block [&_strong]:font-medium [&_small]:mt-[5px] [&_small]:block [&_small]:text-[11px] [&_small]:whitespace-normal [&_small]:text-muted-foreground"
              onClick={() => {
                setWorkMode("spec");
                setMenu(null);
                inputRef.current?.focus();
              }}
            >
              <span>
                <strong>Spec Mode</strong>
                <small>Research and create a plan before making changes.</small>
              </span>
              {workMode === "spec" && <span>✓</span>}
            </button>
            <button
              role="menuitem"
              className="flex w-full items-center justify-between gap-3 rounded-[2px] px-2.5 py-[9px] text-left hover:bg-muted focus:bg-muted disabled:text-muted-foreground disabled:hover:bg-white [&_strong]:block [&_strong]:font-medium [&_small]:mt-[5px] [&_small]:block [&_small]:text-[11px] [&_small]:whitespace-normal [&_small]:text-muted-foreground"
              disabled
              title="The local runner does not support parallel missions"
            >
              <span>
                <strong>Mission Mode</strong>
                <small>
                  Plan and ship long-horizon projects with agents working in
                  parallel.
                </small>
              </span>
            </button>
          </div>
        )}
      </div>
      {(shownError || busyElsewhere) && (
        <p
          className="mx-auto mt-1.5 max-w-[736px] text-[12px] text-danger [overflow-wrap:anywhere]"
          role="status"
        >
          {shownError ?? "对话正在由其他进程执行"}
        </p>
      )}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/20"
          onClick={() => setHelpOpen(false)}
        >
          <div
            ref={helpDialogRef}
            className="max-h-[70vh] w-[min(520px,90vw)] overflow-y-auto rounded border border-border bg-white p-5 text-[12px] text-foreground shadow-[0_8px_12px_#0002] [&_header]:mb-5 [&_header]:flex [&_header]:items-center [&_header]:justify-between [&_h2]:text-base [&_h2]:font-medium [&_p]:leading-[1.6] [&_p]:text-subtle-foreground [&_h3]:mt-[18px] [&_h3]:mb-2 [&_h3]:text-[10px] [&_h3]:font-medium [&_h3]:text-muted-foreground [&_p]:flex [&_p]:items-center [&_p]:justify-between [&_p]:gap-4 [&_p]:py-[5px] [&_p_span]:text-muted-foreground [&_kbd]:rounded-[3px] [&_kbd]:border [&_kbd]:border-input [&_kbd]:px-1.5 [&_kbd]:py-px [&_kbd]:font-[inherit] [&_kbd]:text-[11px] [&_kbd]:text-muted-foreground"
            role="dialog"
            aria-modal="true"
            aria-label="Shortcuts & Modes"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>Shortcuts & Modes</h2>
              <button
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-[2px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close shortcuts"
                onClick={() => setHelpOpen(false)}
              >
                <Icon name="close" size={12} />
              </button>
            </header>
            <h3>INPUT</h3>
            <p>
              Send message <kbd>Enter</kbd>
            </p>
            <p>
              New line <kbd>Shift Enter</kbd>
            </p>
            <p>
              Command palette <kbd>⌘ K</kbd>
            </p>
            <p>
              Clear input <kbd>Esc Esc</kbd>
            </p>
            <p>
              Stop generating <kbd>Esc</kbd>
            </p>
            <h3>MODES</h3>
            <p>
              Spec <span>Research and plan only</span>
            </p>
            <h3>AUTONOMY</h3>
            {AUTONOMY.map((level) => (
              <p key={level}>
                {level[0].toUpperCase() + level.slice(1)}
                <span>{AUTONOMY_DESCRIPTION[level]}</span>
              </p>
            ))}
            <h3>SHORTCUTS</h3>
            <p>
              Toggle spec mode <kbd>Shift Tab</kbd>
            </p>
            <p>
              Cycle reasoning level <kbd>Tab</kbd>
            </p>
            <p>
              Open model selector <kbd>Ctrl N</kbd>
            </p>
            <p>
              Cycle autonomy level <kbd>⌘ L</kbd>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
function menuNavigation(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  const options = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    ),
  ];
  const index = options.indexOf(document.activeElement as HTMLButtonElement);
  options[
    (index +
      (event.key === "ArrowDown" ? 1 : options.length - 1) +
      options.length) %
      options.length
  ]?.focus();
}
function resolveSettings(
  defaults: Defaults | null,
  thread: ThreadSummary | null,
  overrides: Overrides,
) {
  const model =
    overrides.model ??
    thread?.model ??
    defaults?.model ??
    defaults?.models[0]?.slug ??
    null;
  const option = defaults?.models.find((item) => item.slug === model) ?? null;
  const fallbackEffort =
    model === defaults?.model ? defaults?.effort : option?.defaultEffort;
  return {
    cwd: overrides.cwd ?? thread?.cwd ?? defaults?.recentCwds[0] ?? null,
    model,
    effort:
      overrides.effort ??
      (overrides.model
        ? option?.defaultEffort
        : (thread?.reasoningEffort ?? fallbackEffort)) ??
      option?.efforts[0] ??
      null,
    fast: overrides.fast ?? defaults?.fast ?? false,
  };
}
