# LEmemory 微信小程序 UI 设计规范与通用模板

## 1. 设计系统

### 1.1 颜色体系

#### 主色调
- **主色**：`#34d399` (绿色) - 代表健康、活力、专业
- **主色深**：`#10b981` (深绿色) - 用于强调和交互元素
- **主色浅**：`#d1fae5` (浅绿色) - 用于背景和次要元素

#### 辅助色
- **危险色**：`#f87171` (红色) - 用于删除、错误等危险操作
- **警告色**：`#fbbf24` (黄色) - 用于警告、提示等
- **信息色**：`#60a5fa` (蓝色) - 用于信息、链接等

#### 中性色
- **背景色**：`#f5f5f5` (浅灰色) - 页面背景
- **卡片背景**：`#ffffff` (白色) - 卡片、弹窗等
- **文本主色**：`#1a1a1a` (深黑色) - 标题、主要文本
- **文本次色**：`#666666` (中灰色) - 说明文字、辅助信息
- **文本 tertiary**：`#999999` (浅灰色) - 次要信息、禁用状态
- **边框色**：`#e8e8e8` (极浅灰色) - 边框、分割线

#### 渐变色
- **主渐变色**：`linear-gradient(135deg, #34d399 0%, #10b981 100%)`
- **数据渐变色**：`linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)`
- **云存储渐变色**：`linear-gradient(135deg, #f0f5ff 0%, #f5f8ff 100%)`
- **关于渐变色**：`linear-gradient(135deg, #fff7e6 0%, #fff9f0 100%)`
- **更新日志渐变色**：`linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%)`
- **导出渐变色**：`linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%)`
- **分享渐变色**：`linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%)`
- **导入渐变色**：`linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%)`
- **清空渐变色**：`linear-gradient(135deg, #fff2f0 0%, #fff5f5 100%)`

### 1.2 字体系统

#### 字体家族
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

#### 字体大小
- **标题**：36rpx - 40rpx
- **副标题**：24rpx - 28rpx
- **正文**：28rpx - 32rpx
- **小文本**：24rpx - 26rpx

#### 字重
- **粗体**：600 (用于标题、重要信息)
- **半粗体**：500 (用于按钮、标签)
- **常规**：400 (用于正文、说明文字)

### 1.3 间距系统

#### 基础间距
- **小间距**：8rpx - 12rpx (用于文本间距、图标间距)
- **中等间距**：16rpx - 24rpx (用于组件内间距)
- **大间距**：28rpx - 32rpx (用于区块间距)
- **超大间距**：40rpx - 60rpx (用于页面边距)

#### 网格系统
- **移动端**：2列网格布局
- **平板端**：4列网格布局
- **横屏**：2列网格布局

### 1.4 圆角系统
- **小圆角**：8rpx (用于输入框、小按钮)
- **中等圆角**：16rpx (用于卡片、按钮)
- **大圆角**：24rpx (用于页面标题、弹窗)

### 1.5 阴影系统
- **轻微阴影**：`0 2rpx 12rpx rgba(0, 0, 0, 0.06)` (用于卡片)
- **中等阴影**：`0 4rpx 20rpx rgba(0, 0, 0, 0.08)` (用于悬浮元素)
- **强阴影**：`0 8rpx 40rpx rgba(0, 0, 0, 0.2)` (用于弹窗)

### 1.6 动画系统
- **过渡时间**：0.2s - 0.3s
- **过渡曲线**：`ease-in-out`
- **缩放动画**：0.96 - 1 (用于点击反馈)
- **透明度动画**：0 - 1 (用于淡入淡出)

## 2. 通用组件

### 2.1 页面容器
```wxml
<view class="container">
  <!-- 页面内容 -->
</view>
```

### 2.2 页面标题区
```wxml
<view class="page-header">
  <view class="header-content">
    <text class="header-title">📋 页面标题</text>
    <text class="header-subtitle">页面副标题描述</text>
  </view>
</view>
```

