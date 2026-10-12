# 仓库协作规范

使用 pnpm 替代 npm 命令。

## 防止 Codex 会话卡住

- 长任务先拆成短阶段；每个阶段完成后先验证并交付，不要让一个 Goal 连续跑数小时。
- 所有长命令都必须有明确超时或可中断策略；`pnpm add`、`pnpm install`、`pnpm dlx`、dev server、浏览器截图都不能无限等待。
- 启动 dev/debug server 后必须记录 PID 和端口，最终响应前停止它，并确认端口已经释放。
- 本地网页验证优先使用 Codex Browser 插件；不要默认启动自定义 Playwright MCP 或 `pnpm dlx @playwright/mcp`。
- 截图、MCP、compact 或 reconnect 失败时，不要反复重试堆上下文；先清理残留进程，交付当前状态和下一步。
- 大 bundle 只做定向读取和统计；不要把 10MB 级文件、大 diff 或完整编译产物灌进上下文。

## 浏览器验证规范

- 首选 Codex Browser 插件的 in-app browser：通过 `mcp__node_repl__js` 加载 Browser 插件的 `scripts/browser-client.mjs`，再使用 `agent.browsers.get("iab")`。
- 不要把外部 Playwright MCP 当作默认浏览器工具：不要默认使用 `mcp__playwright__browser_*`、自定义 `@playwright/mcp`、`pnpm dlx @playwright/mcp`、`npx @playwright/mcp` 或独立 Playwright CLI。
- Browser 插件 bootstrap 失败时，只重试一次；仍失败就停止该路径，说明当前状态，改用非浏览器验证或请求用户确认 fallback。
- 只有在用户明确要求、Browser 插件不可用且已有明确原因，或任务确实需要独立 Playwright 能力时，才允许 fallback 到 `gstack browse` 或 Playwright CLI。
- 使用 `gstack browse`、Playwright CLI、dev/debug server 或任何会常驻的浏览器进程时，必须记录 PID、端口和临时目录；最终响应前停止进程并确认端口释放。
- 如果出现 Playwright MCP 断连、handshake timeout、compact/reconnect 中断或截图失败，不要循环重试同一 MCP；先检查并清理 `gstack/browse`、`chrome-headless-shell`、`@playwright/mcp` 等残留进程，再交付当前验证结果和下一步。

## Spec 文档

项目文档统一写入 `spec/`，不再新增旧的编号式决策目录或旧的日志目录。`spec/` 是源码镜像的产品需求与行为规格文档，用于记录页面/组件 UI/UX、API 行为、业务规则、接口口径、权限约束、已知限制和非目标。

这里放的是规格，不是计划。它用现在时描述系统当前如何行为。打算做什么、路线图、还在权衡的方案都不属于这里——一份描述尚未实现之物的 spec，本身就是这份 spec 的 bug。

### 读源码时同步读 spec

**打开任何源码文件时，一并打开它对应的 spec。** 这条不限于修改场景：读代码回答问题、追查 bug、判断某处要不要改，同样适用。源码说的是代码做了什么，spec 说的是为什么这么做、什么被刻意省略、哪些约束是承重的。只读其一会得出自信而错误的结论——把 workaround 当冗余「简化」掉，或者去「修复」一个刻意为之的行为。

源码没有对应 spec 时，明确说出来，不要默认它就没有上下文。缺失的 spec 是待补的缺口，不是「这个文件不言自明」的证据。

### 目录结构

- 每个子项目维护自己的 `spec/`，路径镜像该项目内的源码相对路径。
- 文件级说明将源码扩展名替换成 `.md`：`src/foo/bar.ts` 对应 `spec/src/foo/bar.md`。
- 页面和 API route 对齐源码入口：`page.tsx` 对应 `page.md`，`route.ts` 对应 `route.md`。
- 组件级说明同样镜像组件源码路径，例如 `src/components/foo/bar.tsx` 对应 `spec/src/components/foo/bar.md`。
- 多个文件共同承担的能力、体验规范或系统规则，写到最近源码目录的 `README.md`。
- 全仓库或根目录文件的说明写到仓库根 `spec/`，同样镜像根目录路径，例如 `.prettierrc.mjs` 对应 `spec/.prettierrc.md`。

### 代码与规格同步维护

新增源码时同时补齐对应 spec；修改 UI/UX、API、业务规则、权限或已知限制时，在同一变更中更新对应 spec 和相关目录级 `README.md`。规格以当前实现及验证结果为依据，不把未实现的功能写成现有行为。发现源码与 spec 不一致时，先核对既有约束，再同步修正，不仅修改其中一份。

根目录 `README.md` 只作为项目入口，指向 `spec/`；产品行为和开发配置说明统一维护在 `spec/`。
