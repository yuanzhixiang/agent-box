# 默认设置 Hook

getDefaults 的 Promise 在模块内缓存，整个渲染会话只请求一次。加载完成前返回 null，卸载组件不再更新本地 state。

缓存不会主动刷新本地配置或模型目录；读取失败没有在 Hook 中捕获或重试。
