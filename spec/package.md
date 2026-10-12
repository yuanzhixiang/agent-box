# 包与开发命令

项目名为 agent-box，是私有 pnpm 项目，包管理器声明为 pnpm@11.21.0。Electron 入口是 out/main/index.js。技术栈为 Electron 44、React 19、electron-vite 5、Vite 7、Tailwind CSS 4、TypeScript 5.9。

| 命令           | 行为                                          |
| -------------- | --------------------------------------------- |
| pnpm install   | 安装锁文件约束下的项目依赖                    |
| pnpm dev       | electron-vite 开发应用及渲染层热更新          |
| pnpm typecheck | 分别检查 Node 与渲染层 TypeScript，不输出文件 |
| pnpm build     | 先类型检查，再构建 Electron 应用到 out/       |
| pnpm preview   | 运行构建预览                                  |
| pnpm lint      | ESLint 检查仓库                               |
| pnpm format    | Prettier 写入格式化整个仓库                   |

没有 test script 或独立安装包生成脚本。依赖安装和开发进程的超时、停止与端口清理遵循根目录 AGENTS.md。
