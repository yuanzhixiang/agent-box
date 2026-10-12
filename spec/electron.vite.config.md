# Electron Vite 构建配置

配置划分 main、preload、renderer 三个构建目标。main 和 preload 使用默认配置；renderer 使用 React 和 Tailwind Vite 插件。

渲染层 @renderer 别名指向 src/renderer/src。没有在此配置额外服务端接口、发布流程或安装包生成。
