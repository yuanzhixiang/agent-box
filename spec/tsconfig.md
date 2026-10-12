# TypeScript 项目入口

根配置没有直接文件，引用 tsconfig.node.json 和 tsconfig.web.json，将 Node 与渲染进程检查边界分开。typecheck 脚本显式执行两个子配置。
