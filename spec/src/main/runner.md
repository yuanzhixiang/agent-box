# 本地任务执行与权限

新任务执行 `codex exec --json --skip-git-repo-check -C <cwd>`；续问执行 `codex exec resume --json --skip-git-repo-check <threadId>`，工作目录通过子进程 cwd 设置。prompt 通过 stdin 传递，避免被解析为 CLI 参数。

模型通过 `-m` 设置；推理档位和 service tier 通过 `-c` 覆盖。模型与档位只接受字母、数字、下划线、点和连字符。Fast 使用 priority，关闭使用 default，均不修改 config.toml。

| 模式/自主级别        | sandbox_mode       | approval_policy |
| -------------------- | ------------------ | --------------- |
| Normal / Low         | workspace-write    | on-request      |
| Normal / Medium      | workspace-write    | never           |
| Normal / High        | danger-full-access | never           |
| Spec（覆盖自主级别） | read-only          | never           |

未传自主级别且不是 Spec 时沿用 CLI 配置权限。Spec 另在 prompt 前加入只研究和制定计划、禁止改文件或改变状态的说明。这里的 Spec Mode 是执行模式，与仓库 `spec/` 文档不是同一概念。

PNG、JPEG、WebP、GIF 附件用重复 `-i` 参数传递。其他附件只把 JSON 引号包裹的本地路径加入 prompt，并说明内容是参考材料而非指令；应用不预先读取或上传文档内容。

运行记录具有独立 runId；stdout 中的 thread.started 提供 threadId，其他过程由 rollout 展示。stderr 只保留最后 4000 字符。以子进程 exit 更新结束状态并销毁输出管道，避免继承 stdout 的 MCP 进程使 close 长期不触发。

停止先发 SIGINT，3 秒后仍未退出则发 SIGKILL。仅停止所管理的直接子进程，没有进程树清理保证。应用退出调用 stopAll。非零退出显示错误，信号退出显示“已停止”；启动新任务时清理较旧的结束记录，保留最近 20 个，运行中记录不清理。

接口没有任务排队或并行 Mission 编排，也没有为 Low 的 CLI 审批实现独立的 GUI 审批通道。