### 2.3 区块卡片
```wxml
<view class="section">
  <view class="section-header">
    <view class="section-icon data-icon">
      <text class="icon-text">💾</text>
    </view>
    <text class="section-title">区块标题</text>
    <view class="section-right">
      <!-- 右侧操作按钮 -->
    </view>
  </view>
  <view class="section-body">
    <!-- 区块内容 -->
  </view>
</view>
```

### 2.4 按钮网格
```wxml
<view class="btn-grid">
  <view class="grid-btn export-btn" bindtap="handleAction">
    <text class="btn-icon">📤</text>
    <text class="btn-text">导出</text>
  </view>
  <view class="grid-btn share-btn" bindtap="handleAction">
    <text class="btn-icon">📨</text>
    <text class="btn-text">分享</text>
  </view>
  <view class="grid-btn import-btn" bindtap="handleAction">
    <text class="btn-icon">📥</text>
    <text class="btn-text">导入</text>
  </view>
  <view class="grid-btn clear-btn" bindtap="handleAction">
    <text class="btn-icon">🗑️</text>
    <text class="btn-text">清空</text>
  </view>
</view>
```

### 2.5 弹窗组件
```wxml
<block wx:if="{{showModal}}">
  <view class="modal-mask show" bindtap="hideModal"></view>
  <view class="modal-container show">
    <view class="modal-header">
      <text class="modal-title">弹窗标题</text>
      <view class="modal-close" bindtap="hideModal">
        <text class="close-icon">×</text>
      </view>
    </view>
    <view class="modal-body" catchtap="stopPropagation">
      <!-- 弹窗内容 -->
    </view>
    <view class="modal-footer">
      <button class="modal-btn btn-cancel" bindtap="hideModal">取消</button>
      <button class="modal-btn btn-confirm" bindtap="confirmAction">确定</button>
    </view>
  </view>
</block>
```

### 2.6 表单组件
```wxml
<view class="form-group">
  <text class="form-label">输入框</text>
  <input class="form-input" placeholder="请输入内容" value="{{inputValue}}" bindinput="onInput" />
</view>
```

## 3. 完整样式代码

