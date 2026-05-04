# Tasks

- [x] Task 1: WXML — 「账号安全」区块新增"切换账号"菜单行
  - 在"修改密码"行下方新增 `<view class="menu-item" bindtap="showSwitchAccount">`
  - 图标 🔄，文字"切换账号"，右侧 `›` 箭头
  - 确认该行仅在 `wx:if="{{userInfo}}"` 时显示（复用区块级已有条件）

- [x] Task 2: TS — 新增切换账号状态和方法
  - 在 `SettingsPageData` 接口中新增 `showSwitchSheet: boolean`
  - 在 `data` 中初始化 `showSwitchSheet: false`
  - 新增 `showSwitchAccount()` 方法：设置 `showSwitchSheet: true`
  - 新增 `hideSwitchSheet()` 方法：设置 `showSwitchSheet: false`
  - 新增 `confirmSwitchAccount()` 方法：
    - 关闭 sheet（`showSwitchSheet: false`）
    - 显示 Toast "正在切换账号..."
    - 清除 `app.globalData.userInfo = null`
    - 删除 `wx.removeStorageSync('userInfo')`
    - **保留** `savedCredentials`（不删除）
    - 延时 800ms 后 `wx.reLaunch({ url: '/pages/login/login' })`

- [x] Task 3: WXML — 新增切换账号半屏确认 sheet
  - 在密码 sheet 下方新增一组 mask + panel（复用 `.sheet-*` 样式）
  - mask: `{{showSwitchSheet ? 'sheet-mask--show' : ''}}` + `bindtap="hideSwitchSheet"`
  - panel: `{{showSwitchSheet ? 'sheet-panel--show' : ''}}`
  - 标题："切换账号"
  - 内容：文字提示"切换账号将清除当前登录状态，确定要切换吗？"
  - 按钮："取消"（`bindtap="hideSwitchSheet"`）、"确认切换"（`bindtap="confirmSwitchAccount"`）
  - "确认切换"按钮使用 `sheet-btn--danger`（红色警告风格，与退出登录一致）

- [x] Task 4: WXSS — 新增危险按钮样式
  - 新增 `.sheet-btn--danger` 样式：红色渐变背景 `linear-gradient(135deg, #f87171, #ef4444)`，白色文字
  - 该样式用于"确认切换"按钮，与切换/退出等破坏性操作视觉一致

# Task Dependencies
- Task 3 依赖 Task 2（需要 TS 方法绑定到 WXML）
- Task 4 依赖 Task 3（按钮需要对应样式）
- Task 1 无依赖，可与 Task 2 并行
