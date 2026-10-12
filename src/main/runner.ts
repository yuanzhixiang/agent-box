import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { childPath, resolveCodexBinary } from "./codex-home";
import type { ResumeOptions, RunInfo, TaskOptions } from "../shared/types";

// stderr 只留尾巴，够看清失败原因就行
const STDERR_TAIL_CHARS = 4_000;
// 发 SIGINT 后等这么久还没退就强杀
const KILL_GRACE_MS = 3_000;
// 结束的任务在列表里保留一会儿，方便界面展示退出结果
const FINISHED_KEEP = 20;

interface Run {
  info: RunInfo;
  child: ChildProcess | null;
}

/** 管理由本应用启动的 codex exec 子进程 */
export class Runner {
  private runs = new Map<string, Run>();

  constructor(private onChange: (runs: RunInfo[]) => void) {}

  list(): RunInfo[] {
    return [...this.runs.values()].map((run) => run.info);
  }

  /** 某条对话当前是否有本应用启动的进程在跑 */
  isThreadRunning(threadId: string): boolean {
    return [...this.runs.values()].some(
      (run) => run.info.running && run.info.threadId === threadId,
    );
  }

  /** 新建一条 exec 对话 */
  start(options: TaskOptions): RunInfo {
    const args = [
      "exec",
      "--json",
      "--skip-git-repo-check",
      "-C",
      options.cwd,
      ...modelArgs(options),
      "-",
    ];
    return this.launch(args, options.cwd, options.prompt, null);
  }

  /** 在已有对话里继续追问 */
  resume(options: ResumeOptions): RunInfo {
    // resume 不支持 -C，靠子进程的 cwd 落在对话原目录
    const args = [
      "exec",
      "resume",
      "--json",
      "--skip-git-repo-check",
      ...modelArgs(options),
      options.threadId,
      "-",
    ];
    return this.launch(args, options.cwd, options.prompt, options.threadId);
  }

  /** 先礼后兵地停掉一个任务：SIGINT 让 codex 收尾，超时再 SIGKILL */
  stop(runId: string): void {
    const child = this.runs.get(runId)?.child;
    if (!child || child.exitCode !== null) {
      return;
    }
    child.kill("SIGINT");
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }, KILL_GRACE_MS);
  }

  /** 应用退出时停掉所有还在跑的任务 */
  stopAll(): void {
    for (const runId of this.runs.keys()) {
      this.stop(runId);
    }
  }

  private launch(
    args: string[],
    cwd: string,
    prompt: string,
    threadId: string | null,
  ): RunInfo {
    const runId = randomUUID();
    const info: RunInfo = {
      runId,
      threadId,
      running: true,
      exitCode: null,
      error: null,
      stderrTail: "",
    };
    const run: Run = { info, child: null };
    this.runs.set(runId, run);
    this.trim();

    // 1. 启动子进程；prompt 走 stdin，避免以 - 开头的内容被当成参数
    const child = spawn(resolveCodexBinary(), args, {
      cwd,
      env: { ...process.env, PATH: childPath() },
      stdio: ["pipe", "pipe", "pipe"],
    });
    run.child = child;
    child.stdin.end(prompt);

    // 2. 从 --json 输出里拿新对话的 id，其余过程交给 rollout 文件展示
    let stdoutBuffer = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf8");
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const id = threadIdFrom(line);
        if (id && info.threadId !== id) {
          info.threadId = id;
          this.emit();
        }
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      info.stderrTail = (info.stderrTail + chunk.toString("utf8")).slice(
        -STDERR_TAIL_CHARS,
      );
    });

    // 3. 进程结束或启动失败都更新状态
    child.on("error", (error) => {
      info.running = false;
      info.error = error.message;
      this.emit();
    });
    // 用 exit 而不是 close：codex 拉起的 MCP 服务会继承 stdout，管道可能一直不关
    child.on("exit", (code, signal) => {
      info.running = false;
      info.exitCode = code;
      if (code !== 0 && !info.error) {
        info.error = signal
          ? "已停止"
          : (lastMeaningfulLine(info.stderrTail) ?? `codex 退出码 ${code}`);
      }
      run.child = null;
      // 进程已退出，不再等残留子进程关管道
      child.stdout.destroy();
      child.stderr.destroy();
      this.emit();
    });

    this.emit();
    return info;
  }

  private emit(): void {
    this.onChange(this.list());
  }

  /** 只保留最近若干个已结束的任务 */
  private trim(): void {
    const finished = [...this.runs.values()].filter((run) => !run.info.running);
    for (const run of finished.slice(
      0,
      Math.max(0, finished.length - FINISHED_KEEP),
    )) {
      this.runs.delete(run.info.runId);
    }
  }
}

/** 模型、推理档位和是否 fast 都用 -c 覆盖，不改用户的 config.toml */
function modelArgs(options: TaskOptions): string[] {
  // 值会拼进 TOML 字符串，只接受模型名和档位常见的字符
  for (const value of [options.model, options.effort]) {
    if (!/^[\w.-]+$/.test(value)) {
      throw new Error(`非法的模型或推理档位：${value}`);
    }
  }
  return [
    "-m",
    options.model,
    "-c",
    `model_reasoning_effort="${options.effort}"`,
    "-c",
    `service_tier="${options.fast ? "priority" : "default"}"`,
  ];
}

function threadIdFrom(line: string): string | null {
  try {
    const event = JSON.parse(line) as { type?: string; thread_id?: string };
    return event.type === "thread.started" && event.thread_id
      ? event.thread_id
      : null;
  } catch {
    return null;
  }
}

function lastMeaningfulLine(text: string): string | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("warning:"));
  return lines.at(-1) ?? null;
}
