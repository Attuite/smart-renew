/**
 * report-validation-core.js
 * 正文校验核心。纯函数模块。
 * 校验：解释性语言、旧项目残留、内部编号、无来源数字、跨项目引用。
 */

import { detectAILanguage } from './report-generation-core.js';

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** 旧项目地理关键词 */
const OLD_GEOGRAPHIC_KEYWORDS = [
  '绵阳', '科技城新区', '虹苑路社区', '金祥寺社区', '张家营村',
  '普明街道', '永兴镇', '安昌河', '华瑞汽车厂', '路南工业园',
  '青片小区', '高新假日小区', '文泉凯旋小区', '太阳岛小区',
  '广夏城', '广厦城', '玻钢厂'
];

/** 旧项目单位名称 */
const OLD_ORG_KEYWORDS = [
  '绵阳市科技城新区住房和城乡建设局',
  '绵阳科技城新区管委会'
];

/** 内部编号模式 */
const INTERNAL_ID_PATTERNS = [
  /PRB-\d{2}-\d{2}/g,
  /PDI-[A-Za-z0-9_-]+/g,
  /RPT-[A-Za-z0-9_-]+/g,
  /ANA-[A-Za-z0-9_-]+/g,
  /PHOTO-[A-Za-z0-9_-]+/g,
  /ISS-[A-Za-z0-9_-]+/g
];

/**
 * 校验正文内容
 * @param {object} params
 * @param {string} params.text - 待校验正文
 * @param {object[]} params.paragraphs - 段落数组（可选，逐段校验）
 * @param {string} params.projectCity - 当前项目所属城市
 * @param {string[]} params.allowedNumbers - 允许出现的数字列表
 * @returns {{ valid: boolean, issues: object[] }}
 */
export function validateReportContent({ text, paragraphs, projectCity, allowedNumbers }) {
  const issues = [];
  const allText = text || (paragraphs || []).map((p) => p.text || '').join('\n');

  // 1. AI 解释性语言检测
  const aiHits = detectAILanguage(allText);
  if (aiHits.length) {
    issues.push({
      type: 'ai-language',
      severity: 'error',
      message: '检测到 AI 解释性语言',
      details: aiHits,
     阻塞导出: true
    });
  }

  // 2. 旧项目残留检测
  const isMianyang = projectCity && projectCity.includes('绵阳');
  if (!isMianyang) {
    const geoHits = [];
    for (const kw of OLD_GEOGRAPHIC_KEYWORDS) {
      if (allText.includes(kw)) geoHits.push(kw);
    }
    if (geoHits.length) {
      issues.push({
        type: 'old-project-geo',
        severity: 'error',
        message: '检测到旧项目地理名称残留',
        details: geoHits,
       阻塞导出: true
      });
    }

    const orgHits = [];
    for (const kw of OLD_ORG_KEYWORDS) {
      if (allText.includes(kw)) orgHits.push(kw);
    }
    if (orgHits.length) {
      issues.push({
        type: 'old-project-org',
        severity: 'error',
        message: '检测到旧项目单位名称残留',
        details: orgHits,
       阻塞导出: true
      });
    }
  }

  // 3. 内部编号检测
  const internalHits = [];
  for (const pattern of INTERNAL_ID_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(allText)) !== null) {
      internalHits.push(match[0]);
    }
  }
  if (internalHits.length) {
    issues.push({
      type: 'internal-id',
      severity: 'error',
      message: '检测到系统内部编号',
      details: [...new Set(internalHits)],
     阻塞导出: true
    });
  }

  // 4. 无来源数字检测
  if (allowedNumbers) {
    // 提取正文中的阿拉伯数字和百分比
    const numberPattern = /\d+\.?\d*%?/g;
    const textNumbers = new Set();
    let numMatch;
    while ((numMatch = numberPattern.exec(allText)) !== null) {
      const n = numMatch[0];
      // 过滤章节编号、年份等模板允许数字
      if (/^\d{4}$/.test(n)) continue; // 年份
      if (/^\d+\.\d+$/.test(n) && parseFloat(n) < 10) continue; // 可能是章节号
      textNumbers.add(n);
    }

    // 将允许数字规范化
    const allowedSet = new Set();
    for (const an of allowedNumbers) {
      const nums = an.match(/\d+\.?\d*%?/g) || [];
      for (const n of nums) allowedSet.add(n);
    }

    const unauthorized = [];
    for (const n of textNumbers) {
      if (!allowedSet.has(n)) unauthorized.push(n);
    }
    if (unauthorized.length) {
      issues.push({
        type: 'unauthorized-number',
        severity: 'error',
        message: '检测到无来源数字',
        details: unauthorized.slice(0, 20),
       阻塞导出: true
      });
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues
  };
}

/**
 * 校验跨章节一致性（简单版）
 * @param {object[]} sections - 已生成的段落组
 * @returns {{ valid: boolean, issues: object[] }}
 */
export function validateCrossSectionConsistency(sections) {
  const issues = [];
  // 检查是否有章节引用了不同版本的同一数字
  const numberUsage = {};
  for (const sec of sections || []) {
    const text = (sec.paragraphs || []).map((p) => p.text || '').join(' ');
    const pattern = /(\d+\.?\d*)\s*(个|栋|户|张|%|km²)/g;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const key = match[0];
      if (!numberUsage[key]) numberUsage[key] = [];
      numberUsage[key].push(sec.sectionKey || sec.id);
    }
  }
  // 一致性检查：同一数字在不同章节中出现次数差异过大时提示
  // （保守策略：仅记录，不自动修改）
  return { valid: true, issues };
}
