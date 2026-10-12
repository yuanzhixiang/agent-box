# IPC 数据契约

ThreadSummary 包含 ID、标题、cwd、模型、推理档位、创建与更新时间、token 用量、rollout 路径及 running/idle 状态。时间戳和时长使用毫秒；缺失模型与档位为 null。

ThreadDetail 包含摘要、时间线和可为空的 token 统计。ThreadPatch 指定 threadId、reset、items、status、tokens；reset 为 true 时整体替换条目，否则追加。渲染详情遇到 null token patch 时保留已有统计。

TimelineItem 按 kind 区分用户、agent、推理、命令、文件改动、MCP、图片、压缩、回合起止、其他条目。工具状态为 in_progress/completed/failed/declined，未知退出码和时长保留 null；图片以路径表示。

Defaults 包含模型、推理档位、Fast、模型选项及最近目录。ModelOption 提供 slug、显示名、支持的档位、默认档位及 Fast 能力。

TaskOptions 必须包含 prompt、cwd、model、effort、fast，可选自主级别 low/medium/high、工作模式 normal/spec、本地附件路径数组。ResumeOptions 另含 threadId。ListFilter 包含 query 和可为空的 cwd。

RunInfo 区分 runId 和可为空的 threadId，记录运行标记、退出码、错误和 stderr 尾部。AgentBoxApi 的请求均为 Promise；三类事件订阅返回取消函数。此文件是类型声明，不进行运行时值校验。
