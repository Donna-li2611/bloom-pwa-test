# Bloom · Earlier Web/PWA Interaction Prototype

**A self-directed personal project, initiated and developed by Xiaozhen Li (Donna).** I carry out the project's design, research and development myself, using AI tools in the workflow.

**This is a separate, earlier product-exploration build.**

For the main portfolio case, product decisions, current public code scope and verification records, start with **[Bloom · Habit & Life Tracker](https://github.com/Donna-li2611/bloom-daily-habit-tracker)**.

This repository is retained to show the Web/PWA interaction exploration. It contains demonstration data and should not be read as the current iPhone application, a production service or evidence of real-user outcomes. AI-backed actions depend on their configured services.

The detailed feature list below describes this prototype version. Prototype history is preserved; this README refresh does not upgrade or change its executable behaviour.

[Portfolio home](https://github.com/Donna-li2611)

**README reviewed: 2026-10-06.**

---

## 中文定位

**这是我个人独立开展的产品原型，设计与制作由我本人完成，过程中使用AI工具辅助。**

这是Bloom早期的Web/PWA交互验证版本，作为产品探索过程保留。**正式作品集介绍请先看[主作品库](https://github.com/Donna-li2611/bloom-daily-habit-tracker)**，其中集中整理产品取舍、公开代码范围与验证记录。

这里的示例数据不代表真实用户结果，功能清单对应此原型版本，也不代表当前iPhone版本。此次仅整理说明，不改动原型功能。

---

# Bloom 产品原型 v0.2

这是 Bloom 的可点击 Web/PWA 产品体验原型，用来验证界面、信息结构和核心操作，不是正式应用。

## 本轮验证范围

- Today：亲切问候、每日鼓励、今日记录状态和各习惯进度。
- 打卡：睡眠、起床、运动、阅读和体重使用不同的输入方式。
- 阅读：支持最多 9 张图片、逐张 OCR 校对、合并原文、AI 感悟和保存前标题确认。
- 统计：支持周、月、季、年，展示睡眠、体重和打卡矩阵。
- 记录：收纳带图片或文字内容的阅读、运动和梦境记录；纯数值打卡不会进入记录页。
- 梦境：记录梦境原文，调用默认 AI 模型生成可编辑解读，并将两者保存为同一条记录。
- 运动：打卡与记录统一使用一个“身体感受/训练内容”字段，不再拆分为两个内容区。
- 图片持久化：用户上传的阅读、运动图片保存到 IndexedDB 媒体表，记录通过图片 ID 关联；旧版 Base64 图片会自动迁移。未来梦境 AI 生成图片沿用同一媒体表。
- 标题：保存前可手动编辑或请求 AI 建议；AI 不可用时仍可正常保存。
- 设置：保留习惯创建、编辑、隐藏、删除和拖拽排序，并可选择默认 AI 模型。
- 语言：支持简体中文和英文即时切换。
- 数据：只保存在当前设备的浏览器。
- 验证数据：预置 2026 年 7 月 13–29 日的两周半历史；7 月 30 日星期四保持为空，供真实打卡测试。
- PWA：支持向日葵主屏图标、独立窗口和基础离线缓存。

## 打开

在本目录运行：

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8766/index.html`。

直接通过 `file://` 打开可以体验普通 Web 功能，但 PWA 安装和离线缓存需要 HTTPS 正式网址，或开发电脑的 `localhost`。

## 原型边界

- 不包含账号、云端数据库、HealthKit 或原生 iOS 功能。
- 时间输入使用浏览器控件表达交互意图，正式 iPhone 版本再使用原生滚轮。
- 模拟数据用于展示积累后的 Review 价值，不代表真实健康结论。
- 图片使用当前浏览器本地空间保存；大量图片可能受设备存储上限影响。语音入口仍是交互原型。
- 当前不包含账号、同步、提醒、积分、奖励卡、番茄钟和待办事项。
- 梦境解读只用于自我观察与联想，不代表心理诊断或预言；梦境图片生成仍是后续方向。
