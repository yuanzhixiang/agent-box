# 应用外壳

应用由左侧 ThreadList 和右侧主区域组成。初始 selectedId 为 null，展示 NewTaskView；选择会话后展示按 ID key 挂载的 ThreadView，新建任务取得 threadId 后切换到该详情。

选择状态只在组件内存中保存，重启回到新会话页。切换不同会话会重新挂载详情并清理原订阅。

布局、颜色、状态与响应式样式使用 Tailwind 工具类及变体，不依赖自定义组件 CSS 选择器。
