# Codex 路径与可执行文件

`codexHome` 优先使用环境变量 `CODEX_HOME`，否则是用户目录下的 `.codex`。状态库、配置和模型缓存分别为 `state_5.sqlite`、`config.toml`、`models_cache.json`。

子进程 PATH 在原 PATH 后补齐 `~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`、`/bin` 并去重，兼容 Finder 启动时不含 shell 配置的环境。

Codex 可执行文件按这些补齐目录的顺序检查是否存在；都不存在时使用 `codex` 交由 PATH 解析。存在性检查不验证可执行权限或版本。
