# Seller Automation Extension (V2)

## 现有功能
- 订单报告下载自动化（allOrders 页面）
- 产品数据提取（导出 CSV）
- 定时调度、日志面板、侧边菜单切换

## 侧边菜单
- `订单报告`
- `产品提取`
- `运行日志`
- `扩展路线`

## 安全与低干扰设计
- 仅在 Seller Central 域名上注入内容脚本。
- 仅响应扩展主动消息，不自动改页面。
- 定时任务标签页后台打开（`active: false`）。
- 可配置任务结束后关闭自动化标签页。

## 安装
1. 打开 `chrome://extensions/`
2. 开启开发者模式
3. 点击“加载已解压的扩展程序”
4. 选择目录：`C:\Users\12180\amazon_data_extractor\extension`

## 使用
1. 先登录 Seller Central。
2. 打开插件侧边栏，按菜单切换功能。
3. 在 `订单报告` 中执行下载或配置定时任务。
4. 在 `产品提取` 中输入 ASIN 并导出 CSV。
5. 在 `运行日志` 中查看执行记录。

## 后续扩展位
- Ads reports automation
- Payments request automation
