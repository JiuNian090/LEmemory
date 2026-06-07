# 数据格式优化设计

## 背景

现有的 JSON 数据格式（分享导出和云端备份）信息量不足：
- 分享导出的 JSON 缺少卡牌组时间、卡牌时间、版本号等元数据
- 没有明确的 `schemaVersion`，后续格式升级无法兼容
- 分享的卡牌数据不包含掌握程度等学习状态

## 目标

1. 分享导出 JSON 增加完整元数据，确保接收方能了解卡牌组全貌
2. 云端备份格式增加版本号和统计摘要
3. 兼容旧格式导入（shareImport）
4. `appVersion` 从 `package.json` 获取

## 设计

### 1. 分享导出格式 (shareCardGroup → JSON 文件)

```json
{
  "schemaVersion": "2.0",
  "appVersion": "1.0.0",
  "exportTime": "2026-06-08T12:00:00.000Z",
  "exporter": {
    "nickName": "小明"
  },
  "summary": {
    "cardCount": 50
  },
  "group": {
    "title": "英语四级词汇",
    "description": "核心高频词汇",
    "createTime": "2026-06-01T10:00:00.000Z",
    "updateTime": "2026-06-08T12:00:00.000Z"
  },
  "cards": [
    {
      "front": "abandon",
      "back": "放弃，遗弃",
      "createTime": "2026-06-01T10:00:00.000Z",
      "status": "learning",
      "reviewCount": 5
    }
  ]
}
```

### 2. 云端备份格式 (BackupData)

```json
{
  "schemaVersion": "2.0",
  "appVersion": "1.0.0",
  "backupTime": "2026-06-08T12:00:00.000Z",
  "summary": {
    "cardGroupCount": 5,
    "cardCount": 120,
    "studyRecordCount": 30,
    "favoriteCount": 8
  },
  "cardGroups": [
    {
      "groupId": "xxx",
      "title": "英语四级词汇",
      "description": "...",
      "createTime": "...",
      "updateTime": "..."
    }
  ],
  "cards": [
    {
      "cardId": "xxx",
      "groupId": "xxx",
      "front": "abandon",
      "back": "放弃，遗弃",
      "createTime": "...",
      "status": "learning",
      "reviewCount": 5
    }
  ],
  "studyRecords": [ ... ],
  "favorites": [ ... ]
}
```

### 3. 导入兼容

`shareImport` 页面导入时兼容两种格式：
- `schemaVersion === "2.0"` → 新格式，读取 `cards[].front/back/createTime`
- 无 `schemaVersion` 或无 `cards` 数组（旧格式） → 兼容处理

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `miniprogram/utils/types.ts` | 修改 | `BackupData` 增加 `schemaVersion`、`appVersion`、`summary` |
| `miniprogram/pages/cardDetail/cardDetail.ts` | 修改 | `shareCardGroup` 导出格式增加元数据 |
| `miniprogram/pages/shareImport/shareImport.ts` | 修改 | `processImportData` 兼容新格式 |
| `cloudfunctions/backup_manager/index.js` | 修改 | 备份记录增加 `appVersion` 字段 |
| `miniprogram/utils/sync.ts` | 修改 | `createBackup` 数据增加元数据 |