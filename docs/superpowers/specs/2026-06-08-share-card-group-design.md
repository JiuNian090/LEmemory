# 分享卡牌组功能设计

## 背景

LEmemory 已有 JSON 文件导出/导入的分享方式，但体验不够流畅：
- 分享到微信的是 JSON 文件，对方无法直接预览内容
- 需要手动选择文件导入，操作路径长
- 不符合微信生态的分享习惯

本次改进以 **小程序消息卡片分享** 为主要方式，原 JSON 导出改为备份用途。

## 目标

1. 分享者通过小程序消息卡片分享卡牌组，对方点开即可预览
2. 接收者一键导入卡牌组到自己的账号
3. 保留 JSON 导出功能，改为"备份卡牌组"
4. 所有改动最小化，复用现有基础设施

## 设计

### 1. cardDetail 页面改动

#### 分享入口调整

| 原按钮 | 改为 | 触发方式 |
|--------|------|----------|
| 分享卡牌组（JSON） | 备份卡牌组（JSON） | 保持现有 `shareCardGroup` 逻辑不变 |
| （无） | **分享卡牌组**（小程序卡片） | `<button open-type="share">` |

#### 触发分享

在 cardDetail 页面定义 `onShareAppMessage`：

```typescript
onShareAppMessage() {
  return {
    title: this.data.title,  // 卡牌组名称
    path: `/pages/shareImport/shareImport?groupId=${this.data.groupId}`
  }
}
```

当分享者点击"分享卡牌组"按钮，弹出微信原生分享面板，可选择发送给好友或群聊。对方收到的是一条小程序消息卡片，显示卡牌组标题。

### 2. 新增 shareImport 页面

**路径**: `/pages/shareImport/shareImport`
**接收参数**: `groupId`

#### 页面结构

```
┌──────────────────────────┐
│  ← 返回                   │
│                          │
│  📚 卡牌组标题             │
│  共 N 张卡牌               │
│                          │
│  ┌──── 卡牌预览 ───────┐  │
│  │ #1  Q: 问题内容      │  │
│  │     A: 答案内容       │  │
│  ├─────────────────────┤  │
│  │ #2  Q: 问题内容      │  │
│  │     A: 答案内容       │  │
│  ├─────────────────────┤  │
│  │   ... 共 N 张卡牌     │  │
│  └─────────────────────┘  │
│                          │
│  ┌──────────────────────┐ │
│  │  📥 导入到我的卡牌组    │ │
│  └──────────────────────┘ │
└──────────────────────────┘
```

#### 交互逻辑

1. **onLoad**: 通过云函数 `cardGroup_operate.getSharedGroup` 获取卡牌组 + 卡牌列表
2. **加载中**: 显示 loading 状态
3. **加载失败**: 显示错误提示，可点击重试
4. **导入流程**:
   - 生成新的 `groupId`
   - 调用 `cardGroupCollection.add()` 创建新卡牌组（标题、描述沿用原数据）
   - 遍历卡牌，为每张生成新 `cardId`，调用 `cardCollection.add()`
   - 显示成功提示
   - 跳转到 `cardDetail?groupId=新ID&title=...`
   - **不需要用户登录**：`DualCollection` 支持本地优先写入，未登录用户数据保存在本地；登录后自动同步到云端

#### 页面文件

```
miniprogram/pages/shareImport/
  ├── shareImport.ts      # 页面逻辑
  ├── shareImport.wxml    # 页面结构
  ├── shareImport.wxss    # 页面样式
  └── shareImport.json    # 页面配置
```

### 3. 云函数改动

在 `cloudfunctions/cardGroup_operate/index.js` 中新增 action：

#### `getSharedGroup`

```
请求: { action: 'getSharedGroup', groupId: 'xxx' }
返回: {
  success: true,
  data: {
    group: { groupId, title, description, ... },
    cards: [{ cardId, front, back, ... }, ...]
  }
}
```

- 通过 `groupId` 查询 `cardGroups` 集合（不限 `_openid`）
- 通过 `groupId` 查询 `cards` 集合
- 返回给前端展示

### 4. JSON 导出改为备份

现有 `shareCardGroup` 方法基本保持不变，仅需：
- 按钮文字改为"备份卡牌组"
- 函数名和方法调用保持不变
- 文件分享时的提示文案调整

### 5. app.json 注册

新增 shareImport 页面路径到 `pages` 数组中。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `miniprogram/pages/cardDetail/cardDetail.ts` | 修改 | 添加 `onShareAppMessage`，按钮文字调整 |
| `miniprogram/pages/cardDetail/cardDetail.wxml` | 修改 | 添加分享按钮，文字改为备份 |
| `miniprogram/pages/cardDetail/cardDetail.wxss` | 修改 | (如需要) 分享按钮样式 |
| `miniprogram/pages/shareImport/shareImport.ts` | 新建 | 分享导入页面逻辑 |
| `miniprogram/pages/shareImport/shareImport.wxml` | 新建 | 分享导入页面结构 |
| `miniprogram/pages/shareImport/shareImport.wxss` | 新建 | 分享导入页面样式 |
| `miniprogram/pages/shareImport/shareImport.json` | 新建 | 分享导入页面配置 |
| `cloudfunctions/cardGroup_operate/index.js` | 修改 | 添加 `getSharedGroup` action |
| `miniprogram/app.json` | 修改 | 注册 shareImport 页面路径 |

## 数据流

```
分享者:
  cardDetail
    → 点击"分享卡牌组" → <button open-type="share">
    → onShareAppMessage → 返回 { title, path: /shareImport?groupId=X }
    → 微信原生分享面板 → 发送给好友/群聊

接收者:
  微信聊天中点开小程序卡片
    → 打开 /pages/shareImport/shareImport?groupId=X
    → onLoad → wx.cloud.callFunction({ name: 'cardGroup_operate', data: { action: 'getSharedGroup', groupId: X } })
    → 显示卡牌组预览
    → 点击"导入到我的卡牌组"
    → 生成新 groupId → cardGroupCollection.add()
    → 遍历卡牌 → cardCollection.add()
    → 跳转 cardDetail?groupId=新ID
```

## 安全考虑

- `getSharedGroup` 仅返回指定 groupId 的数据，不暴露其他用户信息
- 导入时复制数据，接收者拥有独立副本
- 不修改原数据，只读操作