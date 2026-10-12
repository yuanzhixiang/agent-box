# 渲染 TypeScript 配置

渲染配置包含 renderer 源码、preload 声明和 shared。目标 ES2023，使用 DOM/DOM.Iterable，React JSX 自动运行时、ESNext 模块及 Bundler 解析。

开启 strict、未使用变量和参数检查及 isolatedModules；skipLibCheck 跳过依赖声明检查。@renderer/* 映射到 src/renderer/src/*。
