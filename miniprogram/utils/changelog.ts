/** 更新日志数据 */

export interface ChangelogItem {
  version: string
  date: string
  changes: {
    type: string
    items: string[]
  }[]
}

export const changelogData: ChangelogItem[] = [
  {
    version: '1.0.0',
    date: '2026-06-07',
    changes: [
      {
        type: '🎉 新增',
        items: [
          '关于页面，展示应用信息和更新日志',
          '更新日志时间线展示，记录每次版本变更'
        ]
      }
    ]
  }
]
