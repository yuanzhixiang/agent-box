# Agent Box 规格入口

Agent Box 是查看和发起本地 `codex exec` 对话的 Electron 桌面应用。界面使用 Factory 的标志、Geist 字体及侧栏、时间线、输入框样式；数据和执行能力来自本地 Codex。

- [主进程与本地数据](src/main/README.md)：数据读取、IPC、进程及权限边界。
- [界面与交互](src/renderer/src/README.md)：页面、工具栏、已知限制。
- [共享接口](src/shared/types.md)：主进程与渲染进程之间的数据口径。
- [开发命令](package.md)：依赖、检查和构建入口。
- 文件级规格镜像源码路径；目录级规格描述多个文件共同承担的行为。

本项目没有云端 Factory 服务、独立账号认证、定时任务服务或并行 Mission 执行器，也没有生成独立 `.app` 安装包的配置。`out/` 是构建产物，不是规格来源。
