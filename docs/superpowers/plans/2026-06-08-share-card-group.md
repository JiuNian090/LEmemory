# 分享卡牌组功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现小程序消息卡片分享卡牌组功能，接收方能一键导入

**Architecture:** 沿用现有 DualCollection 本地优先架构，云函数负责读取分享数据（按 groupId 查询，不限 _openid），前端接收后通过 DualCollection 写入本地+云端

**Tech Stack:** 微信小程序 + 微信云开发 (cloud functions + database)

---

### Task 1: 云函数 — 添加 getSharedGroup action

**Files:**
- Modify: `cloudfunctions/cardGroup_operate/index.js`

- [ ] **Step 1: 添加 `getSharedGroup` action**

在 `cardGroup_operate/index.js` 的 action 分支中添加新分支：

```javascript
} else if (action === 'getSharedGroup') {
  const groupResult = await db.collection('cardGroups').where({
    groupId
  }).get()
  
  const cardsResult = await db.collection('cards').where({
    groupId
  }).get()
  
  return {
    success: true,
    data: {
      group: groupResult.data[0] || null,
      cards: cardsResult.data
    }
  }
```

注意：放在 `delete` 分支之后、`return { success: true }` 之前。

- [ ] **Step 2: 验证云函数语法正确**

代码结构检查——整个文件最终看起来应该是：

```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, groupId, title, description } = event

  try {
    if (action === 'create') {
      // ... 现有代码
    } else if (action === 'list') {
      // ... 现有代码
    } else if (action === 'update') {
      // ... 现有代码
    } else if (action === 'delete') {
      // ... 现有代码
    } else if (action === 'getSharedGroup') {
      const groupResult = await db.collection('cardGroups').where({
        groupId
      }).get()
      
      const cardsResult = await db.collection('cards').where({
        groupId
      }).get()
      
      return {
        success: true,
        data: {
          group: groupResult.data[0] || null,
          cards: cardsResult.data
        }
      }
    }

    return { success: true }
  } catch (err) {
    console.error(err)
    return { success: false, error: err }
  }
}
```

---

### Task 2: 新增 shareImport 页面

**Files:**
- Create: `miniprogram/pages/shareImport/shareImport.ts`
- Create: `miniprogram/pages/shareImport/shareImport.wxml`
- Create: `miniprogram/pages/shareImport/shareImport.wxss`
- Create: `miniprogram/pages/shareImport/shareImport.json`

- [ ] **Step 1: 创建 shareImport.json**

```json
{
  "navigationBarTitleText": "分享的卡牌组"
}
```

- [ ] **Step 2: 创建 shareImport.wxss**

页面采用卡片式布局，与 cardDetail 页风格一致：

