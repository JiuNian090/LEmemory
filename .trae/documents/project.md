一、项目概述

本项目是一款基于微信小程序的背记工具，核心功能为卡牌组创建与学习、学习数据统计、用户个人中心管理，旨在帮助用户高效记忆知识点。

二、技术选型

• 前端框架：微信小程序原生开发（WXML、WXSS、TypeScript）

• 后端服务：微信云开发（后续可在项目内直接开启，无需重建项目）

• 图表组件：ECharts for 微信小程序 (ec-canvas)

• 开发模板：微信小程序官方 TS-基础模版（TypeScript + CSS，IDE提示强、代码规范易维护）

三、数据库设计（微信云开发 - 集合）

1. users（用户信息表）

字段名：_openid，类型：String，说明：用户唯一标识（系统自动生成）
字段名：nickName，类型：String，说明：用户昵称
字段名：avatarUrl，类型：String，说明：用户头像链接
字段名：createTime，类型：Date，说明：账号创建时间

2. cardGroups（卡牌组表）

字段名：groupId，类型：String，说明：卡牌组唯一ID（自定义生成）
字段名：userId，类型：String，说明：所属用户 _openid
字段名：title，类型：String，说明：卡牌组标题
字段名：description，类型：String，说明：卡牌组描述（可选）
字段名：createTime，类型：Date，说明：创建时间
字段名：updateTime，类型：Date，说明：最后更新时间

3. cards（卡牌表）

字段名：cardId，类型：String，说明：卡牌唯一ID（自定义生成）
字段名：groupId，类型：String，说明：所属卡牌组 groupId
字段名：userId，类型：String，说明：所属用户 _openid
字段名：front，类型：String，说明：卡牌正面内容（问题/知识点）
字段名：back，类型：String，说明：卡牌背面内容（答案/解析）
字段名：createTime，类型：Date，说明：创建时间

4. studyRecords（学习记录表）

字段名：recordId，类型：String，说明：记录唯一ID（自定义生成）
字段名：userId，类型：String，说明：所属用户 _openid
字段名：groupId，类型：String，说明：学习的卡牌组 groupId
字段名：studyDuration，类型：Number，说明：本次学习时长（单位：秒）
字段名：studyDate，类型：Date，说明：学习日期

5. favorites（收藏表）

字段名：favoriteId，类型：String，说明：收藏唯一ID（自定义生成）
字段名：userId，类型：String，说明：所属用户 _openid
字段名：cardId，类型：String，说明：收藏的卡牌 cardId
字段名：groupId，类型：String，说明：所属卡牌组 groupId
字段名：createTime，类型：Date，说明：收藏时间

四、TS-基础模板项目初始化结构
EMemory/
├── miniprogram/                # 小程序主目录
│   ├── app.ts                  # 小程序入口TS文件
│   ├── app.json                # 小程序全局配置（tabBar、页面路径等）
│   ├── app.wxss                # 全局样式文件
│   ├── sitemap.json            # 小程序搜索配置
│   ├── pages/                  # 页面目录
│   │   ├── study/              # 学习页面（卡牌组列表、创建卡牌组）
│   │   │   ├── study.ts
│   │   │   ├── study.wxml
│   │   │   ├── study.wxss
│   │   │   └── study.json
│   │   ├── cardDetail/         # 卡牌组详情页（学习/目录/卡牌/收藏）
│   │   │   ├── cardDetail.ts
│   │   │   ├── cardDetail.wxml
│   │   │   ├── cardDetail.wxss
│   │   │   └── cardDetail.json
│   │   ├── statistics/         # 统计页面（学习时长、趋势）
│   │   │   ├── statistics.ts
│   │   │   ├── statistics.wxml
│   │   │   ├── statistics.wxss
│   │   │   └── statistics.json
│   │   └── mine/               # 我的页面（用户信息、登录）
│   │       ├── mine.ts
│   │       ├── mine.wxml
│   │       ├── mine.wxss
│   │       └── mine.json
│   ├── components/             # 公共组件目录
│   │   ├── flipCard/           # 翻牌组件
│   │   ├── cardGroupItem/      # 卡牌组列表项组件
│   │   └── ec-canvas/          # ECharts图表组件（统计页用）
│   ├── utils/                  # 工具函数目录
│   │   ├── db.ts               # 云数据库操作封装
│   │   ├── time.ts             # 时间格式化、计时工具
│   │   └── types.ts            # 全局TS类型定义
│   └── images/                 # 静态资源（图标、图片）
├── cloudfunctions/             # 云函数目录（后续开启云开发后使用）
│   ├── user_login/
│   ├── cardGroup_operate/
│   ├── card_operate/
│   ├── studyRecord_add/
│   └── statistics_get/
├── project.config.json         # 项目配置文件
└── tsconfig.json               # TypeScript配置文件
五、页面功能详解

