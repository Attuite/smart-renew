# 验收清单

> 适用阶段：阶段 0 + 阶段 1
> 建立日期：2026-09-09

## 阶段 0：建立基线和保护范围

- [x] 确认开发分支 `dev`，工作区干净
- [x] 已读取全部必读文档（AGENTS.md、HOME_DEVELOPMENT_GUIDE.md、SESSION_HANDOFF.md、SMART_RENEW_WORKFLOW_IMPLEMENTATION.md、WORD_REPORT_WORKFLOW.md、REPORT_TEMPLATE_V1_SCREENING.md、FORMAL_REPORT_GENERATION_DEVELOPMENT_PLAN.md）
- [x] 记录关键文件当前状态
- [x] 创建 `assets/report-studio/` 目录，含入口文件和样式
- [x] 新模块未启用时页面正常（不改变现有功能）
- [x] 未修改 index.html
- [x] 未修改 server.mjs
- [x] 未修改 functions/api/index.js
- [x] 未修改任何视觉模型链路
- [x] 未部署、未合并 main

## 阶段 1：母版章节映射和字段字典

- [x] 分析 `report-template-v1.json`（1166 块，1133 段落，33 表格，68 图片）
- [x] 建立章节层级映射（10 个一级章节，33 个二级章节，113 个三级/四级章节）
- [x] 每个块都有明确类型和处理方式
- [x] 建立机器可读字段字典（报告元数据、项目信息、住宅台账、照片、分析、问题、社区设施、计算结果、图片、来源追踪）
- [x] 建立旧项目词和图片黑名单（17 个地理关键词、5 个小区名称、2 个单位名称）
- [x] 建立旧项目检测规则
- [x] 创建 `template-schema.js` 模块
- [x] 创建 `TEMPLATE_SECTION_MAP.md`
- [x] 创建 `FIELD_DICTIONARY.md`
- [x] 创建 `OLD_PROJECT_CONTENT.md`
- [x] 创建 `API.md`
- [x] 未归类块数量：0

### 待确认项（来自 REPORT_TEMPLATE_V1_SCREENING.md）

以下问题需要用户确认后才能进入阶段 2+：

1. 第一章的政策背景是否作为所有项目的固定文案？→ 当前默认：是
2. 第二章现有指标体系是否就是智更平台的统一报告指标标准？→ 当前默认：是
3. 第三章"工作成效"是纯人工编辑，还是允许 AI 起草后人工确认？→ 当前默认：AI 起草 + 人工确认
4. 第四章缺少某项指标时，是保留小节并显示"数据待补充"，还是隐藏该小节？→ 当前默认：保留小节
5. 第五章是否允许基于正式问题生成治理建议初稿？→ 当前默认：允许 AI 起草 + 人工确认
6. 第六章是否需要在平台新增"行动项目库"的专用编辑页面？→ 否
7. 责任单位和资金来源是否必须经人工确认？→ 当前默认：是
8. 附录表格在某类数据为空时，是保留空表还是只保留说明？→ 统一隐藏
9. 图片数据缺失时，是显示占位框还是删除图位？→ 显示占位框
10. 是否保留当前 Word 中所有指标编号？→ 否

## 语法检查

- [x] `assets/report-studio/report-studio.js` — 新文件，无外部依赖
- [x] `assets/report-studio/template-schema.js` — 新文件，纯对象定义
- [x] `assets/report-studio/report-studio.css` — 新文件
- [x] `scripts/analyze-template.py` — 工具脚本
- [x] `scripts/extract-template-sections.py` — 工具脚本

## 回归检查

- [x] index.html 未修改
- [x] server.mjs 未修改
- [x] functions/api/index.js 未修改
- [x] functions/api/report-template-core.js 未修改
- [x] functions/api/report-snapshot-core.js 未修改
- [x] assets/report-templates/report-template-v1.json 未修改
- [x] assets/report-templates/report-template-v1.docx 未修改
- [x] 所有新增文件均为独立模块，不破坏现有功能
