---
alwaysApply: false
description: 项目规则
---
# 背记本小程序 - TraeIDE 项目规则

## 1. 项目基础约束
- 项目：微信小程序「EMemory」，使用官方 **TS-基础模版**，开发语言为 TypeScript + WXML + WXSS。
- 目录结构：严格遵循开发文档定义，所有文件必须放在指定目录下，不得随意新增/修改顶层结构。
- 后端：使用微信云开发，所有数据库、云函数操作按文档设计实现。
- 语言：全程使用中文沟通，代码注释、变量命名、错误提示都以中文为主。

## 2. 目录与文件规范
- 页面文件必须位于 `miniprogram/pages/[pageName]/`，包含 `.ts` / `.wxml` / `.wxss` / `.json` 四个文件。
- 公共组件放在 `miniprogram/components/[componentName]/`。
- 工具函数、类型定义统一放在 `miniprogram/utils/`：
  - `types.ts`：定义所有全局类型（User / CardGroup / Card / StudyRecord / Favorite）
  - `db.ts`：封装所有云数据库通用操作
  - `time.ts`：封装时间格式化、计时相关工具
- 静态资源统一放在 `miniprogram/images/`，禁止引用外部CDN资源。

## 3. TypeScript 规范
- 所有业务逻辑文件必须使用 TypeScript，禁止使用 `any` 类型，必须用 `utils/types.ts` 中定义的类型。
- 开启严格模式（`tsconfig.json` 中 `strict: true`）。
- 变量/函数命名使用小驼峰，常量使用全大写下划线分隔。
- 函数必须添加 JSDoc 注释，说明功能、参数和返回值。

## 4. 数据库与云函数规范
- 集合：严格按文档设计的 `users` / `cardGroups` / `cards` / `studyRecords` / `favorites` 实现，字段名必须与文档完全一致。
- 权限：云数据库所有集合权限设置为「仅创建者可读写」，所有查询必须携带 `userId`（_openid）过滤条件。
- 数据库操作：所有读写操作必须封装在 `utils/db.ts` 中，禁止在页面 `.ts` 中直接调用 `wx.cloud.database()`。
- 云函数：每个函数对应单一功能，必须返回统一格式 `{ success: boolean, data: any, message: string }`，包含错误处理。

## 5. 页面开发强制规则
### 通用页面
- 所有列表必须实现分页加载（`skip + limit`），避免一次性加载过多数据。
- 所有用户操作（增删改查、收藏）必须添加 `wx.showLoading` 和 `wx.showToast` 提示，失败需给出明确错误信息。

### 学习页（pages/study）
- 卡牌组列表展示标题、描述、更新时间，支持下拉刷新。
- 创建卡牌组弹窗必须做表单校验，标题不能为空。
- 点击卡牌组必须跳转到 `cardDetail` 页，传递 `groupId` 参数。

### 卡牌详情页（pages/cardDetail）
- 必须实现「学习/目录/卡牌/收藏」四个标签页切换。
- 学习页必须实现：翻牌动画、左右滑动切换卡牌、自动计时（`onShow` 启动，`onHide` 停止并保存记录）。
- 卡牌页支持 添加/编辑/删除卡牌，删除操作需二次确认。
- 收藏页仅展示当前卡牌组内的收藏卡牌，支持取消收藏。

### 统计页（pages/statistics）
- 使用 `ec-canvas` 实现：总时长展示、卡牌组时长柱状图、近7天学习趋势折线图。
- 所有统计数据必须从 `statistics_get` 云函数获取，禁止前端本地计算。

### 我的页（pages/mine）
- 未登录状态显示「点击登录」按钮，登录后展示用户头像、昵称。
- 调用 `wx.getUserProfile` 获取用户信息并同步到 `users` 集合，需实现本地缓存。

## 6. 组件开发规范
- 公共组件：`flipCard`（翻牌组件）、`cardGroupItem`（卡牌组列表项）必须按设计实现属性和事件。
- 组件需支持 `wx:if` / `wx:for` 渲染，样式需兼容不同屏幕尺寸。

## 7. 错误处理与调试
- 所有异步操作（数据库/云函数调用）必须用 `try/catch` 包裹，捕获错误后调用 `wx.showToast` 提示用户。
- 日志格式统一为 `[模块名] 操作描述：错误信息`，如 `[StudyPage] 创建卡牌组失败：xxx`。
- 禁止直接 `throw new Error()`，所有异常必须在页面或组件内处理。

## 8. 迭代与修改规则
- 任何需求变更，必须先更新项目文档/规则，再进行代码修改。
- 修改前需先说明修改范围、影响的文件和模块，经确认后再执行。
- 提交修改时，必须说明修改内容、原因和验证方式。