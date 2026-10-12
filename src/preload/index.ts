import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { AgentBoxApi, RunInfo, ThreadPatch } from "../shared/types";

/** 订阅主进程推送，返回取消订阅函数 */
function on<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const api: AgentBoxApi = {
  listThreads: (filter) => ipcRenderer.invoke("threads:list", filter),
  getThread: (id) => ipcRenderer.invoke("thread:get", id),
  subscribeThread: (id) => ipcRenderer.invoke("thread:subscribe", id),
  unsubscribeThread: (id) => ipcRenderer.invoke("thread:unsubscribe", id),
  getDefaults: () => ipcRenderer.invoke("defaults:get"),
  pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory"),
  startTask: (options) => ipcRenderer.invoke("run:start", options),
  resumeTask: (options) => ipcRenderer.invoke("run:resume", options),
  stopRun: (runId) => ipcRenderer.invoke("run:stop", runId),
  listRuns: () => ipcRenderer.invoke("run:list"),
  onThreadPatch: (listener) => on<ThreadPatch>("thread:patch", listener),
  onThreadsChanged: (listener) => on<void>("threads:changed", () => listener()),
  onRunsChanged: (listener) => on<RunInfo[]>("runs:changed", listener),
};

contextBridge.exposeInMainWorld("agentBox", api);