```css
/* 通用页面样式模板 */

/* ========== CSS变量定义 ========== */
page {
  --primary-color: #34d399;
  --primary-dark: #10b981;
  --primary-light: #d1fae5;
  --danger-color: #f87171;
  --warning-color: #fbbf24;
  --info-color: #60a5fa;
  --bg-color: #f5f5f5;
  --card-bg: #ffffff;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --border-color: #e8e8e8;
  --shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
  --shadow-hover: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
  --radius-sm: 8rpx;
  --radius-md: 16rpx;
  --radius-lg: 24rpx;
  
  background-color: var(--bg-color);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

/* ========== 容器 ========== */
.container {
  min-height: 100vh;
  padding-bottom: 40rpx;
  opacity: 1;
  transition: opacity 0.2s ease-in-out;
}

/* ========== 页面标题区 ========== */
.page-header {
  position: relative;
  margin: 30rpx 30rpx 30rpx;
  padding: 60rpx 30rpx 60rpx;
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  border-bottom: 2rpx solid var(--border-color);
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  border-radius: 24rpx;
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s ease-in-out;
}

.header-content {
  position: relative;
  z-index: 1;
  text-align: center;
}

.header-title {
  font-size: 36rpx;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8rpx;
  text-shadow: 0 1rpx 2rpx rgba(0, 0, 0, 0.1);
}

.header-subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 400;
}

/* ========== 区块卡片 ========== */
.section {
  background: var(--card-bg);
  border-radius: 24rpx;
  margin: 0 30rpx 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  overflow: hidden;
  transform: translateY(0);
  opacity: 1;
  transition: all 0.3s ease;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 30rpx;
  position: relative;
  justify-content: space-between;
}

.section-icon {
  width: 48rpx;
  height: 48rpx;
  font-size: 36rpx;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
}

.data-icon {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.cloud-icon {
  background: linear-gradient(135deg, #f0f5ff 0%, #f5f8ff 100%);
}

.about-icon {
  background: linear-gradient(135deg, #fff7e6 0%, #fff9f0 100%);
}

.changelog-icon {
  background: linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%);
}

.icon-text {
  font-size: 32rpx;
}

.section-title {
  flex: 1;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.section-body {
  padding: 0 30rpx 30rpx;
}

/* ========== 按钮网格 ========== */
.btn-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.grid-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx 20rpx;
  background: var(--bg-color);
  border-radius: 16rpx;
  transition: all 0.2s ease;
}

.grid-btn:active {
  transform: scale(0.96);
  opacity: 0.9;
}

.btn-icon {
  font-size: 40rpx;
  margin-bottom: 12rpx;
}

.btn-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

/* 按钮颜色 */
.export-btn {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.share-btn {
  background: linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%);
}

.import-btn {
  background: linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%);
}

.clear-btn {
  background: linear-gradient(135deg, #fff2f0 0%, #fff5f5 100%);
}

.clear-btn .btn-text {
  color: var(--danger-color);
}

/* ========== 弹窗样式 ========== */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.modal-mask.show {
  opacity: 1;
}

.modal-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.9);
  width: 85%;
  max-width: 600rpx;
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  z-index: 999;
  opacity: 0;
  transition: all 0.3s ease;
  box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.2);
}

.modal-container.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28rpx;
  border-bottom: 2rpx solid var(--border-color);
  position: relative;
}

.modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  text-align: center;
  padding-left: 48rpx;
  padding-right: 48rpx;
}

.modal-close {
  position: absolute;
  right: 28rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-color);
}

.modal-close:active {
  background: var(--border-color);
}

.close-icon {
  font-size: 36rpx;
  color: var(--text-tertiary);
  line-height: 1;
}

.modal-body {
  padding: 28rpx;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.modal-footer {
  display: flex;
  gap: 20rpx;
  padding: 0 28rpx 28rpx;
  flex-direction: row;
  justify-content: space-between;
}

.modal-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  border-radius: var(--radius-md);
  font-size: 28rpx;
  font-weight: 500;
  border: none;
  padding: 0;
  margin: 0;
}

.btn-cancel {
  background: var(--bg-color);
  color: var(--text-secondary);
}

.btn-cancel:active {
  background: var(--border-color);
}

.btn-confirm {
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
  color: #ffffff;
}

.btn-confirm:active {
  opacity: 0.9;
}

/* ========== 表单样式 ========== */
.form-group {
  margin-bottom: 24rpx;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
}

.form-input {
  height: 80rpx;
  background: var(--bg-color);
  border-radius: var(--radius-md);
  padding: 0 20rpx;
  font-size: 28rpx;
  color: var(--text-primary);
}

/* ========== 响应式适配 ========== */
@media (max-width: 375px) {
  .btn-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16rpx;
  }

  .grid-btn {
    padding: 24rpx 16rpx;
  }

  .btn-icon {
    font-size: 36rpx;
  }

  .btn-text {
    font-size: 24rpx;
  }
}

/* 平板设备适配 */
@media (min-width: 768px) {
  .container {
    max-width: 750rpx;
    margin: 0 auto;
  }

  .btn-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  /* 页面标题区平板适配 */
  .page-header {
    margin: 40rpx 40rpx 40rpx;
    padding: 80rpx 40rpx 80rpx;
  }

  .header-title {
    font-size: 40rpx;
  }

  .header-subtitle {
    font-size: 28rpx;
  }

  /* 区块卡片平板适配 */
  .section {
    margin: 0 40rpx 40rpx;
  }

  .section-header {
    padding: 40rpx;
  }

  .section-body {
    padding: 0 40rpx 40rpx;
  }

  /* 按钮网格平板适配 */
  .grid-btn {
    padding: 40rpx 24rpx;
  }

  .btn-icon {
    font-size: 48rpx;
  }

  .btn-text {
    font-size: 30rpx;
  }
}

/* 横屏适配 */
@media (orientation: landscape) {
  .container {
    padding-bottom: 20rpx;
  }
  
  .page-header {
    margin: 20rpx 20rpx 20rpx;
    padding: 40rpx 30rpx 40rpx;
  }
  
  .section {
    margin: 0 20rpx 20rpx;
  }
  
  /* 横屏时的布局调整 */
  .sections-container {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20rpx;
  }
}
```

