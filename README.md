# Agent Box

查看和发起 `codex exec` 对话的桌面应用。

Codex app 的侧边栏只显示 app 自己创建的对话（`source=vscode`），由其他 agent 通过 `codex exec` 发起的对话（`source=exec`）不会出现。Agent Box 专门展示这部分对话，也可以直接给 Codex 派新任务或继续追问。

## 功能

- 列出所有未归档的 `codex exec` 对话，可按关键词搜索、按项目目录筛选，标出运行中的对话
- 按时间线展示一条对话：任务、回复、推理摘要、命令及输出、文件改动 diff、MCP 工具调用、回合起止和用时
- 对话运行中实时追加新内容；停在底部时自动跟随滚动
- 发新任务：选目录、模型、推理档位、是否 Fast，后台执行 `codex exec`
- 在已有对话里追问：执行 `codex exec resume <id>`；本应用启动的任务可以停止

## 数据来源

Agent Box 对 `~/.codex`（或 `CODEX_HOME`）只读：

| 数据       | 来源                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| 对话列表   | `state_5.sqlite` 的 `threads` 表，`source = 'exec'`                                                                     |
| 对话内容   | `threads.rollout_path` 指向的 `sessions/**/rollout-*.jsonl`，主要用 `item_completed` 事件，旧格式回退到 `response_item` |
| 模型和档位 | `models_cache.json`                                                                                                     |
| 表单默认值 | `config.toml` 顶层的 `model`、`model_reasoning_effort`、`service_tier`                                                  |

运行状态：rollout 里有 `task_started` 没有对应的 `task_complete` / `turn_aborted`，且文件 30 分钟内有写入，就算运行中；本应用启动的进程还活着时也算。

发任务时模型、档位和 Fast 都通过 `-c` 覆盖传给 codex，不会修改 `config.toml`。Fast 对应 `service_tier="priority"`，关闭时是 `service_tier="default"`。

## 开发

```bash
pnpm install
pnpm dev        # 启动应用（热更新渲染进程）
pnpm build      # 类型检查 + 打包到 out/
pnpm lint
```

技术栈：Electron 44（内置 Node 24，直接用 `node:sqlite`）、electron-vite、React 19、Tailwind CSS 4。

## 已知限制

- 推理内容大多是加密的，只有带摘要时才显示
- 截图类条目（ImageView）只显示文件路径，不内联展示图片
- 其他 agent 启动的任务只能看，不能从这里停止；它在运行时也不能追问，避免两个进程同时写一条对话
- 还没有配置打包成 `.app` 安装包
