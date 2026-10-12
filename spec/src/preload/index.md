# 渲染进程桥接

contextBridge 向 window 暴露 `agentBox`，对应共享 AgentBoxApi。查询、目录和附件选择、启动/续问/停止任务通过固定 IPC channel 的 invoke 返回 Promise。

thread:patch、threads:changed、runs:changed 通过事件订阅推送；订阅方法返回移除对应监听器的函数。Electron 事件对象不传给渲染层。

桥接不暴露通用 ipcRenderer 或任意 channel 调用，也不额外转换主进程返回值或异常。
