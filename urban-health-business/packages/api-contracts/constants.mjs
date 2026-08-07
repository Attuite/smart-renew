export const API_VERSION = '1.0.0';
export const SCHEMA_VERSION = '1.0.0';

export const WORKFLOW_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  READY: 'ready',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  FAILED: 'failed',
  STALE: 'stale',
  UNAVAILABLE: 'unavailable'
});

export const STAGES = Object.freeze([
  {
    id: 'collection',
    number: '01',
    title: '资料上传与治理',
    kicker: 'DATA GOVERNANCE',
    description: '接入并治理项目照片、外业记录、边界、路线与其他资料。'
  },
  {
    id: 'ai-analysis',
    number: '02',
    title: 'AI智能识别',
    kicker: 'AI ANALYSIS',
    description: '使用真实照片创建AI分析任务并保存候选问题。'
  },
  {
    id: 'human-review',
    number: '03',
    title: '人工复核',
    kicker: 'HUMAN REVIEW',
    description: '确认、修改、排除或补录候选问题，形成正式问题。'
  },
  {
    id: 'gis-and-issues',
    number: '04',
    title: 'GIS落图与问题清单',
    kicker: 'GIS & ISSUES',
    description: '将正式问题绑定到真实空间并形成可复现分析。'
  },
  {
    id: 'indicators',
    number: '05',
    title: '指标核算',
    kicker: 'INDICATORS',
    description: '准备真实指标输入并等待外部指标引擎接入。'
  },
  {
    id: 'reports',
    number: '06',
    title: '报告生成',
    kicker: 'REPORTS',
    description: '使用真实数据快照编辑、生成和归档报告。'
  }
]);

export const SERVICE_NAMES = Object.freeze([
  'database',
  'storage',
  'ai',
  'gis',
  'indicator',
  'report'
]);
