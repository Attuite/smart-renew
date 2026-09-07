# NP-04 问题编码、指标与整改建议关联交付记录

> 日期：2026-08-09
> 分支：`urban-health-business`
> 依据：`docs/main-parity-next-development-outline.md`

## 完成范围

- 标准库服务新增稳定版本标识，以及按 `PRB-*` 聚合问题类型、派生指标和整改建议的读取能力；
- 新增问题类型详情和整改建议接口；
- Business 正式问题新增可选 `problemCode/problemName`、派生 `indicatorCode/indicatorName`、`remediationSnapshot`、`bindingStatus` 和 `bindingAudit`；
- 新增标准绑定 PATCH 与审计 GET，继续使用 `expectedRevision` 和问题级审计；
- 支持 `unbound/suggested/confirmed/not-applicable`，未绑定问题不被阻断；
- 服务端不信任前端提交的指标编码或整改原文，所有派生字段来自同一标准库版本；
- 报告内容快照、问题表和 `issueBindingSnapshots` 冻结生成时的绑定信息；标准库后续变化不改写旧报告；
- Business GIS 正式问题修订面板加入绑定状态、问题类型和整改建议选择。

## 接口

```http
GET   /api/standards/problem-types/{problemCode}
GET   /api/standards/problem-types/{problemCode}/remediations
PATCH /api/issues/{issueId}/standard-binding
GET   /api/issues/{issueId}/standard-binding-audit
```

## 验证

```text
npm run check       PASS
npm test            PASS 207/207
npm run test:integration PASS 1/1
npm run test:e2e    PASS 9/9
git diff --check    PASS
```

NP-05 CloudBase真实运行接线和NP-06成果中心尚未开始。
