# LEmemory 项目规则

## 项目概述

LEmemory 是一个基于微信小程序的闪卡学习应用，支持云开发和本地存储双模式。

## 技术栈

| 技术 | 版本/说明 |
|-----|----------|
| 开发语言 | TypeScript (主) / JavaScript (云函数) |
| 小程序框架 | 微信小程序原生 |
| 云开发 | 微信云开发 (可选) |
| 数据库 | 云数据库 / 本地存储 |
| TS配置 | 严格模式 |

## 目录结构

```
LEmemory/
├── .trae/                    # Trae IDE 配置
│   ├── documents/            # 项目文档
│   │   ├── model.md         # UI 设计规范
│   │   └── PROJECT_RULES.md # 本文件
│   ├── skills/              # 技能
│   │   ├── caveman/         # Token 优化
│   │   └── karpathy-guidelines/ # 编码规范
│   └── rules/               # 规则
├── cloudfunctions/           # 云函数
│   ├── cardGroup_operate/
│   ├── card_operate/
│   ├── statistics_get/
│   ├── studyRecord_add/
│   └── user_login/
├── miniprogram/              # 小程序代码
│   ├── components/          # 组件
│   ├── pages/               # 页面
│   ├── utils/               # 工具函数
│   │   ├── db.ts           # 数据库操作
│   │   ├── time.ts         # 时间处理
│   │   ├── types.ts        # 类型定义
│   │   └── util.ts         # 通用工具
│   ├── app.ts              # 应用入口
│   ├── app.json            # 应用配置
│   └── sitemap.json        # 站点地图
├── typings/                 # 类型声明
├── CLOUD_SETUP.md          # 云开发配置
├── project.config.json     # 项目配置
└── tsconfig.json           # TS 配置
```

## 核心数据模型

### 1. 用户 (User)
```typescript
interface User {
  _openid: string
  nickName?: string
  avatarUrl?: string
  createTime: Date
}
```

### 2. 卡牌组 (CardGroup)
```typescript
interface CardGroup {
  groupId: string
  userId: string
  title: string
  description?: string
  createTime: Date
  updateTime: Date
}
```

### 3. 卡牌 (Card)
```typescript
interface Card {
  cardId: string
  groupId: string
  userId: string
  front: string
  back: string
  createTime: Date
}
```

### 4. 学习记录 (StudyRecord)
```typescript
interface StudyRecord {
  recordId: string
  userId: string
  groupId: string
  studyDuration: number
  studyDate: Date
}
```

### 5. 收藏 (Favorite)
```typescript
interface Favorite {
  favoriteId: string
  userId: string
  cardId: string
  groupId: string
  createTime: Date
}
```

## 编码规范

### TypeScript 规范

1. **类型安全**
   - 启用 `tsconfig.json` 中的所有严格检查
   - 使用类型声明，避免 `any`
   - 所有页面和组件必须有完整的类型定义

2. **命名规范**
   - 变量/函数：`camelCase`
   - 类/接口：`PascalCase`
   - 常量：`UPPER_SNAKE_CASE`
   - 文件/目录：`snake_case` 或 `kebab-case`
   - CSS 类：`kebab-case`

3. **注释规范**
   - 公共 API 必须有 JSDoc 注释
   - 复杂逻辑必须有说明注释
   - 保持注释简洁明了

### 小程序规范

1. **页面结构**
   ```typescript
   Page<PageData, CustomOption, InstanceOption>({
     data: { /* 页面数据 */ },
     
     onLoad(options) { /* 页面加载 */ },
     onShow() { /* 页面显示 */ },
     onHide() { /* 页面隐藏 */ },
     onUnload() { /* 页面卸载 */ },
     
     // 业务方法...
   })
   ```

2. **组件规范**
   - 使用 `Component()` 而非 `Page()`
   - 组件内部状态使用 `data`
   - 对外暴露 `properties` 和 `methods`

3. **事件处理**
   - 事件绑定使用 `bind` 而非 `catch` 除非必要
   - 事件处理函数命名：`on + EventName`

### 数据库操作规范

1. **使用统一的数据库接口**
   ```typescript
   import { cardGroupCollection, cardCollection, generateId } from '../../utils/db'
   ```

2. **错误处理**
   - 所有数据库操作必须 `try-catch`
   - 云函数失败时提供友好的错误提示
   - 失败时记录日志到 console

3. **数据降级**
   - 云开发失败时自动降级到本地存储
   - 不强制要求用户使用云开发
   - 静默降级，不打断用户操作

### UI 设计规范

**设计系统**已在 `.trae/documents/model.md` 中定义，核心要素：

| 元素 | 值 |
|-----|---|
| 主色 | `#34d399` |
| 主色深 | `#10b981` |
| 背景色 | `#f5f5f5` |
| 卡片背景 | `#ffffff` |
| 文本主色 | `#1a1a1a` |
| 文本次色 | `#666666` |

