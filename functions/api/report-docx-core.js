/**
 * report-docx-core.js
 * Word 文档生成核心。使用 docx npm 包将结构化报告草稿渲染为 .docx。
 * 纯函数模块：接收草稿数据，输出 Buffer。
 *
 * 依赖：docx (npm)
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle,
  ImageRun, PageBreak, SectionType
} from 'docx';

function clean(value, max = 500) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/**
 * 样式映射：母版 Word 标题样式 → docx HeadingLevel
 */
const STYLE_MAP = {
  'Heading 1': HeadingLevel.HEADING_1,
  'Heading 2': HeadingLevel.HEADING_2,
  'Heading 3': HeadingLevel.HEADING_3,
  'Heading 4': HeadingLevel.HEADING_4,
  'Normal': undefined,
  'Normal (Web)': undefined,
  'Body Text Indent 2': undefined,
  'Normal Table': undefined,
  'Caption': undefined,
  'Table Grid': undefined
};

/**
 * 字体和字号配置
 */
const FONT_CONFIG = {
  bodyFont: '仿宋',
  bodySize: 24,    // 12pt = 24 half-points
  heading1Font: '黑体',
  heading1Size: 36, // 18pt
  heading2Font: '黑体',
  heading2Size: 32, // 16pt
  heading3Font: '楷体',
  heading3Size: 28, // 14pt
  heading4Font: '仿宋',
  heading4Size: 24, // 12pt
  captionFont: '仿宋',
  captionSize: 21,  // 10.5pt
  tableFont: '仿宋',
  tableSize: 21
};

/**
 * 将段落内容转换为 TextRun 数组
 * @param {string} text
 * @param {object} fontConfig
 * @returns {TextRun[]}
 */
function textToRuns(text, fontConfig) {
  if (!text) return [new TextRun({ text: '', font: fontConfig.bodyFont, size: fontConfig.bodySize })];
  return [new TextRun({ text, font: fontConfig.bodyFont, size: fontConfig.bodySize })];
}

/**
 * 将模板段落块转换为 docx Paragraph
 * @param {object} block - 模板块 { id, style, text, images }
 * @param {object} contentOverride - 覆盖内容（来自草稿段落）
 * @param {object} fontConfig
 * @returns {Paragraph}
 */
function blockToParagraph(block, contentOverride, fontConfig) {
  const text = contentOverride?.text || block?.text || '';
  const style = block?.style || 'Normal';
  const headingLevel = STYLE_MAP[style];

  const runs = textToRuns(text, fontConfig);

  const opts = { children: runs };
  if (headingLevel !== undefined) {
    opts.heading = headingLevel;
  }
  if (style === 'Caption') {
    opts.spacing = { before: 100, after: 100 };
    opts.alignment = AlignmentType.CENTER;
    opts.children = [new TextRun({ text, font: fontConfig.captionFont, size: fontConfig.captionSize, italics: true })];
  }

  return new Paragraph(opts);
}

/**
 * 将表格块转换为 docx Table
 * @param {object} tableBlock - { id, style, rows: [{ cells: string[] }] }
 * @param {object[][]} dataRows - 动态数据行（可选，覆盖模板行）
 * @param {object} fontConfig
 * @returns {Table}
 */
