import { statSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { readDefaults } from "./defaults";
import { RolloutWatcher } from "./rollout-watcher";
import { Runner } from "./runner";
import {
  execFingerprint,
  getThreadRow,
  listExecThreads,
  type ThreadRow,
} from "./thread-store";
import type {
  ListFilter,
  ResumeOptions,
  TaskOptions,
  ThreadDetail,
  ThreadPatch,
  ThreadSummary,
} from "../shared/types";

// 列表多久检查一次数据库有没有新对话
const LIST_POLL_MS = 2_000;
// 文件最近这么久内有写入，才值得去解析它判断是否在运行
const RUNNING_CHECK_WINDOW_MS = 30 * 60 * 1000;

let mainWindow: BrowserWindow | null = null;

function send(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

// 订阅的 rollout 路径 → 对话 id，用于把文件变化转成对话增量
const pathToThread = new Map<string, string>();

const watcher = new RolloutWatcher((path, change) => {
  const threadId = pathToThread.get(path);
  if (!threadId) {
    return;
  }
  const patch: ThreadPatch = {
    threadId,
    reset: change.reset,
    items: change.items,
    status:
      change.snapshot.openTurns || runner.isThreadRunning(threadId)
        ? "running"
        : "idle",
    tokens: change.snapshot.tokens,
  };
  send("thread:patch", patch);
  send("threads:changed");
});

const runner = new Runner((runs) => {
  send("runs:changed", runs);
  send("threads:changed");
  // 进程起停会改变对话的运行状态，给打开着的对话补推一次状态（不带新条目）
  for (const path of watcher.subscribedPaths()) {
    const threadId = pathToThread.get(path);
    if (!threadId) {
      continue;
    }
    const snapshot = watcher.current(path);
    const patch: ThreadPatch = {
      threadId,
      reset: false,
      items: [],
      status:
        snapshot.openTurns || runner.isThreadRunning(threadId)
          ? "running"
          : "idle",
      tokens: snapshot.tokens,
    };
    send("thread:patch", patch);
  }
});

/** 判断对话是否在运行：本应用启动的进程还活着，或文件里有未收尾的回合 */
function statusOf(row: ThreadRow): ThreadSummary["status"] {
  if (runner.isThreadRunning(row.id)) {
    return "running";
  }
  try {
    if (
      Date.now() - statSync(row.rolloutPath).mtimeMs >
      RUNNING_CHECK_WINDOW_MS
    ) {
      return "idle";
    }
  } catch {
    return "idle";
  }
  return watcher.peekRunning(row.rolloutPath) ? "running" : "idle";
}

function toSummary(row: ThreadRow): ThreadSummary {
  return { ...row, status: statusOf(row) };
}

/** 注册界面调用的所有 IPC 接口 */
function registerIpc(): void {
  ipcMain.handle("threads:list", (_event, filter: ListFilter) =>
    listExecThreads(filter).map(toSummary),
  );

  ipcMain.handle("thread:get", (_event, id: string): ThreadDetail | null => {
    const row = getThreadRow(id);
    if (!row) {
      return null;
    }
    const snapshot = watcher.load(row.rolloutPath);
    return {
      thread: toSummary(row),
      items: snapshot.items,
      tokens: snapshot.tokens,
    };
  });

  ipcMain.handle("thread:subscribe", (_event, id: string) => {
    const row = getThreadRow(id);
    if (row) {
      pathToThread.set(row.rolloutPath, id);
      watcher.subscribe(row.rolloutPath);
    }
  });

  ipcMain.handle("thread:unsubscribe", (_event, id: string) => {
    const row = getThreadRow(id);
    if (row) {
      watcher.unsubscribe(row.rolloutPath);
    }
  });

  ipcMain.handle("defaults:get", () => readDefaults());

  ipcMain.handle("dialog:pick-attachments", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: "Attach files",
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Supported files",
          extensions: [
            "png",
            "jpg",
            "jpeg",
            "webp",
            "gif",
            "pdf",
            "txt",
            "md",
            "json",
            "html",
            "yaml",
            "yml",
            "xml",
            "csv",
            "docx",
            "xlsx",
          ],
        },
      ],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle("dialog:pick-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle("run:start", (_event, options: TaskOptions) =>
    runner.start(options),
  );
  ipcMain.handle("run:resume", (_event, options: ResumeOptions) =>
    runner.resume(options),
  );
  ipcMain.handle("run:stop", (_event, runId: string) => runner.stop(runId));
  ipcMain.handle("run:list", () => runner.list());
}

/** 定时比对数据库指纹，有新对话或更新就通知界面刷新列表 */
function watchThreadList(): void {
  let last = "";
  setInterval(() => {
    try {
      const fingerprint = execFingerprint();
      if (fingerprint !== last) {
        last = fingerprint;
        send("threads:changed");
      }
    } catch (error) {
      console.error("[agent-box] 读取对话列表失败", error);
    }
  }, LIST_POLL_MS);
}

/** 只把 http(s) 链接交给系统浏览器，相对路径和 file 链接忽略 */
function openExternalSafe(url: string): void {
  if (/^https?:\/\//.test(url)) {
    void shell.openExternal(url);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    center: true,
    fullscreen: false,
    title: "Agent Box",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 外链交给系统浏览器打开，不在应用窗口里跳转
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: "deny" };
  });
  // 回复里的 Markdown 链接点了会导航整个窗口，一律拦下，http 链接转给系统浏览器
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      openExternalSafe(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  registerIpc();
  watchThreadList();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => runner.stopAll());
