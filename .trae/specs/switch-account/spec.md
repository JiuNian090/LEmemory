# 切换账号 Spec

## Why
用户需要在设置页面中快速切换到另一个账号登录，而无需手动退出再重新进入登录页。当前仅支持"退出登录"，缺少直接的"切换账号"入口。

## What Changes
- 设置页「账号安全」区块新增"切换账号"菜单项
- 点击后弹出半屏确认面板，提示将清除当前登录态
- 确认后清除本地登录数据，跳转登录页完成切换
- 登录页保持原有"记住密码"自动填充逻辑，方便用户快速切换

## Impact
- Affected specs: 无
- Affected code:
  - `miniprogram/pages/settings/settings.wxml` — 新增菜单项 + 半屏确认 sheet
  - `miniprogram/pages/settings/settings.ts` — 新增切换账号方法、sheet 状态管理
  - `miniprogram/pages/settings/settings.wxss` — 复用已有 `.sheet-*` 样式，无需新增
  - `miniprogram/pages/login/login.ts` — 对切换账号场景透明，无需改动

## ADDED Requirements

### Requirement: 切换账号菜单入口
系统 SHALL 在设置页面「账号安全」区块中「修改密码」下方提供"切换账号"菜单项。

#### Scenario: 用户看到切换账号入口
- **WHEN** 用户已登录并进入设置页面
- **THEN**「账号安全」区块显示"切换账号"菜单行，图标为 🔄
- **AND** 该行右侧显示 `›` 箭头指示可点击

#### Scenario: 未登录时不显示
- **WHEN** 用户未登录
- **THEN** 不显示"切换账号"菜单项（整个设置页面显示"请先登录"）

### Requirement: 切换账号半屏确认
系统 SHALL 在用户点击"切换账号"后弹出半屏底部确认面板，使用与修改昵称/密码相同的 `.sheet-*` 底部弹出样式。

#### Scenario: 弹出确认面板
- **WHEN** 用户点击"切换账号"
- **THEN** 半屏面板从底部滑入，标题显示"切换账号"
- **AND** 面板内容显示提示文字："切换账号将清除当前登录状态，确定要切换吗？"
- **AND** 面板底部显示"取消"和"确认切换"两个按钮
- **AND** "确认切换"按钮使用主色渐变背景

#### Scenario: 取消切换
- **WHEN** 用户在半屏面板中点击"取消"或点击遮罩层
- **THEN** 半屏面板滑出消失
- **AND** 不执行任何数据清除操作

### Requirement: 切换账号执行逻辑
系统 SHALL 在用户确认切换后清除所有本地登录态并跳转到登录页面。

#### Scenario: 确认切换账号
- **WHEN** 用户在半屏面板中点击"确认切换"
- **THEN** 系统关闭半屏面板
- **AND** 显示 Toast "正在切换账号..."
- **AND** 清除 `app.globalData.userInfo`（设为 null）
- **AND** 删除本地 Storage 中的 `userInfo`
- **AND** 保留本地 Storage 中的 `savedCredentials`（以便登录页自动填充）
- **AND** 调用 `wx.reLaunch` 跳转到登录页 `/pages/login/login`

#### Scenario: 保留记住密码凭据
- **WHEN** 用户之前登录时选择了"记住密码"
- **AND** 用户执行切换账号
- **THEN** `savedCredentials` 不会被清除
- **AND** 登录页自动填充上次保存的用户名和密码
- **AND** 用户可直接点击登录，或修改用户名密码登录其他账号
