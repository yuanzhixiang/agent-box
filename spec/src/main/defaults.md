# 默认设置与模型目录

配置只解析首个 `[table]` 之前的 `key = "value"` 字符串，不是完整 TOML 解析器。配置读取失败时使用空配置。

模型目录保留 `visibility = 'list'` 的模型，按 priority 升序提供 slug、显示名、可选推理档位和默认档位；包含 priority service tier 时标记支持 Fast。缓存不存在或解析失败时返回空模型列表。

默认模型、推理档位来自顶层配置；仅 `service_tier = "priority"` 使默认 Fast 为 true。最近工作目录通过状态库读取，最多 15 个；数据库读取错误没有在此处转为默认空目录。
