# LEmemory - 记忆卡片学习小程序

LEmemory 是一款基于微信小程序的记忆卡片学习工具，帮助用户通过卡片式学习法高效记忆知识。数据存储采用本地优先 + 云端备份策略，支持跨设备同步学习时长，无需注册即可离线使用。

## 功能特性

| 功能 | 说明 |
|------|------|
| 📚 **卡牌组管理** | 创建、编辑、删除卡牌组，支持自定义表情图标 |
| 🃏 **卡牌学习** | 翻转卡牌学习模式，支持随机排序、测验模式 |
| ⏱️ **计时学习** | 学习计时器，自动保存时长到本地和云端 |
| 📊 **学习统计** | 趋势图、热力图、月度统计、饼图，在线/离线均可查看 |
| ☁️ **云备份** | 全量备份/恢复学习数据到云端账号下，跨设备合并时长 |
| 🔒 **登录注册** | 支持用户名密码注册/登录，自动登录，记住密码 |
| 🎨 **主题色** | 支持自定义主题色 |

## 技术栈

- **前端**：微信小程序（TypeScript）
- **后端**：微信云开发（云函数 + 云数据库）
- **存储**：本地加密存储 + 云端备份

## 项目结构

```
LEmemory/
├── cloudfunctions/          # 云函数
│   ├── account_manager/     # 用户账户管理（注册/登录/密码修改）
│   ├── backup_manager/      # 数据备份管理（创建/恢复/删除备份）
│   ├── study_sync/          # 学习数据云端同步（原子累加）
│   ├── user_login/          # 用户自动登录/注册
│   └── share_link/          # 卡牌分享链接
├── miniprogram/             # 小程序前端
│   ├── components/          # 组件
│   │   ├── flipCard/        # 卡牌翻转组件
│   │   ├── cardGroupItem/   # 卡牌组列表项组件
│   │   └── ec-canvas/       # ECharts 图表组件
│   ├── pages/               # 页面（9个）
│   │   ├── study/           # 主页 - 卡牌组列表
│   │   ├── cardDetail/      # 卡牌详情/学习/测验
│   │   ├── statistics/      # 学习统计（图表）
│   │   ├── mine/            # 个人中心
│   │   ├── login/           # 登录/注册
│   │   ├── settings/        # 用户设置
│   │   ├── backup/          # 云备份管理
│   │   ├── shareImport/     # 卡牌导入
│   │   └── about/           # 关于/更新日志
│   ├── utils/               # 工具函数
│   │   ├── db.ts            # 本地存储 CRUD（核心数据层）
│   │   ├── auth.ts          # 自动登录/会话管理
│   │   ├── sync.ts          # 云端备份同步
│   │   ├── statistics.ts    # 学习统计计算
│   │   ├── charts.ts        # Canvas 2D 图表绘制
│   │   ├── crypto.ts        # 数据加密
│   │   ├── userSync.ts      # 用户资料多端同步
│   │   ├── time.ts          # 日期时间工具
│   │   ├── error.ts         # 错误处理
│   │   ├── share.ts         # 分享配置
│   │   ├── types.ts         # TypeScript 类型定义
│   │   └── changelog.ts     # 版本更新日志
│   ├── app.ts               # 应用入口
│   └── images/              # 图片资源
├── typings/                 # 微信 API 类型定义
└── package.json             # 项目配置
```

## 数据架构

### 本地存储

| 存储键 | 类型 | 说明 |
|--------|------|------|
| `card_groups` | `CardGroup[]` | 卡牌组列表 |
| `cards` | `Card[]` | 卡牌列表 |
| `study_records` | `StudyRecord[]` | 个体学习记录 |
| `favorites` | `Favorite[]` | 收藏卡牌 |
| `study_daily` | `DailyStudyMap` | 每日学习时长聚合 |

### 云端集合

| 集合 | 说明 |
|------|------|
| `users` | 用户账号（用户名+密码+头像） |
| `backups` | 备份数据（每人保留一份） |
| `study_daily` | 每日学习时长（按用户+日期+卡牌组原子累加） |

### 数据流

```
卡牌学习 → 本地 study_daily + study_records
         → 云端 study_sync（原子累加）
         
统计页  → 云端 study_daily → 本地 study_records → 本地 study_daily（三级回退）
         
备份    → 导出本地全部数据 → 云端存储
恢复    → 卡牌卡组覆盖 → 学习时长合并累加
```

## 开发指南

### 环境要求

- 微信开发者工具
- Node.js
- TypeScript 6.0+

### 本地开发

```bash
# 安装依赖
npm install

# TypeScript 类型检查
npx tsc --noEmit
```

### 云函数部署

云函数目录 `cloudfunctions/`，需在微信开发者工具中右键上传部署：

- `backup_manager` — 备份管理（需 `wx-server-sdk`）
- `account_manager` — 账户管理（需 `wx-server-sdk` + `crypto`）
- `study_sync` — 学习数据同步（需 `wx-server-sdk`）
- `user_login` — 自动登录（需 `wx-server-sdk`）
- `share_link` — 分享链接（需 `wx-server-sdk`）

## 版本

当前版本 **v1.2.5**

## License

MIT
