# 新会话页

标题栏显示 New Session，欢迎区域显示“What can I help you with?”和“Start a session in your workspace.”。底部挂载 new 模式 Composer。

取得新建会话 ID 时通过 onThreadCreated 交给外壳切换详情；页面本身不执行 CLI 或持久化表单。

布局、颜色、状态与响应式样式使用 Tailwind 工具类及变体，不依赖自定义组件 CSS 选择器。