## 4. 页面逻辑模板

```javascript
// 通用页面逻辑模板
Page({

  /**
   * 页面的初始数据
   */
  data: {
    showModal: false,
    inputValue: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('页面加载', options);
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
  },

  /**
   * 处理按钮点击
   */
  handleAction(e) {
    console.log('按钮点击', e);
    // 处理具体操作
  },

  /**
   * 显示弹窗
   */
  showModal() {
    this.setData({ showModal: true });
  },

  /**
   * 隐藏弹窗
   */
  hideModal() {
    this.setData({ showModal: false });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 防止点击弹窗内容时关闭弹窗
  },

  /**
   * 输入框输入
   */
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  /**
   * 确认操作
   */
  confirmAction() {
    console.log('确认操作', this.data.inputValue);
    // 处理确认逻辑
    this.hideModal();
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: 'SYwork - 页面标题',
      path: '/pages/template/page-template'
    };
  },

  /**
   * 用户点击右上角分享到朋友圈
   */
  onShareTimeline() {
    return {
      title: 'SYwork - 页面标题',
      imageUrl: '' // 可以设置分享图片
    };
  }
});
```

## 5. 设计规范

### 5.1 命名规范
- **类名**：使用小写字母加连字符（kebab-case）
- **变量名**：使用驼峰命名法（camelCase）
- **文件名**：使用小写字母加下划线（snake_case）
- **ID**：使用小写字母加连字符（kebab-case）

### 5.2 代码规范
- **缩进**：使用2个空格
- **注释**：关键部分添加注释
- **模块化**：按功能模块化组织代码
- **性能**：避免不必要的计算和渲染

### 5.3 响应式设计规范
- **移动优先**：优先考虑移动设备体验
- **断点**：使用媒体查询适配不同设备
- **布局**：根据屏幕尺寸调整布局
- **字体**：根据屏幕尺寸调整字体大小

### 5.4 无障碍设计
- **语义化**：使用语义化的HTML结构
- **颜色对比度**：确保文本与背景的对比度
- **交互反馈**：为所有交互元素提供视觉反馈
- **键盘导航**：支持键盘导航

## 6. 组件使用指南

### 6.1 区块卡片
**使用场景**：功能模块分组、设置项分组
**特点**：带图标、标题和内容区域的卡片式布局
**示例**：
- 数据管理区块
- 云存储区块
- 关于区块
- 更新日志区块

### 6.2 按钮网格
**使用场景**：功能操作区、快捷操作
**特点**：网格布局的操作按钮，带图标和文字
**示例**：
- 导出数据
- 分享功能
- 导入数据
- 清空数据

### 6.3 弹窗组件
**使用场景**：表单输入、确认操作、信息提示
**特点**：居中弹窗，带标题、内容和按钮
**示例**：
- 确认删除
- 输入配置
- 信息提示

### 6.4 表单组件
**使用场景**：用户输入、设置项
**特点**：统一的输入框样式
**示例**：
- 文本输入
- 密码输入
- 数字输入

## 7. 最佳实践

### 7.1 性能优化
- **减少重绘**：避免频繁的DOM操作
- **使用缓存**：合理使用缓存减少重复计算
- **按需加载**：仅加载必要的资源
- **图片优化**：使用适当的图片格式和尺寸

### 7.2 用户体验
- **一致性**：保持界面元素的一致性
- **反馈**：为所有操作提供即时反馈
- **引导**：提供清晰的操作引导
- **容错**：处理用户可能的错误操作

### 7.3 可维护性
- **模块化**：按功能模块化组织代码
- **注释**：添加清晰的注释说明
- **命名**：使用清晰、语义化的命名
- **文档**：维护更新设计文档

## 8. 版本历史

- **v1.0.0** (2026-04-19)：初始版本，包含完整的UI设计系统和通用模板

---

本设计规范和通用模板旨在为SYwork微信小程序提供统一、专业的用户界面，确保良好的用户体验和开发效率。