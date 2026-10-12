# 侧栏与项目列表

侧栏使用 Factory 标志，可折叠为图标栏。New Session 返回新会话页；Search 或 Cmd/Ctrl+K 切换搜索并展开侧栏。Escape 关闭搜索与侧栏弹层，不清空关键词。

关键词停顿 200 毫秒后查询主进程，并在 threads:changed 时重查；查询失败显示错误。查询始终传 cwd=null，项目过滤在前端按精确 cwd 完成。项目选项来自当前查询结果，按会话数量降序排列。

点击项目标题在该项目和全部项目之间切换。各项目默认最多显示 5 条，Show more/less 共用一个展开状态。会话标题单行省略，时间显示 now/m/h/d，运行中显示圆点，点击选中会话。

Projects 弹层选择项目或全部。Mission Control 只显示当前查询结果中运行的会话并支持跳转。Automations 显示未接入说明；Account 固定显示 Max Arden / Local workspace；Settings 是本地设置入口说明，不修改配置。

弹层支持点击背景、关闭按钮或 Escape 关闭。侧栏折叠时隐藏列表及账号文字。查询上限来自主进程，不提供分页，也不持久化搜索、展开和项目过滤状态。

布局、颜色、状态与响应式样式使用 Tailwind 工具类及变体，不依赖自定义组件 CSS 选择器。
