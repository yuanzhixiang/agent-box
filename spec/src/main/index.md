# Electron 窗口与 IPC

窗口初始为 1060 × 700 逻辑像素，最小 900 × 600，居中以普通窗口启动，不自动最大化或进入全屏。窗口为白色背景，hiddenInset 标题栏。开发环境加载 ELECTRON_RENDERER_URL，其他环境加载构建的 renderer HTML。macOS 关闭所有窗口后保留应用，再激活时按相同默认尺寸重建窗口；其他平台退出。退出前停止本应用管理的任务。

contextIsolation 开启，nodeIntegration 关闭，sandbox 关闭；preload 提供固定 API。新窗口请求被拒绝，主窗口离开当前 URL 的导航被拦截；仅 http(s) 链接交给系统浏览器。

| IPC                              | 行为                                   |
| -------------------------------- | -------------------------------------- |
| threads:list                     | 按筛选返回摘要和运行状态               |
| thread:get                       | 返回完整详情；ID 不存在返回 null       |
| thread:subscribe / unsubscribe   | 调整 rollout 文件订阅                  |
| defaults:get                     | 返回本地默认设置                       |
| dialog:pick-directory            | 原生目录选择；取消返回 null            |
| dialog:pick-attachments          | 原生多文件选择；取消返回空数组         |
| run:start / resume / stop / list | 创建、续问、停止或查询本应用管理的运行 |

附件过滤器包含图片、PDF、文本、Markdown、JSON、HTML、YAML、XML、CSV、DOCX、XLSX，不提供内容校验或解析。

数据库指纹每 2 秒比对，变化发出 threads:changed。文件变化发 thread:patch 和列表刷新通知；进程起停另外推送空 items 的状态 patch。运行状态来自本应用进程或最近 30 分钟的未结束 rollout 回合。

接口没有通用运行时参数校验。对话详情、默认目录和文件读取失败不统一转换为用户可恢复的错误结构；列表轮询错误输出到主进程日志。