```css
.container {
  min-height: 100vh;
  background: var(--bg-color);
  padding: 30rpx;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.loading-text {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-top: 20rpx;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.error-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.error-text {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 30rpx;
}

.retry-btn {
  padding: 20rpx 60rpx;
  background: var(--card-bg);
  border: 2rpx solid var(--primary-color);
  border-radius: 40rpx;
  color: var(--primary-color);
  font-size: 28rpx;
  font-weight: 500;
}

.retry-btn:active {
  opacity: 0.7;
}

/* 卡牌组信息卡片 */
.group-info-card {
  background: var(--card-bg);
  border-radius: 24rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: var(--shadow);
  border-left: 6rpx solid var(--primary-color);
  margin-bottom: 24rpx;
}

.group-icon {
  font-size: 60rpx;
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-light) 0%, #d1fae5 100%);
  border-radius: 20rpx;
}

.group-details {
  flex: 1;
}

.group-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.group-meta {
  font-size: 24rpx;
  color: var(--text-secondary);
}

/* 卡牌列表 */
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 20rpx;
}

.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.card-item {
  background: var(--card-bg);
  border: 1rpx solid var(--border-color);
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-shadow: var(--shadow);
}

.card-number {
  width: 40rpx;
  height: 40rpx;
  background: var(--primary-light);
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-dark);
  font-size: 20rpx;
  font-weight: 600;
  margin-bottom: 4rpx;
}

.card-q {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.card-q .label {
  color: var(--primary-color);
  font-weight: 600;
  font-size: 24rpx;
  width: 36rpx;
  flex-shrink: 0;
}

.card-q .text {
  font-size: 26rpx;
  color: var(--text-primary);
  line-height: 1.5;
}

.card-a {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.card-a .label {
  color: var(--primary-dark);
  font-weight: 600;
  font-size: 24rpx;
  width: 36rpx;
  flex-shrink: 0;
}

.card-a .text {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 导入按钮 */
.import-btn {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  border-radius: 50rpx;
  padding: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  box-shadow: 0 8rpx 30rpx rgba(52, 211, 153, 0.3);
  position: fixed;
  bottom: 40rpx;
  left: 30rpx;
  right: 30rpx;
  z-index: 10;
}

.import-btn:active {
  transform: scale(0.98);
}

.import-btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

.import-btn-icon {
  font-size: 36rpx;
}

/* 成功状态 */
.success-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 0;
}

.success-icon {
  font-size: 100rpx;
  margin-bottom: 24rpx;
}

.success-text {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.success-desc {
  font-size: 26rpx;
  color: var(--text-secondary);
}

/* 导入中遮罩 */
.importing-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.importing-text {
  font-size: 28rpx;
  color: #fff;
  margin-top: 20rpx;
}
```

- [ ] **Step 3: 创建 shareImport.wxml**

```html
<view class="container">
  <!-- 加载中 -->
  <view wx:if="{{loading}}" class="loading-container">
    <text class="loading-text">加载卡牌组中...</text>
  </view>

  <!-- 加载失败 -->
  <view wx:elif="{{loadError}}" class="error-container">
    <text class="error-icon">😵</text>
    <text class="error-text">{{loadError}}</text>
    <button class="retry-btn" bindtap="loadSharedGroup">重新加载</button>
  </view>

  <!-- 导入成功 -->
  <view wx:elif="{{imported}}" class="success-container">
    <text class="success-icon">🎉</text>
    <text class="success-text">导入成功！</text>
    <text class="success-desc">即将跳转到卡牌组</text>
  </view>

  <!-- 正常内容 -->
  <block wx:else>
    <!-- 卡牌组信息 -->
    <view class="group-info-card">
      <view class="group-icon">📚</view>
      <view class="group-details">
        <view class="group-title">{{group.title}}</view>
        <view class="group-meta">共 {{group.cardCount}} 张卡牌</view>
      </view>
    </view>

    <!-- 卡牌列表 -->
    <view class="section-title">卡牌预览</view>
    <view class="card-list">
      <view wx:for="{{cards}}" wx:key="cardId" class="card-item">
        <view class="card-number">{{index + 1}}</view>
        <view class="card-q">
          <text class="label">Q:</text>
          <text class="text">{{item.front}}</text>
        </view>
        <view class="card-a">
          <text class="label">A:</text>
          <text class="text">{{item.back}}</text>
        </view>
      </view>
    </view>

    <!-- 底部安全区 -->
    <view style="height: 140rpx"></view>

    <!-- 导入按钮 -->
    <view class="import-btn" bindtap="importGroup">
      <text class="import-btn-icon">📥</text>
      <text class="import-btn-text">导入到我的卡牌组</text>
    </view>
  </block>

  <!-- 导入中遮罩 -->
  <view wx:if="{{importing}}" class="importing-overlay">
    <text class="importing-text">导入中...</text>
  </view>
</view>
```

- [ ] **Step 4: 创建 shareImport.ts**

页面逻辑：

