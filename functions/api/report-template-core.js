function text(value, max = 20000) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max);
}

function reviewFields(value = {}, requiresReview = false) {
  const status = requiresReview && value.reviewStatus !== 'approved' ? 'pending' : 'approved';
  return {
    requiresReview,
    reviewStatus: status,
    reviewReason: text(value.reviewReason, 300),
    reviewedBy: status === 'approved' ? text(value.reviewedBy, 120) : '',
    reviewedAt: status === 'approved' ? text(value.reviewedAt, 60) : ''
  };
}

function normalizeImage(value = {}) {
  const src = text(value.src, 500);
  return {
    id: text(value.id, 120),
    src: src.startsWith('assets/report-templates/') ? src : '',
    alt: text(value.alt, 500)
  };
}

function normalizeParagraph(value, index) {
  const requiresReview = Boolean(value.requiresReview);
  return {
    id: text(value.id || `p-${index + 1}`, 120),
    type: 'paragraph',
    style: text(value.style || 'Normal', 120),
    text: text(value.text),
    images: (Array.isArray(value.images) ? value.images : []).slice(0, 20).map(normalizeImage).filter((item) => item.src),
    ...reviewFields(value, requiresReview)
  };
}

function normalizeTable(value, index) {
  const rows = (Array.isArray(value.rows) ? value.rows : []).slice(0, 2000).map((row, rowIndex) => {
    const requiresReview = Boolean(row.requiresReview);
    return {
      id: text(row.id || `t-${index + 1}-r-${rowIndex + 1}`, 120),
      cells: (Array.isArray(row.cells) ? row.cells : []).slice(0, 40).map((cell) => text(cell)),
      cellImages: (Array.isArray(row.cellImages) ? row.cellImages : []).slice(0, 40).map((images) =>
        (Array.isArray(images) ? images : []).slice(0, 20).map(normalizeImage).filter((item) => item.src)
      ),
      ...reviewFields(row, requiresReview)
    };
  });
  return {
    id: text(value.id || `t-${index + 1}`, 120),
    type: 'table',
    style: text(value.style || 'Table', 120),
    rows
  };
}

export function reportTemplateStats(template) {
  let pendingReview = 0;
  let approvedReview = 0;
  let paragraphs = 0;
  let tables = 0;
  for (const block of template.blocks || []) {
    if (block.type === 'paragraph') {
      paragraphs += 1;
      if (block.requiresReview) {
        if (block.reviewStatus === 'approved') approvedReview += 1;
        else pendingReview += 1;
      }
    } else if (block.type === 'table') {
      tables += 1;
      for (const row of block.rows || []) {
        if (!row.requiresReview) continue;
        if (row.reviewStatus === 'approved') approvedReview += 1;
        else pendingReview += 1;
      }
    }
  }
  return { blocks: (template.blocks || []).length, paragraphs, tables, pendingReview, approvedReview };
}

export function normalizeReportTemplate(input = {}, expectedId = '') {
  const id = text(input.id || expectedId, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,119}$/.test(id) || (expectedId && id !== expectedId)) {
    throw new Error('报告模板编号无效');
  }
  const blocks = (Array.isArray(input.blocks) ? input.blocks : []).slice(0, 5000).map((block, index) => {
    if (block?.type === 'table') return normalizeTable(block, index);
    return normalizeParagraph(block || {}, index);
  });
  if (!blocks.length) throw new Error('报告模板内容不能为空');
  const now = new Date().toISOString();
  const template = {
    id,
    name: text(input.name || '智更城市体检正式 Word 模板', 200),
    version: Math.max(1, Number(input.version) || 1),
    status: text(input.status || 'reviewing', 40),
    sourceFile: text(input.sourceFile, 500),
    sourceFileName: text(input.sourceFileName, 300),
    createdAt: text(input.createdAt, 60) || now,
    updatedAt: now,
    updatedBy: text(input.updatedBy, 120),
    reviewPolicy: text(input.reviewPolicy, 1000),
    page: input.page && typeof input.page === 'object' ? input.page : {},
    blocks
  };
  template.stats = reportTemplateStats(template);
  template.status = template.stats.pendingReview ? 'reviewing' : 'approved';
  return template;
}
