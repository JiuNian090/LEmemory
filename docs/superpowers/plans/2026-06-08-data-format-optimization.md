# 数据格式优化 Implementation Plan

**Goal:** 为分享导出 JSON 和云端备份 JSON 增加完整元数据（schemaVersion、appVersion、summary、时间等）

**Architecture:** 修改 5 个文件的导出/备份逻辑，不改变内部存储结构，兼容旧格式导入

**Tech Stack:** TypeScript (小程序前端), JavaScript (云函数)

---

### Task 1: 更新 `BackupData` 类型定义

**Files:**
- Modify: `miniprogram/utils/types.ts:79-87`

- [ ] **修改 `BackupData` 接口，增加新字段**

```typescript
// 完整备份数据
export interface BackupData {
  version: string
  schemaVersion?: string
  appVersion?: string
  backupTime: Date
  userId?: string
  summary?: {
    cardGroupCount: number
    cardCount: number
    studyRecordCount: number
    favoriteCount: number
  }
  cardGroups: CardGroup[]
  cards: Card[]
  studyRecords: StudyRecord[]
  favorites: Favorite[]
}
```

`schemaVersion` 和 `appVersion` 设为可选（`?`），向后兼容旧格式。

---

### Task 2: 更新 `exportAllLocalData` 函数

**Files:**
- Modify: `miniprogram/utils/db.ts:572-581`

- [ ] **在导出数据中加入新字段**

```typescript
export function exportAllLocalData(): BackupData {
  const cardGroups = getLocalStorageData(STORAGE_KEYS.CARD_GROUPS) as CardGroup[]
  const cards = getLocalStorageData(STORAGE_KEYS.CARDS) as Card[]
  const studyRecords = getLocalStorageData(STORAGE_KEYS.STUDY_RECORDS) as StudyRecord[]
  const favorites = getLocalStorageData(STORAGE_KEYS.FAVORITES) as Favorite[]

  return {
    version: '1.0',
    schemaVersion: '2.0',
    appVersion: '1.0.0',
    backupTime: new Date(),
    summary: {
      cardGroupCount: cardGroups.length,
      cardCount: cards.length,
      studyRecordCount: studyRecords.length,
      favoriteCount: favorites.length
    },
    cardGroups,
    cards,
    studyRecords,
    favorites
  }
}
```

---

### Task 3: 更新 `downloadCloudToLocal` 中的导入占位

**Files:**
- Modify: `miniprogram/utils/db.ts:679-687`

- [ ] **更新占位数据，加入新字段**

```typescript
importLocalData({
  version: '1.0',
  schemaVersion: '2.0',
  appVersion: '1.0.0',
  backupTime: new Date(),
  userId,
  summary: {
    cardGroupCount: cardGroups.length,
    cardCount: cards.length,
    studyRecordCount: studyRecords.length,
    favoriteCount: favorites.length
  },
  cardGroups: cardGroups as CardGroup[],
  cards: cards as Card[],
  studyRecords: studyRecords as StudyRecord[],
  favorites: favorites as Favorite[]
})
```

---

### Task 4: 更新 `shareCardGroup` 导出格式

**Files:**
- Modify: `miniprogram/pages/cardDetail/cardDetail.ts:888-902`

- [ ] **将导出 JSON 格式升级为 v2.0**

```typescript
const exportTime = new Date().toISOString()

const exportData = {
  schemaVersion: '2.0',
  appVersion: '1.0.0',
  exportTime,
  exporter: {
    nickName: app.globalData.userInfo?.nickName || ''
  },
  summary: {
    cardCount: cards.length
  },
  group: {
    title,
    description: description || '',
    createTime: exportTime,
    updateTime: exportTime
  },
  cards: cards.map(c => ({
    front: c.front,
    back: c.back,
    createTime: c.createTime instanceof Date
      ? c.createTime.toISOString()
      : (typeof c.createTime === 'string' ? c.createTime : exportTime),
    status: c.status || 'new',
    reviewCount: c.reviewCount || 0
  }))
}
```

---

### Task 5: 更新备份云函数，增加 `appVersion`

**Files:**
- Modify: `cloudfunctions/backup_manager/index.js:33-46`

- [ ] **在 create action 中接受并存储 appVersion**

```js
} else if (action === 'create') {
  const result = await db.collection('backups').add({
    data: {
      backupId,
      userId,
      appVersion: event.appVersion || 'unknown',
      backupTime: new Date(),
      dataSize: dataSize || 0,
      description: description || '',
      cardGroupsCount: cardGroupsCount || 0,
      cardsCount: cardsCount || 0,
      studyRecordsCount: studyRecordsCount || 0,
      favoritesCount: favoritesCount || 0,
      backupData: backupData || {}
    }
  })
```

---

### Task 6: 更新 `createBackup` 传递 appVersion

**Files:**
- Modify: `miniprogram/utils/sync.ts:128-141`

- [ ] **在调用云函数时传入 appVersion**

```typescript
const { result } = await wx.cloud.callFunction({
  name: 'backup_manager',
  data: {
    action: 'create',
    backupId,
    description: description || '',
    appVersion: '1.0.0',
    backupData: localData,
    dataSize,
    cardGroupsCount: localData.cardGroups.length,
    cardsCount: localData.cards.length,
    studyRecordsCount: localData.studyRecords.length,
    favoritesCount: localData.favorites.length
  }
})
```

---

### Task 7: 验证

- [ ] **检查所有文件编译无报错**
- [ ] **确认 `shareImport` 导入新格式能正常运行**（#106 已在导入逻辑中仅使用 front/back，忽略额外字段）
- [ ] **确认旧 JSON 格式仍然可以正确导入**