**通用组件**应遵循设计文档中的模板（页面容器、区块卡片、按钮网格、弹窗等）

## 开发工作流

### 创建新页面

1. 在 `miniprogram/pages/` 下创建目录
2. 创建 4 个文件：`page-name.ts`, `page-name.wxml`, `page-name.wxss`, `page-name.json`
3. 在 `app.json` 的 `pages` 数组中注册

### 创建新组件

1. 在 `miniprogram/components/` 下创建目录
2. 创建 4 个文件：`component-name.ts`, `component-name.wxml`, `component-name.wxss`, `component-name.json`
3. 在使用该组件的页面或组件的 json 文件中注册

### 创建云函数

1. 在 `cloudfunctions/` 下创建目录
2. 创建 `index.js` 和 `package.json`
3. 在微信开发者工具中上传并部署

## 错误处理

### 错误分类

| 类型 | 处理方式 |
|-----|---------|
| 网络错误 | 显示提示，提供重试 |
| 数据库错误 | 记录日志，降级到本地 |
| 用户错误 | 显示友好提示，引导操作 |
| 系统错误 | 记录日志，不显示给用户 |

### 日志规范

使用带标签的日志格式：
```typescript
console.log('[ModuleName] 描述信息', data)
console.error('[ModuleName] 错误描述', error)
```

标签示例：
- `[App]` - 应用层
- `[DB]` - 数据库
- `[PageName]` - 页面
- `[ComponentName]` - 组件

## 性能优化

### 小程序优化

1. **页面渲染**
   - 使用 `setData` 批量更新
   - 避免频繁的 `setData` 调用
   - 移除不必要的 `setData`

2. **数据存储**
   - 合理使用本地缓存
   - 避免存储过大的数据
   - 及时清理过期缓存

3. **图片资源**
   - 使用适当尺寸的图片
   - 压缩图片大小
   - 合理使用图片格式

### 云开发优化

1. **数据库查询**
   - 使用索引提升查询速度
   - 避免 `orderBy` 没有索引的字段
   - 分页加载大量数据

2. **云函数调用**
   - 减少云函数调用次数
   - 合并相关操作到一个云函数
   - 使用本地缓存

## 安全考虑

1. **数据权限**
   - 数据库设置为「仅创建者可读写」
   - 在云函数中验证用户权限
   - 不将敏感信息存储在前端

2. **输入验证**
   - 验证所有用户输入
   - 限制输入长度
   - 处理特殊字符

3. **云开发配置**
   - 不提交云开发密钥到代码库
   - 使用环境变量管理敏感配置
   - 定期检查云函数权限

## 测试策略

### 单元测试
- 工具函数需要单元测试
- 使用 TypeScript 类型检查作为静态测试

### 手动测试
- 云开发和本地存储两种模式
- 不同设备和屏幕尺寸
- 网络连接正常和异常

## Git 工作流

### 分支管理
- `main` - 生产环境代码
- `dev` - 开发分支
- `feature/xxx` - 功能分支
- `fix/xxx` - 修复分支

### 提交信息
使用清晰的提交信息格式：
```
<type>(<scope>): <subject>

类型：
- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建/工具
```

## 部署流程

### 发布小程序

1. 在微信开发者工具中点击「上传」
2. 填写版本号和项目备注
3. 在微信公众平台提交审核
4. 审核通过后发布

### 部署云函数

1. 修改云函数代码
2. 在微信开发者工具中右键云函数目录
3. 选择「上传并部署：云端安装依赖」
4. 测试云函数是否正常工作

## 项目配置

### 关键文件

| 文件 | 用途 |
|-----|------|
| `app.ts` | 云开发环境配置 |
| `app.json` | 小程序全局配置 |
| `project.config.json` | 项目配置 |
| `tsconfig.json` | TypeScript 配置 |
| `package.json` | 依赖管理 |

### 环境变量

当前项目环境 ID：
```typescript
env: 'cloud1-d3g5crpd0b1f51b0f'
```

## 常见问题

### 开发环境设置

1. 确保已安装微信开发者工具
2. 使用微信开发者工具打开项目
3. 在工具中启用 TypeScript 支持

### 本地存储模式

1. 云开发不可用时自动降级
2. 数据存储在微信本地缓存
3. 支持离线使用

### 云开发模式

1. 需要在微信开发者工具中开通云开发
2. 需要创建数据库集合
3. 需要部署云函数

## 相关文档

- [UI 设计规范](./model.md)
- [云开发配置](../../CLOUD_SETUP.md)
- [快速开始](../../快速开始.md)
- [Karpathy 编码规范](../rules/CLAUDE.md)

---

**最后更新**：2026-05-04
**维护者**：项目团队