function tableToDocx(tableBlock, dataRows, fontConfig) {
  const rows = dataRows || (tableBlock?.rows || []);

  const docxRows = rows.map((row, rowIndex) => {
    const cells = (row.cells || row || []).map((cellText) => {
      return new TableCell({
        children: [new Paragraph({
          children: [new TextRun({
            text: clean(String(cellText)),
            font: fontConfig.tableFont,
            size: fontConfig.tableSize,
            bold: rowIndex === 0
          })]
        })],
        width: { size: 100 / (row.cells || row || []).length, type: WidthType.PERCENTAGE }
      });
    });
    return new TableRow({ children: cells });
  });

  return new Table({
    rows: docxRows,
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
}

/**
 * 将段落内容（来自草稿）转换为 docx 元素
 * @param {object} sectionContent - { paragraphs: [{ id, text }] }
 * @param {object} fontConfig
 * @returns {Paragraph[]}
 */
function contentToParagraphs(sectionContent, fontConfig) {
  if (!sectionContent?.paragraphs) return [];
  return sectionContent.paragraphs
    .filter((p) => p && p.text)
    .map((p) => new Paragraph({
      children: [new TextRun({ text: p.text, font: fontConfig.bodyFont, size: fontConfig.bodySize })],
      spacing: { after: 200, line: 360 }
    }));
}

/**
 * 缺失图片占位段落
 * @param {string} label
 * @param {object} fontConfig
 * @returns {Paragraph}
 */
function missingImagePlaceholder(label, fontConfig) {
  return new Paragraph({
    children: [new TextRun({
      text: `[图片：${clean(label)}]`,
      font: fontConfig.captionFont,
      size: fontConfig.captionSize,
      color: '999999',
      italics: true
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 }
  });
}

/**
 * 构建完整 Word 文档
 *
 * @param {object} params
 * @param {object} params.template - 模板定义（template-schema.js 中的 SECTIONS）
 * @param {object[]} params.templateBlocks - 模板原始块列表（report-template-v1.json 的 blocks）
 * @param {object} params.draft - 草稿对象
 * @param {object[]} params.sections - 已生成/审核的段落列表
 * @param {object} params.context - 标准报告上下文
 * @param {object} params.calculations - 计算快照
 * @param {string} params.edition - 'review' | 'formal'
 * @returns {Promise<Buffer>} .docx 文件 Buffer
 */
export async function generateDocx({
  template, templateBlocks, draft, sections, context, calculations, edition
}) {
  const fontConfig = { ...FONT_CONFIG };
  const project = context?.project || {};
  const now = new Date();

  // 构建段落内容映射：sectionKey → content
  const sectionContentMap = {};
  for (const sec of sections || []) {
    sectionContentMap[sec.sectionKey] = sec.content;
  }

  // 遍历模板块，生成 docx 元素
  const children = [];

  for (const block of (templateBlocks || [])) {
    const style = block.style || '';

    // 标题块
    if (style.startsWith('Heading')) {
      const headingLevel = STYLE_MAP[style];
      const text = block.text || '';
      const override = findOverrideForBlock(block.id, sections);
      const finalText = override?.text || text;

      children.push(new Paragraph({
        children: [new TextRun({
          text: finalText,
          font: style === 'Heading 1' ? fontConfig.heading1Font :
                style === 'Heading 2' ? fontConfig.heading2Font :
                style === 'Heading 3' ? fontConfig.heading3Font :
                fontConfig.heading4Font,
          size: style === 'Heading 1' ? fontConfig.heading1Size :
                style === 'Heading 2' ? fontConfig.heading2Size :
                style === 'Heading 3' ? fontConfig.heading3Size :
                fontConfig.heading4Size,
          bold: true
        })],
        heading: headingLevel,
        spacing: { before: style === 'Heading 1' ? 400 : 200, after: 200 }
      }));
      continue;
    }

    // 表格块
    if (block.type === 'table') {
      const override = findOverrideForBlock(block.id, sections);
      const dataRows = override?.tableRows || null;
      children.push(tableToDocx(block, dataRows, fontConfig));
      children.push(new Paragraph({ children: [] })); // 空行间隔
      continue;
    }

    // 普通段落
    const override = findOverrideForBlock(block.id, sections);
    const text = override?.text || block.text || '';

    // 图片段落（缺失图片占位）
    if (block.images && block.images.length && !text) {
      const imgLabel = block.images[0]?.alt || '项目图片';
      children.push(missingImagePlaceholder(imgLabel, fontConfig));
      continue;
    }

    // Caption 样式
    if (style === 'Caption') {
      children.push(new Paragraph({
        children: [new TextRun({
          text,
          font: fontConfig.captionFont,
          size: fontConfig.captionSize,
          italics: true
        })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 }
      }));
      continue;
    }

    // 普通正文
    if (text) {
      children.push(new Paragraph({
        children: [new TextRun({ text, font: fontConfig.bodyFont, size: fontConfig.bodySize })],
        spacing: { after: 200, line: 360 }
      }));
    }
  }

  // 如果有草稿段落但模板块中未匹配到，追加到末尾
  for (const sec of sections || []) {
    if (sec.content?.paragraphs) {
      const alreadyUsed = sections.some((s) => s.id === sec.id);
      // 检查是否已有覆盖（避免重复）
      const hasOverride = (templateBlocks || []).some((b) => findOverrideForBlock(b.id, [sec]));
      if (!hasOverride) {
        for (const p of sec.content.paragraphs) {
          if (p.text) {
            children.push(new Paragraph({
              children: [new TextRun({ text: p.text, font: fontConfig.bodyFont, size: fontConfig.bodySize })],
              spacing: { after: 200, line: 360 }
            }));
          }
        }
      }
    }
  }

  // 页脚信息
  children.push(new Paragraph({ children: [] }));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `${edition === 'formal' ? '正式版' : '审核稿'} | ${project.name || ''} | 生成时间：${now.toLocaleDateString('zh-CN')}`,
      font: fontConfig.captionFont,
      size: 18,
      color: '999999'
    })],
    alignment: AlignmentType.CENTER
  }));

  // 创建文档
  const doc = new Document({
    creator: '智更 Smart Renew',
    title: `${project.name || '城市体检'}报告`,
    description: `由智更平台生成的${edition === 'formal' ? '正式' : '审核'}报告`,
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children
    }]
  });

  return Packer.toBuffer(doc);
}

/**
 * 在已审核段落中查找与模板块 ID 匹配的内容
 */
function findOverrideForBlock(blockId, sections) {
  if (!sections) return null;
  for (const sec of sections) {
    if (!sec.content) continue;
    // 检查段落覆盖
    if (sec.content.paragraphs) {
      for (const p of sec.content.paragraphs) {
        if (p.blockId === blockId) return p;
      }
    }
    // 检查 blockId 匹配
    if (sec.blockId === blockId) return sec.content;
  }
  return null;
}
