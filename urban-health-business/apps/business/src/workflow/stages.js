export const stageCatalog = Object.freeze([
  { id: 'collection', number: '01', title: '资料上传与治理', kicker: 'DATA GOVERNANCE', description: '接入并治理项目照片、外业记录、边界、路线与其他资料。' },
  { id: 'ai-analysis', number: '02', title: 'AI智能识别', kicker: 'AI ANALYSIS', description: '使用真实照片创建AI分析任务并保存候选问题。' },
  { id: 'human-review', number: '03', title: '人工复核', kicker: 'HUMAN REVIEW', description: '确认、修改、排除或补录候选问题，形成正式问题。' },
  { id: 'gis-and-issues', number: '04', title: 'GIS落图与问题清单', kicker: 'GIS & ISSUES', description: '将正式问题绑定到真实空间并形成可复现分析。' },
  { id: 'indicators', number: '05', title: '指标核算', kicker: 'INDICATORS', description: '浏览标准与整改目录，准备真实输入并等待外部指标引擎接入。' },
  { id: 'reports', number: '06', title: '报告生成', kicker: 'REPORTS', description: '使用真实数据快照编辑、生成和归档报告。' }
]);

export const statusLabels = Object.freeze({
  not_started: '未开始',
  ready: '可开始',
  in_progress: '进行中',
  blocked: '已阻塞',
  completed: '已完成',
  failed: '执行失败',
  stale: '结果已过期',
  unavailable: '待接入'
});