```typescript
import { cardGroupCollection, cardCollection, generateId } from '../../utils/db'

interface SharedCard {
  cardId: string
  front: string
  back: string
}

interface SharedGroup {
  groupId: string
  title: string
  description?: string
  cardCount: number
}

interface ShareImportPageData {
  loading: boolean
  loadError: string
  group: SharedGroup
  cards: SharedCard[]
  importing: boolean
  imported: boolean
}

Page<ShareImportPageData, WechatMiniprogram.IAnyObject>({
  data: {
    loading: true,
    loadError: '',
    group: { groupId: '', title: '', cardCount: 0 },
    cards: [],
    importing: false,
    imported: false
  },

  onLoad(options: any) {
    const groupId = options.groupId
    if (groupId) {
      this.loadSharedGroup(groupId)
    } else {
      this.setData({
        loading: false,
        loadError: '无效的分享链接'
      })
    }
  },

  async loadSharedGroup(groupId?: string) {
    const gid = groupId || this.data.group.groupId
    if (!gid) {
      this.setData({
        loading: false,
        loadError: '无效的卡牌组ID'
      })
      return
    }

    this.setData({ loading: true, loadError: '' })

    try {
      const { result } = await wx.cloud.callFunction({
        name: 'cardGroup_operate',
        data: { action: 'getSharedGroup', groupId: gid }
      })

      const res = result as any
      if (!res || !res.success || !res.data) {
        throw new Error('获取卡牌组失败')
      }

      const groupData = res.data.group
      const cardsData = (res.data.cards || []) as SharedCard[]

      if (!groupData) {
        throw new Error('卡牌组不存在或已删除')
      }

      this.setData({
        loading: false,
        group: {
          groupId: groupData.groupId,
          title: groupData.title || '未命名卡牌组',
          description: groupData.description || '',
          cardCount: cardsData.length
        },
        cards: cardsData
      })
    } catch (err: any) {
      console.error('[ShareImport] 加载分享卡牌组失败', err)
      this.setData({
        loading: false,
        loadError: err.errMsg || err.message || '加载失败，请重试'
      })
    }
  },

  async importGroup() {
    if (this.data.importing || this.data.cards.length === 0) return

    this.setData({ importing: true })

    try {
      const newGroupId = generateId()
      const { title, description } = this.data.group

      // 创建新卡牌组
      await cardGroupCollection.add({
        data: {
          groupId: newGroupId,
          title: title,
          description: description || '',
          createTime: new Date(),
          updateTime: new Date()
        }
      })

      // 逐张导入卡牌
      for (const card of this.data.cards) {
        await cardCollection.add({
          data: {
            cardId: generateId(),
            groupId: newGroupId,
            front: card.front,
            back: card.back,
            createTime: new Date(),
            status: 'new',
            reviewCount: 0
          }
        })
      }

      this.setData({ imported: true, importing: false })

      // 跳转到新卡牌组
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/cardDetail/cardDetail?groupId=${newGroupId}&title=${encodeURIComponent(title)}&description=${encodeURIComponent(description || '')}`
        })
      }, 1500)
    } catch (err: any) {
      console.error('[ShareImport] 导入失败', err)
      this.setData({ importing: false })
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      })
    }
  }
})
```

---

### Task 3: 修改 cardDetail 页面 — 添加分享 + 改名备份

**Files:**
- Modify: `miniprogram/pages/cardDetail/cardDetail.ts`
- Modify: `miniprogram/pages/cardDetail/cardDetail.wxml`

- [ ] **Step 1: 在 cardDetail.ts 中添加 `onShareAppMessage` 方法**

在 `doDeleteCardGroup` 方法之后、`shareCardGroup` 方法之前（约第865行后）添加：

```typescript
/**
 * 分享卡牌组（小程序消息卡片）
 */
