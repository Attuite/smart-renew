/**
 * template-schema.js
 * 模板块定义、内容类型和章节映射。
 * 唯一数据来源：report-template-v1.json
 *
 * 公共挂载：window.SmartRenewReportStudioModules.templateSchema
 */
(function () {
  'use strict';

  var NS = window.SmartRenewReportStudioModules =
    window.SmartRenewReportStudioModules || {};

  /** 内容类型枚举 */
  var BlockType = Object.freeze({
    FIXED_TEXT: 'fixed-text',
    FIELD_TEXT: 'field-text',
    CALCULATED_TEXT: 'calculated-text',
    GENERATED_PARAGRAPH: 'generated-paragraph',
    CONDITIONAL_PARAGRAPH: 'conditional-paragraph',
    LOOP_TABLE: 'loop-table',
    IMAGE_SLOT: 'image-slot',
    CAPTION: 'caption'
  });

  /** 段落状态枚举 */
  var SectionStatus = Object.freeze({
    NOT_GENERATED: 'not-generated',
    GENERATING: 'generating',
    GENERATED: 'generated',
    EDITED: 'edited',
    APPROVED: 'approved',
    LOCKED: 'locked',
    ERROR: 'error'
  });

  /** 草稿状态枚举 */
  var DraftStatus = Object.freeze({
    CREATED: 'created',
    DATA_READY: 'data-ready',
    CALCULATED: 'calculated',
    GENERATING: 'generating',
    REVIEWING: 'reviewing',
    EXPORTABLE: 'exportable',
    EXPORTED: 'exported',
    FAILED: 'failed'
  });

  /** 旧项目地理关键词（非绵阳项目不得出现） */
  var OLD_GEOGRAPHIC_KEYWORDS = [
    '绵阳', '科技城新区', '虹苑路社区', '金祥寺社区', '张家营村',
    '普明街道', '永兴镇', '安昌河', '华瑞汽车厂', '路南工业园',
    '青片小区', '高新假日小区', '文泉凯旋小区', '太阳岛小区',
    '广夏城', '广厦城', '玻钢厂'
  ];

  /** 旧项目单位名称 */
  var OLD_ORGANIZATION_KEYWORDS = [
    '绵阳市科技城新区住房和城乡建设局',
    '绵阳科技城新区管委会'
  ];

  /** 母版章节定义 */
  var SECTIONS = [
    {
      key: 'cover',
      title: '封面',
      blockRange: ['p-0001', 'p-0004'],
      blocks: [
        { id: 'p-0001', type: BlockType.FIELD_TEXT, field: 'project.name', label: '项目名称' },
        { id: 'p-0002', type: BlockType.FIELD_TEXT, field: 'report.year', label: '报告年份', suffix: '年城市体检报告' },
        { id: 'p-0003', type: BlockType.FIELD_TEXT, field: 'report.organizer', label: '编制单位' },
        { id: 'p-0004', type: BlockType.FIELD_TEXT, field: 'report.generatedYearMonth', label: '生成年月' }
      ]
    },
    {
      key: 'chapter-1',
      title: '一、工作概述',
      blockRange: ['p-0006', 'p-0057'],
      subsections: [
        {
          key: '1.1-background',
          title: '1.1 工作背景',
          blockRange: ['p-0007', 'p-0012'],
          blocks: [
            { id: 'p-0008', type: BlockType.FIXED_TEXT, label: '城市体检定义通用段落' },
            { id: 'p-0009', type: BlockType.FIXED_TEXT, label: '政策背景通用段落' },
            { id: 'p-0010', type: BlockType.GENERATED_PARAGRAPH, label: '住建厅要求（需去旧引用）' },
            { id: 'p-0011', type: BlockType.GENERATED_PARAGRAPH, label: '城市体检实践（需替换项目）' },
            { id: 'p-0012', type: BlockType.GENERATED_PARAGRAPH, label: '项目组织（需替换单位）' }
          ]
        },
        {
          key: '1.2-objective',
          title: '1.2 工作目标',
          blockRange: ['p-0013', 'p-0014'],
          blocks: [
            { id: 'p-0014', type: BlockType.FIXED_TEXT, label: '工作目标通用文案' }
          ]
        },
        {
          key: '1.3-principle',
          title: '1.3 工作原则',
          blockRange: ['p-0015', 'p-0021'],
          blocks: [
            { id: 'p-0017', type: BlockType.FIXED_TEXT, label: '精准定位城市病源' },
            { id: 'p-0019', type: BlockType.FIXED_TEXT, label: '建立体检更新协同机制' },
            { id: 'p-0021', type: BlockType.FIXED_TEXT, label: '细化服务层级破解民生难题' }
          ]
        },
        {
          key: '1.3-scope',
          title: '1.3 体检评估范围',
          blockRange: ['p-0022', 'p-0037'],
          blocks: [
            { id: 'p-0023', type: BlockType.FIXED_TEXT, label: '四维度通用说明' },
            { id: 'p-0025', type: BlockType.GENERATED_PARAGRAPH, label: '住房维度范围', requiredFacts: ['housing.communityCount', 'housing.buildingCount'] },
            { id: 'p-0028', type: BlockType.IMAGE_SLOT, label: '住房维度分析图' },
            { id: 'p-0027', type: BlockType.GENERATED_PARAGRAPH, label: '小区维度范围', requiredFacts: ['housing.communityCount'] },
            { id: 'p-0031', type: BlockType.GENERATED_PARAGRAPH, label: '街区维度范围' },
            { id: 'p-0035', type: BlockType.GENERATED_PARAGRAPH, label: '城区维度范围' }
          ]
        },
        {
          key: '1.4-organization',
          title: '1.4 工作组织和技术路线',
          blockRange: ['p-0038', 'p-0057'],
          blocks: [
            { id: 'p-0040', type: BlockType.GENERATED_PARAGRAPH, label: '工作组织详情' },
            { id: 'p-0055', type: BlockType.FIXED_TEXT, label: '技术路线说明' },
            { id: 'p-0056', type: BlockType.IMAGE_SLOT, label: '技术路线图', reusePolicy: 'generic' },
            { id: 'p-0057', type: BlockType.CAPTION, label: '技术路线图题' }
          ]
        }
      ]
    },
    {
      key: 'chapter-2',
      title: '二、构建指标体系与评价方法',
      blockRange: ['p-0058', 'p-0086'],
      subsections: [
        {
          key: '2.1-system',
          title: '2.1 指标体系构建',
          blockRange: ['p-0059', 'p-0080'],
          blocks: [
            { id: 'p-0060', type: BlockType.FIXED_TEXT, label: '指标体系概述' },
            { id: 'table-t-001', type: BlockType.LOOP_TABLE, label: '片区特色指标表', source: 'indicators', filter: 'category=characteristic' },
            { id: 'table-t-002', type: BlockType.LOOP_TABLE, label: '住房维度指标表', source: 'indicators', filter: 'category=housing' },
            { id: 'table-t-003', type: BlockType.LOOP_TABLE, label: '小区维度指标表', source: 'indicators', filter: 'category=community' },
            { id: 'table-t-004', type: BlockType.LOOP_TABLE, label: '街区维度指标表', source: 'indicators', filter: 'category=block' },
            { id: 'table-t-005', type: BlockType.LOOP_TABLE, label: '城区维度指标表', source: 'indicators', filter: 'category=urban' }
          ]
        },
        {
          key: '2.2-evaluation',
          title: '2.2 指标评价方法',
          blockRange: ['p-0081', 'p-0086'],
          blocks: [
            { id: 'table-t-006', type: BlockType.FIXED_TEXT, label: '评价等级标准表' },
            { id: 'p-0085', type: BlockType.FIXED_TEXT, label: '城区维度评价方法' }
          ]
        }
      ]
    },
    {
      key: 'chapter-3',
      title: '三、总体结论',
      blockRange: ['p-0087', 'p-0117'],
      subsections: [
        {
          key: '3.1-achievements',
          title: '3.1 工作成效',
          blockRange: ['p-0088', 'p-0106'],
          blocks: [
            { id: 'p-0090', type: BlockType.GENERATED_PARAGRAPH, label: '(1)生态宜居建设', reviewRequired: true },
            { id: 'p-0093', type: BlockType.GENERATED_PARAGRAPH, label: '(2)历史文化保护', reviewRequired: true },
            { id: 'p-0096', type: BlockType.GENERATED_PARAGRAPH, label: '(3)安全韧性水平', reviewRequired: true },
            { id: 'p-0099', type: BlockType.GENERATED_PARAGRAPH, label: '(4)智慧高效建设', reviewRequired: true },
            { id: 'p-0102', type: BlockType.GENERATED_PARAGRAPH, label: '(5)街区通勤配套', reviewRequired: true },
            { id: 'p-0105', type: BlockType.GENERATED_PARAGRAPH, label: '(6)住房居住品质', reviewRequired: true }
          ]
        },
        {
          key: '3.2-issues',
          title: '3.2 存在问题',
          blockRange: ['p-0107', 'p-0117'],
          blocks: [
            { id: 'p-0109', type: BlockType.GENERATED_PARAGRAPH, label: '(1)基础设施建设', requiredFacts: ['issues.totalCount'] },
            { id: 'p-0111', type: BlockType.GENERATED_PARAGRAPH, label: '(2)公服配套布局' },
            { id: 'p-0113', type: BlockType.GENERATED_PARAGRAPH, label: '(3)滨水生态' },
            { id: 'p-0115', type: BlockType.GENERATED_PARAGRAPH, label: '(4)街区运行' },
            { id: 'p-0117', type: BlockType.GENERATED_PARAGRAPH, label: '(5)老旧空间' }
          ]
        }
      ]
    },
    {
      key: 'chapter-4',
      title: '四、指标分析评价',
      blockRange: ['p-0118', 'p-0916'],
      subsections: [
        {
          key: '4.1-urban',
          title: '4.1 城区（城市）维度',
          blockRange: ['p-0119', 'p-0349'],
          indicators: [
            { key: 'urban-sports-area', title: '人均体育场地面积', heading4: 'p-0123', table: 't-007', image: 'p-0132' },
            { key: 'urban-culture-area', title: '人均公共文化设施面积', heading4: 'p-0134' },
            { key: 'urban-road-density', title: '城市道路网密度', heading4: 'p-0143' },
            { key: 'urban-river-ecology', title: '滨河岸线生态化比例', heading4: 'p-0152' },
            { key: 'urban-walkability', title: '片区慢行交通友好指数', heading4: 'p-0161' },
            { key: 'urban-river-recreation', title: '滨水游憩指数', heading4: 'p-0170' },
            { key: 'urban-park-area', title: '城市人均公园绿地面积', heading4: 'p-0179', image: 'p-0188' },
            { key: 'urban-green-building', title: '新建建筑中绿色建筑占比', heading4: 'p-0190' },
            { key: 'urban-flood-control', title: '安昌河防洪达标区覆盖率', heading4: 'p-0199' },
            { key: 'urban-heritage-rate', title: '历史文化街区挂牌建档率', heading4: 'p-0208' },
            { key: 'urban-heritage-incidents', title: '历史文化资源负面事件数', heading4: 'p-0217' },
            { key: 'urban-illegal-demolition', title: '擅自拆除历史建筑数量', heading4: 'p-0226' },
            { key: 'urban-construction-death', title: '房屋市政工程安全事故死亡率', heading4: 'p-0235' },
            { key: 'urban-fire-station', title: '城市消防站服务半径覆盖率', heading4: 'p-0244', image: 'p-0253' },
            { key: 'urban-flood-point', title: '严重易涝积水点数量', heading4: 'p-0255' },
            { key: 'urban-dual-use', title: '平急两用潜力设施数量', heading4: 'p-0262', image: 'p-0269' },
            { key: 'urban-old-community', title: '老旧小区改造完成率', heading4: 'p-0271', image: 'p-0280' },
            { key: 'urban-idle-land', title: '闲置土地及低效用地面积比例', heading4: 'p-0282', image: 'p-0292' },
            { key: 'urban-urban-village', title: '城中村改造完成率', heading4: 'p-0294', image: 'p-0303' },
            { key: 'urban-construction-monitor', title: '建筑施工安全监测覆盖率', heading4: 'p-0305' },
            { key: 'urban-fire-monitor', title: '高层建筑火灾监测预警覆盖率', heading4: 'p-0314' },
            { key: 'urban-smart-management', title: '城市运行管理服务智慧化水平', heading4: 'p-0323' }
          ]
        },
        {
          key: '4.2-block',
          title: '4.2 街区维度',
          blockRange: ['p-0350', 'p-0567'],
          indicators: [
            { key: 'block-middle-school', title: '中学服务半径覆盖率', heading4: 'p-0354', tables: ['t-009', 't-010'], images: ['p-0365', 'p-0367'] },
            { key: 'block-15min-life', title: '十五分钟生活圈达标率', heading4: 'p-0369', images: ['p-0397', 'p-0401', 'p-0404', 'p-0407', 'p-0410'] },
            { key: 'block-sports-venue', title: '未达标多功能运动场地', heading4: 'p-0416' },
            { key: 'block-culture-center', title: '未达标文化活动中心', heading4: 'p-0425' },
            { key: 'block-park-coverage', title: '公园绿化活动场地覆盖率', heading4: 'p-0434', image: 'p-0445' },
            { key: 'block-parking-issue', title: '乱停乱放道路数量', heading4: 'p-0447', image: 'p-0456' },
            { key: 'block-river-crossing', title: '跨河通道便捷度评分', heading4: 'p-0458', table: 't-011' },
            { key: 'block-commute-time', title: '通勤平均时耗', heading4: 'p-0482' },
            { key: 'block-old-commercial', title: '需更新老旧商业街区', heading4: 'p-0505', image: 'p-0516' },
            { key: 'block-old-factory', title: '需更新老旧厂区', heading4: 'p-0518', image: 'p-0532' },
            { key: 'block-old-living', title: '需更新老旧生活街区', heading4: 'p-0534' }
          ]
        },
        {
          key: '4.3-community',
          title: '4.3 小区（社区）维度',
          blockRange: ['p-0568', 'p-0780'],
          indicators: [
            { key: 'comm-elderly-care', title: '未达标养老服务设施小区数量', heading4: 'p-0573' },
            { key: 'comm-childcare', title: '未达标婴幼儿照护设施小区数量', heading4: 'p-0587' },
            { key: 'comm-kindergarten', title: '未达标幼儿园小区数量', heading4: 'p-0600' },
            { key: 'comm-primary-school', title: '小学学位问题小区数量', heading4: 'p-0613' },
            { key: 'comm-convenience', title: '未达标便民商业设施小区数量', heading4: 'p-0624' },
            { key: 'comm-parking', title: '停车泊位缺口小区数量', heading4: 'p-0635' },
            { key: 'comm-ev-charging', title: '新能源汽车充电桩缺口小区数量', heading4: 'p-0645' },
            { key: 'comm-ebike-charging', title: '未配建电动自行车充电设施小区数量', heading4: 'p-0656' },
            { key: 'comm-service-station', title: '未达标社区综合服务站小区数量', heading4: 'p-0666' },
            { key: 'comm-health-station', title: '未达标社区卫生服务站小区数量', heading4: 'p-0677' },
            { key: 'comm-activity-venue', title: '未达标公共活动场地区小区数量', heading4: 'p-0687' },
            { key: 'comm-waste-sort', title: '未实施生活垃圾分类小区数量', heading4: 'p-0700' },
            { key: 'comm-property-mgmt', title: '未实施物业管理小区数量', heading4: 'p-0712' },
            { key: 'comm-smart-upgrade', title: '需智慧化改造小区数量', heading4: 'p-0724' }
          ]
        },
        {
          key: '4.4-housing',
          title: '4.4 住房维度',
          blockRange: ['p-0781', 'p-0916'],
          indicators: [
            { key: 'house-safety', title: '存在使用安全隐患住宅数量', heading4: 'p-0786' },
            { key: 'house-gas', title: '存在燃气安全隐患住宅数量', heading4: 'p-0795' },
            { key: 'house-corridor', title: '存在楼道安全隐患住宅数量', heading4: 'p-0805' },
            { key: 'house-envelope', title: '存在围护安全隐患住宅数量', heading4: 'p-0820' },
            { key: 'house-performance', title: '住宅性能不达标住宅数量', heading4: 'p-0832' },
            { key: 'house-pipeline', title: '存在管线管道破损住宅数量', heading4: 'p-0839' },
            { key: 'house-water', title: '入户水质水压不达标住宅数量', heading4: 'p-0849' },
            { key: 'house-aging', title: '需适老化改造住宅数量', heading4: 'p-0858' },
            { key: 'house-energy', title: '需节能改造住宅数量', heading4: 'p-0869' },
            { key: 'house-digital', title: '需数字化改造住宅数量', heading4: 'p-0876' }
          ]
        }
      ]
    },
    {
      key: 'chapter-5',
      title: '五、城市治理建议',
      blockRange: ['p-0917', 'p-0985'],
      subsections: [
        { key: '5.1-housing-advice', title: '5.1 住房维度', blockRange: ['p-0918', 'p-0929'], type: BlockType.GENERATED_PARAGRAPH },
        { key: '5.2-community-advice', title: '5.2 小区（社区）维度', blockRange: ['p-0930', 'p-0947'], type: BlockType.GENERATED_PARAGRAPH },
        { key: '5.3-block-advice', title: '5.3 街区维度', blockRange: ['p-0948', 'p-0960'], type: BlockType.GENERATED_PARAGRAPH },
        { key: '5.4-urban-advice', title: '5.4 城区维度', blockRange: ['p-0961', 'p-0985'], type: BlockType.GENERATED_PARAGRAPH }
      ]
    },
    {
      key: 'chapter-6',
      title: '六、行动建议',
      blockRange: ['p-0986', 'p-1117'],
      subsections: [
        { key: '6.1-action-plan', title: '6.1 行动计划', blockRange: ['p-0987', 'p-1055'], type: BlockType.LOOP_TABLE },
        { key: '6.2-mechanism', title: '6.2 机制建设建议', blockRange: ['p-1056', 'p-1090'], type: BlockType.FIXED_TEXT },
        { key: '6.3-timeline', title: '6.3 项目建设时序', blockRange: ['p-1091', 'p-1100'], type: BlockType.LOOP_TABLE },
        { key: '6.4-funding', title: '6.4 资金来源建议', blockRange: ['p-1101', 'p-1117'], type: BlockType.GENERATED_PARAGRAPH }
      ]
    },
    {
      key: 'appendix-2',
      title: '附录2：指标分析评价结果统计表',
      blockRange: ['p-1118', 'p-1122'],
      tables: [
        { id: 't-021', label: '住房维度统计表', source: 'calculations', filter: 'category=housing' },
        { id: 't-022', label: '小区维度统计表', source: 'calculations', filter: 'category=community' },
        { id: 't-023', label: '街区维度统计表', source: 'calculations', filter: 'category=block' },
        { id: 't-024', label: '城区维度统计表', source: 'calculations', filter: 'category=urban' }
      ]
    },
    {
      key: 'appendix-3',
      title: '附录3：问题清单及台账一览表',
      blockRange: ['p-1123', 'p-1127'],
      tables: [
        { id: 't-025', label: '住房维度问题清单', source: 'officialIssues', filter: 'indicatorCategory=housing' },
        { id: 't-026', label: '小区维度问题清单', source: 'officialIssues', filter: 'indicatorCategory=community' },
        { id: 't-027', label: '街区维度问题清单', source: 'officialIssues', filter: 'indicatorCategory=block' },
        { id: 't-028', label: '城区维度问题清单', source: 'officialIssues', filter: 'indicatorCategory=urban' }
      ]
    },
    {
      key: 'appendix-4',
      title: '附录4：治理建议清单一览表',
      blockRange: ['p-1128', 'p-1132'],
      tables: [
        { id: 't-029', label: '住房维度治理建议', source: 'officialIssues', filter: 'indicatorCategory=housing' },
        { id: 't-030', label: '小区维度治理建议', source: 'officialIssues', filter: 'indicatorCategory=community' },
        { id: 't-031', label: '街区维度治理建议', source: 'officialIssues', filter: 'indicatorCategory=block' },
        { id: 't-032', label: '城区维度治理建议', source: 'officialIssues', filter: 'indicatorCategory=urban' }
      ]
    },
    {
      key: 'appendix-5',
      title: '附录5：城市更新项目库',
      blockRange: ['p-1133', 'p-1166'],
      tables: [
        { id: 't-033', label: '城市更新项目库', source: 'actionProjects' }
      ]
    }
  ];

  /**
   * 按 key 查找章节定义
   * @param {string} sectionKey
   * @returns {object|null}
   */
  function findSection(sectionKey) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var s = SECTIONS[i];
      if (s.key === sectionKey) return s;
      if (s.subsections) {
        for (var j = 0; j < s.subsections.length; j++) {
          if (s.subsections[j].key === sectionKey) return s.subsections[j];
        }
      }
    }
    return null;
  }

  /**
   * 获取所有需要 LLM 生成的章节 key
   * @returns {string[]}
   */
  function getGenerationRequiredSections() {
    var keys = [];
    function walk(items) {
      (items || []).forEach(function (s) {
        if (s.type === BlockType.GENERATED_PARAGRAPH || s.type === BlockType.CONDITIONAL_PARAGRAPH) {
          keys.push(s.key);
        }
        if (s.subsections) walk(s.subsections);
      });
    }
    walk(SECTIONS);
    return keys;
  }

  /**
   * 检查文本中是否包含旧项目关键词
   * @param {string} text
   * @param {string} currentProjectCity 当前项目所属城市
   * @returns {string[]} 匹配到的关键词列表
   */
  function detectOldProjectContent(text, currentProjectCity) {
    if (!text) return [];
    var hits = [];
    if (currentProjectCity && currentProjectCity.indexOf('绵阳') >= 0) return hits;
    OLD_GEOGRAPHIC_KEYWORDS.forEach(function (kw) {
      if (text.indexOf(kw) >= 0) hits.push(kw);
    });
    OLD_ORGANIZATION_KEYWORDS.forEach(function (kw) {
      if (text.indexOf(kw) >= 0) hits.push(kw);
    });
    return hits;
  }

  NS.templateSchema = {
    BlockType: BlockType,
    SectionStatus: SectionStatus,
    DraftStatus: DraftStatus,
    SECTIONS: SECTIONS,
    OLD_GEOGRAPHIC_KEYWORDS: OLD_GEOGRAPHIC_KEYWORDS,
    OLD_ORGANIZATION_KEYWORDS: OLD_ORGANIZATION_KEYWORDS,
    findSection: findSection,
    getGenerationRequiredSections: getGenerationRequiredSections,
    detectOldProjectContent: detectOldProjectContent
  };
})();