1. 学习页面（pages/study）

功能模块：

• 创建卡牌组：点击“+”按钮，输入标题和描述，生成新卡牌组

• 卡牌组列表：展示用户所有卡牌组，显示标题、描述、更新时间

• 卡牌组详情页（点击列表项进入）：

◦ 学习标签：卡牌翻牌效果（点击切换正面/背面），左右滑动切换卡牌，自动计时

◦ 目录标签：展示卡牌组内所有卡牌的标题列表，快速定位

◦ 卡牌标签：支持添加、编辑、删除卡牌

◦ 收藏标签：展示当前卡牌组内被收藏的卡牌

关键组件：

• 翻牌效果：使用 view 层叠 + transform 动画实现

• 计时器：页面 onShow 时启动 setInterval，onHide 时停止并保存数据

2. 统计页面（pages/statistics）

功能模块：

• 总学习时长：展示累计学习总时长（格式：X小时X分钟）

• 卡牌组时长统计：柱状图展示每个卡牌组的累计学习时长

• 学习趋势：折线图展示最近7天的每日学习时长

关键实现：

• 调用云函数聚合 studyRecords 数据，按 groupId 和 studyDate 分组统计

• 使用 ec-canvas 组件渲染图表，配置 option 实现数据可视化

3. 我的页面（pages/mine）

功能模块：

• 用户信息展示：头像、昵称（未登录时显示“点击登录”）

• 登录功能：调用 wx.getUserProfile 获取用户信息，同步到 users 集合

• 基础功能入口：设置、关于、反馈（可后续扩展）

六、核心云函数设计（后续开启云开发后使用）

1. user_login（用户登录）

功能：获取用户 openid，保存/更新用户信息
输入参数：nickName、avatarUrl
返回值：用户信息对象

2. cardGroup_operate（卡牌组操作）

功能：创建、查询、更新、删除卡牌组
输入参数：action（create/list/update/delete）、groupId、title、description
返回值：操作结果或卡牌组列表

3. card_operate（卡牌操作）

功能：创建、查询、更新、删除卡牌
输入参数：action、cardId、groupId、front、back
返回值：操作结果或卡牌列表

4. studyRecord_add（添加学习记录）

功能：保存单次学习时长
输入参数：groupId、studyDuration
返回值：操作结果

5. statistics_get（获取统计数据）

功能：聚合查询总时长、卡牌组时长、7天趋势
输入参数：无
返回值：totalDuration、groupDurations、weekTrend

七、开发步骤（适配TS基础模板）

1. 项目创建：

◦ 在微信开发者工具选择「TS-基础模版」创建项目，目录为 E:\Code\LEmemory

◦ 配置 app.json，添加页面路径并设置底部 tabBar（学习/统计/我的）

2. 基础结构搭建：

◦ 按上述目录结构创建 pages、components、utils 文件夹

◦ 在 utils/types.ts 中定义全局TS类型（用户、卡牌组、卡牌等）

3. 数据库与云函数部署：

◦ 在云开发控制台创建 users、cardGroups、cards、studyRecords、favorites 集合

◦ 编写云函数代码，上传并部署到云端

4. 页面开发顺序：

◦ 先开发“我的页面”，实现登录功能，确保用户身份识别

◦ 再开发“学习页面”，完成卡牌组和卡牌的增删改查，以及学习计时

◦ 最后开发“统计页面”，对接云函数数据，完成图表展示

5. 测试与优化：

◦ 测试数据持久化（关闭小程序再打开，数据不丢失）

◦ 优化动画流畅度（翻牌、滑动切换）

◦ 适配不同屏幕尺寸

八、注意事项

• 用户隐私：严格遵守微信小程序用户信息获取规范，仅在必要时请求授权

• 数据安全：云数据库权限设置为“仅创建者可读写”，防止数据泄露

• 性能优化：卡牌列表使用分页加载（skip + limit），避免一次性加载过多数据

• TS规范：在 utils/types.ts 中统一定义类型，减少类型断言，提升代码可维护性