onShareAppMessage() {
  return {
    title: this.data.title,
    path: `/pages/shareImport/shareImport?groupId=${this.data.groupId}`
  }
},
```

注意保持其他方法不变。

- [ ] **Step 2: 修改 cardDetail.wxml — 调整按钮**

将原来的"分享卡牌组"按钮改为"备份卡牌组"，并新增一个"分享给好友"按钮：

找到这段代码（约第52-66行）：
```html
<view class="quick-actions">
  <view class="quick-action-btn" bindtap="shareCardGroup">
    <text class="action-icon">📤</text>
    <text class="action-text">分享卡牌组</text>
  </view>
  <view class="quick-action-btn" bindtap="importCards">
    <text class="action-icon">📥</text>
    <text class="action-text">导入卡牌</text>
  </view>
  <view class="quick-action-btn" bindtap="startStudy">
    <text class="action-icon">📝</text>
    <text class="action-text">测验</text>
  </view>
</view>
```

改为：
```html
<view class="quick-actions">
  <button class="quick-action-btn share-btn" open-type="share">
    <text class="action-icon">💬</text>
    <text class="action-text">分享给好友</text>
  </button>
  <view class="quick-action-btn" bindtap="shareCardGroup">
    <text class="action-icon">📤</text>
    <text class="action-text">备份卡牌组</text>
  </view>
  <view class="quick-action-btn" bindtap="importCards">
    <text class="action-icon">📥</text>
    <text class="action-text">导入卡牌</text>
  </view>
  <view class="quick-action-btn" bindtap="startStudy">
    <text class="action-icon">📝</text>
    <text class="action-text">测验</text>
  </view>
</view>
```

- [ ] **Step 3: 为分享按钮添加样式**

在 cardDetail.wxss 中添加 `.share-btn` 样式，覆盖 button 原生样式：

```css
.quick-action-btn.share-btn {
  flex: 1;
  background: var(--card-bg);
  border-radius: 20rpx;
  padding: 30rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  transition: all 0.3s ease;
  box-shadow: var(--shadow);
  border: none;
  margin: 0;
  font-size: inherit;
  line-height: inherit;
}

.quick-action-btn.share-btn::after {
  border: none;
}

.quick-action-btn.share-btn:active {
  transform: scale(0.96);
  box-shadow: var(--shadow-hover);
}
```

放在 `.quick-action-btn:active` 规则之后。

---

### Task 4: 注册 shareImport 页面到 app.json

**Files:**
- Modify: `miniprogram/app.json`

- [ ] **Step 1: 添加 shareImport 页面路径**

在 `pages` 数组中添加 `"pages/shareImport/shareImport"`：

```json
{
  "pages": [
    "pages/study/study",
    "pages/cardDetail/cardDetail",
    "pages/shareImport/shareImport",
    "pages/statistics/statistics",
    "pages/mine/mine",
    "pages/backup/backup",
    "pages/login/login",
    "pages/settings/settings"
  ],
  // ... 其余保持不变
}
```

放在 cardDetail 之后、statistics 之前。

---

### Task 5: 验证构建

- [ ] **Step 1: 检查 TypeScript 编译**

确保没有类型错误。运行 TypeScript 编译器：

```bash
npx tsc --noEmit
```

或检查 IDE 中是否有红色波浪线报错。

- [ ] **Step 2: 检查文件完整性**

确认所有新建和修改的文件都已保存：
- `cloudfunctions/cardGroup_operate/index.js` — 已修改
- `miniprogram/pages/shareImport/shareImport.ts` — 已创建
- `miniprogram/pages/shareImport/shareImport.wxml` — 已创建
- `miniprogram/pages/shareImport/shareImport.wxss` — 已创建
- `miniprogram/pages/shareImport/shareImport.json` — 已创建
- `miniprogram/pages/cardDetail/cardDetail.ts` — 已修改
- `miniprogram/pages/cardDetail/cardDetail.wxml` — 已修改
- `miniprogram/pages/cardDetail/cardDetail.wxss` — 已修改
- `miniprogram/app.json` — 已修改