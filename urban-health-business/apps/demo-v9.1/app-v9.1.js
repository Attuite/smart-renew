(function () {
  "use strict";

  function runtimeDiagnosticStep(step, detail) {
    if (typeof window.__runtimeDiagnosticStep === "function") window.__runtimeDiagnosticStep(step, detail || "");
  }

  function runtimeDiagnosticError(error, phase) {
    if (typeof window.__runtimeDiagnosticError === "function") window.__runtimeDiagnosticError(error, phase || "runtime");
    else console.error("[V9.1] " + (phase || "runtime"), error);
  }

  runtimeDiagnosticStep("主脚本已解析", "app-v9.1.js");

  const SPATIAL_DEMO_START = 14.0;
  const SPATIAL_DEMO_DURATION = 4.0;
  const DEMO_DURATION = 60.0;
  const shiftedDemoTime = (seconds) => seconds >= SPATIAL_DEMO_START ? seconds + SPATIAL_DEMO_DURATION : seconds;
  const ALLOWED_DEMO_STATES = new Set(["idle", "playing", "paused", "completed"]);
  const AUTO_AI_IMAGE_SECONDS = 1;

  const cityProjects = [
    {
      id: "P1",
      name: "西仪厂城市更新改造项目",
      shortName: "西仪厂更新",
      x: 27.67,
      y: 47.87,
      area: "西安市 · 西仪厂片区",
      type: "工业遗产",
      status: "available"
    },
    {
      id: "P2",
      name: "新城区幸福林带西光厂更新片区",
      shortName: "幸福林带西光厂",
      x: 45.17,
      y: 36.37,
      area: "西安市 · 新城区",
      type: "厂住更新",
      status: "available"
    },
    {
      id: "P3",
      name: "莲湖区洒金桥及西仓老旧街区更新片区",
      shortName: "洒金桥及西仓",
      x: 46.92,
      y: 60.29,
      area: "西安市 · 莲湖区",
      type: "历史街区",
      status: "available"
    },
    {
      id: "P4",
      name: "西安市东新街片区老旧小区及街区改造项目",
      shortName: "东新街片区",
      x: 56.59,
      y: 46.04,
      area: "西安市 · 东新街片区",
      type: "老旧住区",
      status: "available"
    },
    {
      id: "P5",
      name: "浐灞国际港西安灯泡厂更新片区",
      shortName: "西安灯泡厂",
      x: 67.41,
      y: 39.18,
      area: "西安市 · 浐灞国际港",
      type: "工业遗产",
      status: "available"
    },
    {
      id: "P6",
      name: "纺织城工业遗址及老旧厂区城市更新项目",
      shortName: "纺织城工业遗址",
      x: 70.01,
      y: 56.05,
      area: "西安市 · 纺织城片区",
      type: "工业遗产",
      status: "available"
    }
  ];

  const modules = [
    {
      number: "01",
      title: "资料上传与治理",
      goal: "统一接入现场照片、无人机影像、调查表及GIS数据，并补全照片点位与设计师踏勘路线关系。",
      input: "现场照片、无人机影像、外业调查表、GIS图层、照片EXIF定位与踏勘顺序。",
      process: "分类与去重、定位解析、缺失坐标补绑、路线清洗与关联、格式检查、完整性校验。",
      output: "标准化项目数据包、照片拍摄点图层、设计师踏勘路线图层、照片—点位—路线关联表和数据完整度结果。",
      available: true
    },
    {
      number: "02",
      title: "AI智能识别",
      goal: "自动解析现场影像，识别建筑、设施、道路与公共空间问题。",
      input: "已治理的现场照片、无人机影像、影像定位信息、问题识别规则与历史问题样本。",
      process: "图像预处理、场景分类、目标检测、问题类型判断、风险初判、置信度计算与指标映射建议。",
      output: "43项AI候选问题、问题框选位置、初步风险等级、识别置信度、建议关联指标与7项重点待人工复核任务。",
      available: true
    },
    {
      number: "03",
      title: "人工复核",
      goal: "通过专业人员修正误判、漏判和问题等级。",
      input: "AI候选问题、原始照片和识别置信度。",
      process: "确认、修改、排除、补录、调整风险等级。",
      output: "完成后形成42项有效问题、1项排除记录和完整人工复核日志。",
      available: true
    },
    {
      number: "04",
      title: "GIS落图与问题清单",
      goal: "关联项目实测问题与城市公共空间条件，形成可定位、可筛选、可追溯的空间事实台账。",
      input: "42项有效问题及项目边界、建筑、规划、道路、交通、公共服务、商业、蓝绿历史文化8类本地图层。",
      process: "问题空间绑定、500/800/1000米周边条件分析、数据来源登记及影像—问题—GIS点位追溯关联。",
      output: "问题点位、空间归属、周边距离与数量、GIS绑定状态；不进行指标评分或达标判断。",
      available: true
    },
    {
      number: "05",
      title: "指标核算",
      goal: "将问题台账与空间条件映射至体检指标，形成可计算、可解释、可追溯的评价结果。",
      input: "42项GIS有效问题、6 / 18 / 18风险分布、42项空间绑定结果及8类GIS基础图层。",
      process: "指标映射、权重计算、阈值判断、分类得分、综合得分、未达标指标识别与核算依据追溯。",
      output: "建筑安全78、社区环境84、综合得分82.4、3项未达标指标及指标证据链。",
      available: true
    },
    {
      number: "06",
      title: "报告生成",
      goal: "汇集问题、空间与指标成果，形成可审查、可追溯的城市体检报告草稿。",
      input: "42项有效问题、42 / 42 GIS空间绑定、8类GIS图层、10项指标、综合得分82.4及3项未达标指标。",
      process: "报告模板选择、章节编排、图表与地图快照、结论与证据组织、分页版本管理及来源登记。",
      output: "综合体检报告、专项体检报告、空间问题分析报告三类固定Demo预览样张。",
      available: true
    }
  ];

  const reportTemplateData = {
    comprehensive: {
      reportId: "RPT-COMP-01", title: "综合体检报告", subtitle: "城市数智体检综合成果草稿", pageCount: 8,
      pages: [
        { pageId: "RPT-01", title: "项目封面", kicker: "城市更新项目数智体检", blocks: [["当前项目", "西仪厂城市更新改造项目"], ["报告版本", "V0.1 · 草稿预览"], ["成果状态", "Demo预置报告样张"]] },
        { pageId: "RPT-02", title: "项目概况与数据基础", kicker: "PROJECT & DATA", blocks: [["现场照片", "186张"], ["无人机影像", "12张"], ["调查表", "3份"], ["GIS基础图层", "8类"]] },
        { pageId: "RPT-03", title: "综合体检结论", kicker: "ASSESSMENT SUMMARY", blocks: [["综合得分", "82.4"], ["建筑安全", "78"], ["社区环境", "84"], ["未达标指标", "3项"]] },
        { pageId: "RPT-04", title: "指标核算与未达标项", kicker: "INDICATOR REVIEW", blocks: [["IND-BS-02", "79 · 未达标"], ["IND-BS-03", "72 · 未达标"], ["IND-CE-01", "76 · 未达标"], ["核算规则", "Demo预置规则 V1.0"]] },
        { pageId: "RPT-05", title: "风险与问题清单", kicker: "ISSUES & RISK", blocks: [["有效问题", "42项"], ["高风险", "6项"], ["中风险", "18项"], ["一般问题", "18项"]] },
        { pageId: "RPT-06", title: "GIS空间分析", kicker: "SPATIAL ANALYSIS", blocks: [["空间绑定", "42 / 42"], ["分析范围", "500m / 800m / 1000m"], ["空间图层", "8类"], ["当前成果", "空间事实关联"]] },
        { pageId: "RPT-07", title: "更新方向建议", kicker: "IMPROVEMENT DIRECTIONS", blocks: [["建筑安全", "优先治理外立面与附着物风险"], ["社区环境", "完善道路、设施与公共空间品质"], ["工作边界", "建议方向不替代专项设计与审批"]] },
        { pageId: "RPT-08", title: "证据与追溯附录", kicker: "EVIDENCE APPENDIX", blocks: [["典型链路", "IMG-XA-001 → DEF-021 → MAP-021"], ["指标节点", "IND-BS-03"], ["报告节点", "RPT-04"], ["证据问题", "42项"]] }
      ]
    },
    special: {
      reportId: "RPT-SPEC-01", title: "专项体检报告", subtitle: "建筑安全 / 社区环境专项草稿", pageCount: 5,
      pages: [
        { pageId: "RPT-SPEC-01", title: "专项报告封面", kicker: "SPECIAL REPORT", blocks: [["专项主题", "建筑安全"], ["报告状态", "草稿预览"]] },
        { pageId: "RPT-SPEC-02", title: "专项结论", kicker: "SPECIAL SUMMARY", blocks: [["建筑安全", "78"], ["关联问题", "23项"], ["未达标指标", "2项"]] },
        { pageId: "RPT-SPEC-03", title: "关键问题", kicker: "KEY ISSUES", blocks: [["IND-BS-02", "79"], ["IND-BS-03", "72"], ["高风险问题", "6项"]] },
        { pageId: "RPT-SPEC-04", title: "空间分布", kicker: "SPATIAL EVIDENCE", blocks: [["GIS绑定", "42 / 42"], ["证据影像", "IMG-XA-001—006"]] },
        { pageId: "RPT-SPEC-05", title: "专项证据附录", kicker: "TRACE APPENDIX", blocks: [["典型追溯", "IMG-XA-001 → DEF-021 → MAP-021 → IND-BS-03"]] }
      ]
    },
    spatial: {
      reportId: "RPT-SPATIAL-01", title: "空间问题分析报告", subtitle: "问题点位与公共空间条件分析草稿", pageCount: 6,
      pages: [
        { pageId: "RPT-SPATIAL-01", title: "空间分析封面", kicker: "SPATIAL REPORT", blocks: [["有效问题", "42项"], ["GIS绑定", "42 / 42"]] },
        { pageId: "RPT-SPATIAL-02", title: "项目边界与问题分布", kicker: "BOUNDARY & ISSUES", blocks: [["高风险", "6项"], ["中风险", "18项"], ["一般问题", "18项"]] },
        { pageId: "RPT-SPATIAL-03", title: "道路与交通条件", kicker: "MOBILITY", blocks: [["分析范围", "500m / 800m / 1000m"], ["数据性质", "Demo预置空间分析"]] },
        { pageId: "RPT-SPATIAL-04", title: "公共与商业服务", kicker: "PUBLIC SERVICES", blocks: [["公共空间数据", "固定本地数据"], ["外部请求", "0"]] },
        { pageId: "RPT-SPATIAL-05", title: "蓝绿与历史文化", kicker: "GREEN & HERITAGE", blocks: [["GIS基础图层", "8类"], ["数据状态", "已本地化"]] },
        { pageId: "RPT-SPATIAL-06", title: "空间证据附录", kicker: "SPATIAL TRACE", blocks: [["MAP问题点位", "42项"], ["典型追溯", "DEF-021 → MAP-021"]] }
      ]
    }
  };

  function validateReportTemplateData() {
    const entries = Object.entries(reportTemplateData);
    const pageCounts = entries.map(([, report]) => report.pages.length);
    const pageIds = entries.flatMap(([, report]) => report.pages.map((page) => page.pageId));
    if (entries.length !== 3 || pageCounts.join("/") !== "8/5/6") throw new Error("06报告模板数量或页数不符合3类、8/5/6页锁定口径");
    if (new Set(pageIds).size !== pageIds.length) throw new Error("06报告页面编号存在重复");
    if (!entries.every(([, report]) => report.pages.every((page) => page.blocks && page.blocks.length))) throw new Error("06报告页面内容不完整");
    return { reportCount: entries.length, pageCounts, pageIds };
  }

  function createAIRecognitionData() {
    const images = [
      { id: "IMG-XA-001", file: "./assets/recognition/01-facade-damage.jpg", title: "外墙饰面脱落", location: "P1 · 西仪厂片区北侧", point: "108.9142, 34.2578", type: "photo", alt: "老旧住宅外墙饰面大面积脱落现场照片" },
      { id: "IMG-XA-002", file: "./assets/recognition/02-exposed-pipes.jpg", title: "外露管线", location: "P1 · 生活区东巷", point: "108.9161, 34.2556", type: "photo", alt: "老旧住宅外墙管线外露现场照片" },
      { id: "IMG-XA-003", file: "./assets/recognition/03-ac-disorder.jpg", title: "空调外机安装杂乱", location: "P1 · 生活区3号楼", point: "108.9128, 34.2549", type: "photo", alt: "住宅立面空调外机安装杂乱现场照片" },
      { id: "IMG-XA-004", file: "./assets/recognition/04-road-damage.jpg", title: "道路破损", location: "P1 · 社区中轴道路", point: "108.9153, 34.2538", type: "photo", alt: "社区内部道路破损和龟裂现场照片" },
      { id: "IMG-XA-005", file: "./assets/recognition/05-facility-damage.jpg", title: "公共设施损坏", location: "P1 · 北区活动场", point: "108.9137, 34.2526", type: "photo", alt: "社区座椅和垃圾箱等公共设施损坏现场照片" },
      { id: "IMG-XA-006", file: "./assets/recognition/06-illegal-construction.jpg", title: "违建疑似点", location: "P1 · 住宅组团西侧", point: "108.9119, 34.2564", type: "photo", alt: "住宅首层疑似违法搭建构筑物现场照片" }
    ];

    const issueGroups = [
      [
        ["外墙饰面脱落", "建筑安全", "high", "房屋安全·外墙完好度", "大面积饰面层缺失，边缘存在继续剥落风险"],
        ["外墙空鼓疑似", "建筑安全", "high", "房屋安全·外墙完好度", "纹理与阴影特征显示局部基层可能空鼓"],
        ["墙体裂缝", "建筑安全", "medium", "房屋安全·结构表观", "竖向裂缝连续分布，需专业复核裂缝性质"],
        ["防水层老化", "建筑维护", "medium", "宜居环境·建筑维护", "墙体表面存在渗水和泛碱特征"],
        ["门窗构件锈蚀", "建筑维护", "medium", "宜居环境·附属构件", "金属构件出现明显锈蚀与涂层脱落"],
        ["墙面污染", "环境品质", "general", "宜居环境·立面整洁度", "立面存在积尘、污渍及色差"],
        ["雨棚锈蚀", "建筑维护", "general", "房屋安全·附属构件", "入口雨棚边缘出现锈蚀和老化"],
        ["立面附着物杂乱", "环境品质", "general", "宜居环境·立面秩序", "线缆及附着设施影响立面秩序"]
      ],
      [
        ["外露管线", "市政设施", "high", "韧性安全·管线安全", "多类管线沿外墙裸露敷设且交叉密集"],
        ["管线排布凌乱", "市政设施", "medium", "宜居环境·管线秩序", "水平与竖向管线缺少统一桥架收纳"],
        ["燃气管防护不足", "市政设施", "medium", "韧性安全·燃气设施", "燃气支管邻近通行空间且缺少防撞提示"],
        ["排水管老化", "市政设施", "medium", "韧性安全·排水设施", "排水管表面老化，接口处存在污渍"],
        ["管线固定件缺失", "市政设施", "general", "韧性安全·管线安全", "局部管线跨度较大，固定构件不足"],
        ["线缆低垂", "市政设施", "general", "宜居环境·管线秩序", "弱电线缆垂落并接近步行高度"],
        ["管线标识缺失", "市政设施", "general", "治理效能·设施标识", "不同用途管线缺少清晰标识"]
      ],
      [
        ["空调外机安装杂乱", "建筑设施", "medium", "宜居环境·立面秩序", "外机位置、标高和支架形式缺少统一组织"],
        ["外机支架锈蚀", "建筑设施", "medium", "房屋安全·附属构件", "部分金属支架出现锈蚀与变形迹象"],
        ["冷凝水散排", "建筑设施", "medium", "宜居环境·排水组织", "冷凝水管未集中接入排水系统"],
        ["设备管线未规整", "建筑设施", "general", "宜居环境·立面秩序", "空调管线沿立面自由敷设"],
        ["外机遮挡窗洞", "建筑设施", "general", "宜居环境·采光通风", "局部外机靠近窗洞并影响通风"],
        ["设备间距不足", "建筑设施", "general", "韧性安全·设备运行", "相邻设备净距不足，影响散热与检修"],
        ["立面附着设施杂乱", "环境品质", "general", "宜居环境·立面整洁度", "多类附着设施形成连续视觉干扰"]
      ],
      [
        ["道路破损", "道路空间", "high", "宜居环境·道路完好度", "路面大面积破碎、松散并形成不连续高差"],
        ["路面龟裂", "道路空间", "medium", "宜居环境·道路完好度", "网状裂缝密集，基层可能存在疲劳损伤"],
        ["坑槽积水", "道路空间", "medium", "韧性安全·排水能力", "低洼坑槽存在积水痕迹"],
        ["人行边界破损", "道路空间", "medium", "宜居环境·步行连续性", "人行空间边缘破碎且界面不连续"],
        ["井盖周边沉降", "道路空间", "general", "韧性安全·道路设施", "井周铺装存在轻微差异沉降"],
        ["路面修补不平", "道路空间", "general", "宜居环境·道路平整度", "多次修补形成明显接缝与高差"],
        ["路缘石松动", "道路空间", "general", "宜居环境·道路完好度", "局部路缘石错位并出现缝隙"]
      ],
      [
        ["公共设施损坏", "公共空间", "high", "宜居环境·公共设施完好率", "座椅构件断裂且垃圾箱箱体破损"],
        ["信息栏破损", "公共空间", "medium", "治理效能·信息设施", "信息栏面板老化并存在大面积残胶"],
        ["健身器材老化", "公共空间", "medium", "宜居环境·健身设施", "器材涂层磨损，局部连接件需复核"],
        ["座椅构件缺失", "公共空间", "medium", "宜居环境·休憩设施", "座椅木条断裂并缺失，无法正常使用"],
        ["地坪裂缝", "公共空间", "general", "宜居环境·场地平整度", "活动场地面存在连续裂缝"],
        ["设施锈蚀", "公共空间", "general", "宜居环境·设施维护", "金属构件出现锈蚀与涂层老化"],
        ["绿化边界破损", "公共空间", "general", "生态宜居·绿地维护", "树池和绿化边界局部破损"]
      ],
      [
        ["违建疑似点", "空间治理", "high", "治理效能·违法建设治理", "首层附加构筑物与原建筑界面、材料明显不一致"],
        ["临时搭建构筑物", "空间治理", "medium", "治理效能·空间秩序", "轻型屋面和围护结构疑似后期搭建"],
        ["消防通道占用", "安全治理", "medium", "韧性安全·消防通道", "构筑物与停放车辆挤占通行净宽"],
        ["加建围护结构", "空间治理", "medium", "治理效能·违法建设治理", "砖砌及玻璃围护与主体结构做法不同"],
        ["雨棚搭设不规范", "建筑设施", "general", "房屋安全·附属构件", "雨棚支撑与固定方式缺少统一处理"],
        ["建筑退界占用", "空间治理", "general", "治理效能·公共空间秩序", "加建部分延伸至公共通行界面"],
        ["附属物安全隐患", "安全治理", "general", "韧性安全·附属构件", "附着构件老化并存在松动迹象"]
      ]
    ];

    const bboxGroups = [
      [[43,8,35,54],[34,18,18,38],[62,18,13,48],[46,49,23,23],[19,22,18,46],[5,62,25,16],[31,72,26,12],[10,39,22,20]],
      [[27,11,57,72],[20,31,62,23],[58,42,25,38],[69,8,16,72],[39,24,12,55],[13,47,43,13],[53,57,24,16]],
      [[9,8,70,62],[14,13,18,27],[34,22,16,34],[25,43,43,18],[59,10,17,33],[45,31,22,25],[12,56,62,16]],
      [[12,38,78,48],[25,43,50,34],[42,39,24,22],[71,31,19,39],[19,51,15,24],[53,57,26,26],[77,43,13,20]],
      [[3,54,43,34],[5,20,34,29],[57,34,20,25],[7,61,38,26],[44,55,24,24],[65,34,15,28],[28,48,19,22]],
      [[22,29,60,54],[18,31,64,26],[4,55,27,25],[39,43,42,39],[24,24,45,18],[9,46,19,37],[63,14,21,34]]
    ];

    const issues = [];
    issueGroups.forEach((group, imageIndex) => {
      group.forEach((definition, localIndex) => {
        const globalIndex = issues.length;
        const rawConfidence = 90.1 + ((globalIndex * 13) % 57) / 10;
        const bbox = bboxGroups[imageIndex][localIndex];
        issues.push({
          issueId: "AI-XA-" + String(globalIndex + 1).padStart(3, "0"),
          imageId: images[imageIndex].id,
          projectId: "P1",
          type: definition[0],
          category: definition[1],
          severity: definition[2],
          confidence: rawConfidence,
          bbox: { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] },
          location: images[imageIndex].point,
          suggestedIndicator: definition[3],
          reviewStatus: "pending",
          priorityReview: [0, 1, 8, 15, 22, 29, 36].includes(globalIndex),
          description: definition[4],
          revealAt: (globalIndex + 1) / 43
        });
      });
    });

    const rawAverage = issues.reduce((sum, issue) => sum + issue.confidence, 0) / issues.length;
    issues.forEach((issue) => { issue.confidence = Number((issue.confidence - rawAverage + 92.6).toFixed(1)); });
    const roundedSum = issues.reduce((sum, issue) => sum + issue.confidence, 0);
    issues[issues.length - 1].confidence = Number((issues[issues.length - 1].confidence + 92.6 * issues.length - roundedSum).toFixed(1));

    return {
      totalImages: 198,
      processedImages: 0,
      candidateIssues: 0,
      targetCandidateIssues: 43,
      pendingReview: 7,
      averageConfidence: 0,
      targetAverageConfidence: 92.6,
      riskTotals: { high: 6, medium: 18, general: 19 },
      images,
      issues
    };
  }

  const aiRecognitionData = createAIRecognitionData();

  const SURVEY_ROUTE_ID = "SURVEY-ROUTE-01";
  const SURVEY_ROUTE_POINTS = Object.freeze([
    [14, 72], [20, 58], [31, 44], [44, 34], [58, 38], [70, 49], [79, 63], [72, 78], [56, 84], [38, 78], [24, 68]
  ]);
  const SURVEY_STOP_DEFINITIONS = Object.freeze([
    ["STOP-01", 18, 61, "北侧入口与沿街界面"], ["STOP-02", 29, 46, "老旧住宅立面集中核验"],
    ["STOP-03", 42, 35, "社区道路与管线节点"], ["STOP-04", 58, 39, "公共活动空间与设施"],
    ["STOP-05", 72, 52, "东侧住宅组团"], ["STOP-06", 77, 68, "南侧道路和停车界面"],
    ["STOP-07", 60, 82, "社区服务与绿地节点"], ["STOP-08", 36, 77, "西侧建筑及附属空间"]
  ]);

  function spatialCollectionClamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function createPhotoLocationData() {
    return Object.freeze(Array.from({ length: 186 }, (_, index) => {
      const routePosition = index / 185 * (SURVEY_ROUTE_POINTS.length - 1);
      const segment = Math.min(SURVEY_ROUTE_POINTS.length - 2, Math.floor(routePosition));
      const local = routePosition - segment;
      const from = SURVEY_ROUTE_POINTS[segment];
      const to = SURVEY_ROUTE_POINTS[segment + 1];
      const offsetX = Math.sin((index + 1) * 1.71) * 2.35;
      const offsetY = Math.cos((index + 1) * 1.37) * 2.1;
      const x = spatialCollectionClamp(from[0] + (to[0] - from[0]) * local + offsetX, 10, 88);
      const y = spatialCollectionClamp(from[1] + (to[1] - from[1]) * local + offsetY, 14, 88);
      const manual = index >= 174;
      const minuteOfDay = 8 * 60 + 30 + index * 3;
      const hour = Math.floor(minuteOfDay / 60) % 24;
      const minute = minuteOfDay % 60;
      const photoId = index < 6 ? `IMG-XA-${String(index + 1).padStart(3, "0")}` : `PHOTO-XA-${String(index + 1).padStart(3, "0")}`;
      const stopIndex = Math.min(7, Math.floor(index * 8 / 186));
      return Object.freeze({
        photoId,
        shotTime: `2026-06-18 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
        x: Number(x.toFixed(2)), y: Number(y.toFixed(2)), coordinateType: "project-relative",
        locationSource: manual ? "manual-bind" : "exif", locationStatus: manual ? "bound" : "located",
        originalLocationStatus: manual ? "missing" : "located",
        suggestedLocation: manual ? Object.freeze({ x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }) : null,
        routeId: SURVEY_ROUTE_ID, routeOrder: index + 1, keyStopId: `STOP-${String(stopIndex + 1).padStart(2, "0")}`,
        note: manual ? "依据项目边界、拍摄顺序、相邻照片及人工确认完成补绑" : "原始照片EXIF定位"
      });
    }));
  }

  const photoLocationData = createPhotoLocationData();
  const surveyRouteData = Object.freeze({
    routeId: SURVEY_ROUTE_ID,
    name: "设计师主踏勘路线",
    coordinateType: "project-relative",
    startPoint: Object.freeze({ id: "ROUTE-START", name: "起点 · 项目北侧入口", x: 14, y: 72, order: 0 }),
    endPoint: Object.freeze({ id: "ROUTE-END", name: "终点 · 西侧回访出口", x: 24, y: 68, order: 10 }),
    routePoints: Object.freeze(SURVEY_ROUTE_POINTS.map(([x, y], index) => Object.freeze({ x, y, order: index }))),
    keyStops: Object.freeze(SURVEY_STOP_DEFINITIONS.map(([stopId, x, y, note], index) => Object.freeze({
      stopId, x, y, routeOrder: index + 1, linkedPhotoCount: photoLocationData.filter((photo) => photo.keyStopId === stopId).length, note
    }))),
    linkedPhotoIds: Object.freeze(photoLocationData.map((photo) => photo.photoId)),
    source: "demo-preset", status: "completed", declaration: "Demo预置采集数据 · 非真实GPS轨迹"
  });

  function validateSpatialCollectionData() {
    const ids = new Set(photoLocationData.map((photo) => photo.photoId));
    const manual = photoLocationData.filter((photo) => photo.locationSource === "manual-bind");
    const exif = photoLocationData.filter((photo) => photo.locationSource === "exif");
    const valid = photoLocationData.length === 186 && ids.size === 186 && exif.length === 174 && manual.length === 12
      && surveyRouteData.keyStops.length === 8 && surveyRouteData.linkedPhotoIds.length === 186
      && photoLocationData.every((photo) => photo.x >= 0 && photo.x <= 100 && photo.y >= 0 && photo.y <= 100 && photo.routeId === SURVEY_ROUTE_ID)
      && surveyRouteData.routePoints.every((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100);
    if (!valid) throw new Error("01空间采集固定数据未通过186 / 174 / 12 / 8锁定口径校验");
    return { total: 186, exif: 174, manualBound: 12, located: 186, routes: 1, stops: 8, routeLinked: 186 };
  }

  const humanReviewTaskDefinitions = [
    { taskId: "DEF-021", issueIndex: 0, defaultAction: "confirm" },
    { taskId: "DEF-024", issueIndex: 1, defaultAction: "modify", correctedType: "外墙抹灰层空鼓" },
    { taskId: "DEF-028", issueIndex: 8, defaultAction: "confirm" },
    { taskId: "DEF-031", issueIndex: 22, defaultAction: "confirm" },
    { taskId: "DEF-034", issueIndex: 15, defaultAction: "exclude", severity: "general", confidence: 87.6, exclusionReason: "现场核验后确认空调外机位于既有统一安装区，未形成明显安全或环境问题。" },
    { taskId: "DEF-038", issueIndex: 29, defaultAction: "confirm" },
    { taskId: "DEF-041", issueIndex: 36, type: "疑似违建点", defaultAction: "confirm", opinion: "影像存在新增搭建特征，建议在GIS落图后联动规划审批资料进一步核验。" }
  ];

  const humanReviewTasks = humanReviewTaskDefinitions.map((definition) => {
    const sourceIssue = aiRecognitionData.issues[definition.issueIndex];
    const issue = Object.assign({}, sourceIssue, {
      type: definition.type || sourceIssue.type,
      severity: definition.severity || sourceIssue.severity,
      confidence: definition.confidence === undefined ? sourceIssue.confidence : definition.confidence
    });
    const image = aiRecognitionData.images.find((item) => item.id === issue.imageId);
    return {
      taskId: definition.taskId,
      issue,
      image,
      defaultAction: definition.defaultAction,
      correctedType: definition.correctedType || issue.type,
      defaultOpinion: definition.opinion || "",
      defaultExclusionReason: definition.exclusionReason || ""
    };
  });

  const HUMAN_REVIEW_LOCKED = Object.freeze({
    candidateIssues: 43,
    regularReviewed: 36,
    priorityTotal: 7,
    initialRisk: Object.freeze({ high: 6, medium: 18, general: 19 }),
    finalRisk: Object.freeze({ high: 6, medium: 18, general: 18 }),
    finalEffective: 42,
    finalExcluded: 1,
    operator: "设计师-01"
  });

  const GIS_SOURCE_REGISTRY = Object.freeze([
    { layerId: "boundary", layerName: "项目边界", sourceName: "项目资料归档", sourceType: "项目资料", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "项目边界仅用于Demo空间表达，不进行面积计算。" },
    { layerId: "buildings", layerName: "地块与建筑轮廓", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "固定相对坐标，用于建筑和地块归属演示。" },
    { layerId: "planning", layerName: "规划用地与控制条件", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "不代表正式审批结论或法定规划条件。" },
    { layerId: "roads", layerName: "道路与慢行网络", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "城市道路、社区道路和步行通道的固定演示网络。" },
    { layerId: "transit", layerName: "公共交通设施", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "公交站和公共停车点，不含实时运营信息。" },
    { layerId: "publicServices", layerName: "公共服务设施", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "教育、医疗、养老、文化、体育及社区服务设施。" },
    { layerId: "commercial", layerName: "商业服务设施", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "便利商业、菜市场、餐饮及综合商业的本地演示点。" },
    { layerId: "greenHeritage", layerName: "蓝绿空间与历史文化资源", sourceName: "Demo预置空间数据", sourceType: "Demo预置", sourceDate: "2026-06", updateStatus: "已本地化", accuracy: "演示级", note: "公园、街旁绿地、水体、历史建筑和工业遗产演示数据。" }
  ]);

  const GIS_SPATIAL_DATA = Object.freeze({
    parcels: Object.freeze([
      { id: "PARCEL-A", points: "17,19 49,14 52,49 18,53", planningUse: "居住用地" },
      { id: "PARCEL-B", points: "52,16 81,20 85,48 53,49", planningUse: "商业服务业用地" },
      { id: "PARCEL-C", points: "18,55 52,51 82,52 80,78 61,86 30,82", planningUse: "公共管理与公共服务用地" }
    ]),
    buildings: Object.freeze([
      { id: "BLD-01", x: 22, y: 23, width: 17, height: 11, parcelId: "PARCEL-A" },
      { id: "BLD-02", x: 26, y: 38, width: 19, height: 9, parcelId: "PARCEL-A" },
      { id: "BLD-03", x: 56, y: 23, width: 18, height: 12, parcelId: "PARCEL-B" },
      { id: "BLD-04", x: 59, y: 39, width: 17, height: 8, parcelId: "PARCEL-B" },
      { id: "BLD-05", x: 28, y: 60, width: 20, height: 10, parcelId: "PARCEL-C" },
      { id: "BLD-06", x: 55, y: 61, width: 19, height: 11, parcelId: "PARCEL-C" }
    ]),
    planning: Object.freeze([
      { id: "PLAN-R", points: "17,19 49,14 52,49 18,53", type: "居住用地" },
      { id: "PLAN-C", points: "52,16 81,20 85,48 53,49", type: "商业服务业用地" },
      { id: "PLAN-G", points: "14,70 30,82 22,87 12,78", type: "公园绿地" },
      { id: "PLAN-H", points: "69,55 83,54 80,78 68,73", type: "历史文化保护控制范围" }
    ]),
    roads: Object.freeze([
      { id: "ROAD-01", name: "更新大道", kind: "main", points: "8,53 92,49", x: 51, y: 51 },
      { id: "ROAD-02", name: "北区社区路", kind: "community", points: "18,17 49,51 81,18", x: 49, y: 51 },
      { id: "ROAD-03", name: "南区社区路", kind: "community", points: "20,80 51,51 81,76", x: 51, y: 51 },
      { id: "WALK-01", name: "中央慢行通道", kind: "walk", points: "50,12 51,88", x: 50.5, y: 50 }
    ]),
    transit: Object.freeze([
      { id: "BUS-01", name: "北侧公交站", type: "公交站", x: 49, y: 9 },
      { id: "BUS-02", name: "更新大道公交站", type: "公交站", x: 89, y: 48 },
      { id: "PARK-01", name: "社区公共停车点", type: "公共停车", x: 14, y: 57 }
    ]),
    publicServices: Object.freeze([
      { id: "EDU-01", name: "社区教育点", type: "教育", x: 17, y: 27 }, { id: "MED-01", name: "社区卫生服务点", type: "医疗卫生", x: 83, y: 28 },
      { id: "ELD-01", name: "日间照料点", type: "养老", x: 73, y: 82 }, { id: "CUL-01", name: "社区文化站", type: "文化", x: 40, y: 76 },
      { id: "SPT-01", name: "公共健身场地", type: "体育", x: 57, y: 79 }, { id: "COM-01", name: "社区服务中心", type: "社区服务", x: 48, y: 56 }
    ]),
    commercial: Object.freeze([
      { id: "SHOP-01", name: "社区便利店", type: "便利商业", x: 78, y: 43 }, { id: "MARKET-01", name: "便民菜市场", type: "菜市场", x: 84, y: 62 },
      { id: "FOOD-01", name: "社区餐饮点", type: "餐饮服务", x: 67, y: 15 }, { id: "MALL-01", name: "综合商业网点", type: "综合商业", x: 91, y: 70 }
    ]),
    greenHeritage: Object.freeze([
      { id: "GREEN-01", name: "西侧街旁绿地", type: "街旁绿地", x: 13, y: 76, shape: "green" },
      { id: "PARK-G1", name: "更新口袋公园", type: "公园", x: 25, y: 87, shape: "green" },
      { id: "WATER-01", name: "景观水体", type: "水体", x: 72, y: 88, shape: "water" },
      { id: "HER-01", name: "西仪工业遗产建筑", type: "工业遗产", x: 77, y: 67, shape: "heritage" }
    ])
  });

  function createGISSurroundings(order) {
    const base = {
      education: 1 + order % 2,
      medical: 1 + (order + 1) % 2,
      elderly: order % 3 === 0 ? 0 : 1,
      culture: 1,
      sports: 1 + (order % 4 === 0 ? 1 : 0),
      community: 1 + order % 2,
      commercial: 4 + order % 4
    };
    const expand = (increment) => Object.fromEntries(Object.entries(base).map(([key, value], index) => [key, value + increment + (index + order) % 2]));
    return Object.freeze({ "500": Object.freeze(base), "800": Object.freeze(expand(1)), "1000": Object.freeze(expand(3)) });
  }

  function createGISIssueData() {
    const highSourceByDefect = new Map([
      [21, 0],
      [24, 1],
      [28, 8],
      [31, 22],
      [38, 29],
      [41, 36]
    ]);
    const excludedDefectNumber = 34;
    const excludedSourceIndex = 15;
    const reservedDefects = new Set([...highSourceByDefect.keys(), excludedDefectNumber]);
    const reservedSources = new Set([...highSourceByDefect.values(), excludedSourceIndex]);
    const remainingDefects = Array.from({ length: 43 }, (_, index) => index + 1).filter((number) => !reservedDefects.has(number));
    const remainingSources = aiRecognitionData.issues.map((_, index) => index).filter((index) => !reservedSources.has(index));
    const sourceByDefect = new Map(highSourceByDefect);
    remainingDefects.forEach((defectNumber, index) => sourceByDefect.set(defectNumber, remainingSources[index]));
    const gridX = [21, 31, 41, 51, 61, 71, 81];
    const gridY = [22, 32, 43, 54, 65, 75];

    return Array.from({ length: 43 }, (_, index) => index + 1)
      .filter((defectNumber) => defectNumber !== excludedDefectNumber)
      .map((defectNumber, order) => {
        const sourceIssue = aiRecognitionData.issues[sourceByDefect.get(defectNumber)];
        const image = aiRecognitionData.images.find((item) => item.id === sourceIssue.imageId);
        const corrected = defectNumber === 24;
        const mapId = "MAP-" + String(defectNumber).padStart(3, "0");
        const defectId = "DEF-" + String(defectNumber).padStart(3, "0");
        const row = Math.floor(order / 7);
        const column = order % 7;
        const xAdjustment = row === 5 ? [4, 3, 2, 1, 0, -1, -5][column] : row % 2 === 0 ? 0 : 2;
        const x = Number((gridX[column] + xAdjustment).toFixed(1));
        const y = Number(gridY[row].toFixed(1));
        const building = GIS_SPATIAL_DATA.buildings[(column + row * 2) % GIS_SPATIAL_DATA.buildings.length];
        const parcel = GIS_SPATIAL_DATA.parcels.find((item) => item.id === building.parcelId) || GIS_SPATIAL_DATA.parcels[0];
        const road = GIS_SPATIAL_DATA.roads[(row + column) % 3];
        const bus = GIS_SPATIAL_DATA.transit[order % 2];
        const parking = GIS_SPATIAL_DATA.transit[2];
        const green = GIS_SPATIAL_DATA.greenHeritage[order % 2];
        const commercial = GIS_SPATIAL_DATA.commercial[order % GIS_SPATIAL_DATA.commercial.length];
        const reviewAction = corrected ? "人工修改" : "人工确认";
        return Object.freeze({
          mapId,
          defectId,
          imageId: sourceIssue.imageId,
          imageFile: image.file,
          originalType: sourceIssue.type,
          type: corrected ? "外墙抹灰层空鼓" : defectNumber === 41 ? "疑似违建点" : sourceIssue.type,
          risk: defectNumber === 4 ? "medium" : sourceIssue.severity,
          confidence: sourceIssue.confidence,
          x,
          y,
          location: image.location.replace(/^P1\s*·\s*/, ""),
          indicator: sourceIssue.suggestedIndicator,
          reviewStatus: "confirmed",
          gisStatus: sourceIssue.severity === "high" ? "pending" : "bound",
          buildingId: building.id,
          parcelId: parcel.id,
          roadId: road.id,
          planningUse: parcel.planningUse,
          insideBoundary: true,
          planningControl: order % 5 === 0 ? "一般更新控制区 · Demo预置条件" : "项目更新协调区 · Demo预置条件",
          heritageRelation: order % 11 === 0 ? "邻近工业遗产展示范围" : "无直接关联",
          distanceToMainRoad: 58 + order % 9 * 11,
          distanceToBusStop: 180 + order % 8 * 20,
          distanceToParking: 245 + order % 7 * 18,
          distanceToMetro: null,
          distanceToGreenSpace: 260 + order % 9 * 28,
          distanceToCommercial: 120 + order % 7 * 24,
          nearestRoadId: road.id,
          nearestRoadName: road.name,
          nearestBusId: bus.id,
          nearestBusName: bus.name,
          nearestParkingId: parking.id,
          nearestParkingName: parking.name,
          nearestGreenId: green.id,
          nearestGreenName: green.name,
          nearestCommercialId: commercial.id,
          nearestCommercialName: commercial.name,
          surroundings: createGISSurroundings(order),
          reviewAction,
          reviewResult: corrected ? "人工修改：外墙抹灰层空鼓" : "人工确认：问题成立",
          reviewNote: defectNumber === 24
            ? "人工复核保留AI原始判断，并将正式问题类型修正为外墙抹灰层空鼓。"
            : defectNumber === 41
              ? "影像存在新增搭建特征，建议在GIS落图后联动规划审批资料进一步核验。"
              : "问题成立，进入GIS空间绑定准备。",
          trace: Object.freeze([sourceIssue.imageId, defectId, reviewAction, mapId])
        });
      });
  }

  const gisIssueData = Object.freeze(createGISIssueData());

  const INDICATOR_CATEGORIES = Object.freeze([
    Object.freeze({ id: "CAT-BS", name: "建筑安全", weight: 0.30, rawScore: 77.55, displayScore: 78, issueCount: 23 }),
    Object.freeze({ id: "CAT-CE", name: "社区环境", weight: 0.70, rawScore: 84.45, displayScore: 84, issueCount: 19 })
  ]);

  const INDICATOR_ISSUE_MAPPING = Object.freeze({
    "IND-BS-01": Object.freeze(["MAP-008", "MAP-037", "MAP-043"]),
    "IND-BS-02": Object.freeze(["MAP-019", "MAP-020", "MAP-022", "MAP-023", "MAP-031", "MAP-032"]),
    "IND-BS-03": Object.freeze(["MAP-001", "MAP-003", "MAP-005", "MAP-006", "MAP-013", "MAP-021", "MAP-024", "MAP-036", "MAP-040"]),
    "IND-BS-04": Object.freeze(["MAP-007", "MAP-009", "MAP-010", "MAP-028", "MAP-038"]),
    "IND-CE-01": Object.freeze(["MAP-004", "MAP-011", "MAP-012", "MAP-015", "MAP-018", "MAP-041", "MAP-042"]),
    "IND-CE-02": Object.freeze(["MAP-027", "MAP-030"]),
    "IND-CE-03": Object.freeze(["MAP-025", "MAP-026", "MAP-039"]),
    "IND-CE-04": Object.freeze(["MAP-002", "MAP-035"]),
    "IND-CE-05": Object.freeze(["MAP-014", "MAP-016"]),
    "IND-CE-06": Object.freeze(["MAP-017", "MAP-029", "MAP-033"])
  });

  const INDICATOR_DEFINITIONS = Object.freeze([
    Object.freeze({ id: "IND-BS-01", name: "建筑使用与消防条件", categoryId: "CAT-BS", weight: 0.15, score: 84, threshold: 80, evidenceLayers: Object.freeze(["问题点位", "地块与建筑", "道路与慢行"]), rule: "建筑使用、消防通行与附属安全问题按固定演示参数进行证据汇总。" }),
    Object.freeze({ id: "IND-BS-02", name: "道路与场地安全", categoryId: "CAT-BS", weight: 0.25, score: 79, threshold: 80, evidenceLayers: Object.freeze(["问题点位", "道路与慢行", "项目边界"]), rule: "道路破损、场地连续性和通行安全问题形成固定扣分证据。" }),
    Object.freeze({ id: "IND-BS-03", name: "外立面与附着物安全", categoryId: "CAT-BS", weight: 0.40, score: 72, threshold: 80, evidenceLayers: Object.freeze(["问题点位", "地块与建筑", "现场影像"]), rule: "外立面缺陷、附着构件与疑似搭建问题形成固定扣分证据。" }),
    Object.freeze({ id: "IND-BS-04", name: "公共设施与设备安全", categoryId: "CAT-BS", weight: 0.20, score: 82, threshold: 80, evidenceLayers: Object.freeze(["问题点位", "公共服务", "地块与建筑"]), rule: "管线、设备和公共设施问题按数量、风险及空间归属形成演示得分。" }),
    Object.freeze({ id: "IND-CE-01", name: "环境秩序与建筑风貌", categoryId: "CAT-CE", weight: 0.15, score: 76, threshold: 80, evidenceLayers: Object.freeze(["问题点位", "规划控制", "地块与建筑"]), rule: "建筑风貌、空间秩序和疑似违建问题形成固定扣分证据。" }),
    Object.freeze({ id: "IND-CE-02", name: "公共服务设施可达性", categoryId: "CAT-CE", weight: 0.25, score: 87, threshold: 80, evidenceLayers: Object.freeze(["公共服务", "500m / 800m / 1000m分析"]), rule: "基于本地Demo设施数量和距离事实形成固定赋分。" }),
    Object.freeze({ id: "IND-CE-03", name: "公共交通与慢行便利度", categoryId: "CAT-CE", weight: 0.20, score: 87, threshold: 80, evidenceLayers: Object.freeze(["公共交通", "道路与慢行", "距离连线"]), rule: "公交、停车、道路与慢行距离事实形成固定赋分。" }),
    Object.freeze({ id: "IND-CE-04", name: "蓝绿空间与开放空间", categoryId: "CAT-CE", weight: 0.15, score: 84, threshold: 80, evidenceLayers: Object.freeze(["蓝绿与历史文化", "项目边界"]), rule: "绿地、开放空间与项目边界关系形成固定演示得分。" }),
    Object.freeze({ id: "IND-CE-05", name: "商业生活服务便利度", categoryId: "CAT-CE", weight: 0.15, score: 84, threshold: 80, evidenceLayers: Object.freeze(["商业服务", "500m / 800m / 1000m分析"]), rule: "商业设施数量和最近便利商业距离形成固定演示得分。" }),
    Object.freeze({ id: "IND-CE-06", name: "社区设施完整性", categoryId: "CAT-CE", weight: 0.10, score: 87, threshold: 80, evidenceLayers: Object.freeze(["公共服务", "商业服务", "地块与建筑"]), rule: "社区服务、体育、养老和公共设施完整性形成固定演示得分。" })
  ]);

  const INDICATOR_BASELINE_DEDUCTIONS = Object.freeze({
    "IND-BS-01": Object.freeze({ issue:10,gis:6 }), "IND-BS-02": Object.freeze({ issue:14,gis:7 }),
    "IND-BS-03": Object.freeze({ issue:22,gis:6 }), "IND-BS-04": Object.freeze({ issue:12,gis:6 }),
    "IND-CE-01": Object.freeze({ issue:18,gis:6 }), "IND-CE-02": Object.freeze({ issue:4,gis:9 }),
    "IND-CE-03": Object.freeze({ issue:3,gis:10 }), "IND-CE-04": Object.freeze({ issue:4,gis:12 }),
    "IND-CE-05": Object.freeze({ issue:4,gis:12 }), "IND-CE-06": Object.freeze({ issue:6,gis:7 })
  });
  const INDICATOR_RISK_WEIGHTS = Object.freeze({ high:3,medium:2,general:1 });

  function createIndicatorIssueContributions() {
    const result = {};
    INDICATOR_DEFINITIONS.forEach((indicator) => {
      const issues = INDICATOR_ISSUE_MAPPING[indicator.id].map((mapId) => gisIssueData.find((issue) => issue.mapId === mapId));
      const totalWeight = issues.reduce((sum,issue) => sum + INDICATOR_RISK_WEIGHTS[issue.risk],0);
      let assigned = 0;
      result[indicator.id] = Object.freeze(issues.map((issue,index) => {
        const contribution = index === issues.length - 1
          ? Number((INDICATOR_BASELINE_DEDUCTIONS[indicator.id].issue - assigned).toFixed(2))
          : Number((INDICATOR_BASELINE_DEDUCTIONS[indicator.id].issue * INDICATOR_RISK_WEIGHTS[issue.risk] / totalWeight).toFixed(2));
        assigned = Number((assigned + contribution).toFixed(2));
        return Object.freeze({ mapId:issue.mapId,risk:issue.risk,contribution });
      }));
    });
    return Object.freeze(result);
  }

  const INDICATOR_ISSUE_CONTRIBUTIONS = createIndicatorIssueContributions();
  const indicatorBaselineState = Object.freeze({
    categoryWeights:Object.freeze({ "CAT-BS":30,"CAT-CE":70 }),
    indicatorWeights:Object.freeze(Object.fromEntries(INDICATOR_DEFINITIONS.map((indicator) => [indicator.id,Math.round(indicator.weight * 100)]))),
    thresholds:Object.freeze(Object.fromEntries(INDICATOR_DEFINITIONS.map((indicator) => [indicator.id,indicator.threshold]))),
    issueResolution:Object.freeze({}),
    scores:Object.freeze(Object.fromEntries(INDICATOR_DEFINITIONS.map((indicator) => [indicator.id,indicator.score])))
  });

  function indicatorStatusForScore(score, threshold) {
    const activeThreshold = Number.isFinite(threshold) ? threshold : 80;
    return score < activeThreshold ? "unmet" : score < 85 ? "basic" : "good";
  }

  const indicatorData = Object.freeze({
    categories: INDICATOR_CATEGORIES,
    indicators: Object.freeze(INDICATOR_DEFINITIONS.map((indicator) => Object.freeze({
      ...indicator,
      status: indicatorStatusForScore(indicator.score),
      issueIds: INDICATOR_ISSUE_MAPPING[indicator.id],
      updatedAt: "2026-07",
      ruleType: "Demo预置"
    }))),
    issueMapping: INDICATOR_ISSUE_MAPPING,
    overallRawScore: 82.38,
    overallDisplayScore: 82.4,
    unmetCount: 3
  });

  function validateIndicatorData() {
    const building = indicatorData.indicators.filter((item) => item.categoryId === "CAT-BS");
    const community = indicatorData.indicators.filter((item) => item.categoryId === "CAT-CE");
    const mappedIds = indicatorData.indicators.flatMap((item) => item.issueIds);
    const validMapIds = new Set(gisIssueData.map((issue) => issue.mapId));
    const expectedUnmet = new Set(["IND-BS-02", "IND-BS-03", "IND-CE-01"]);
    const unmet = indicatorData.indicators.filter((item) => item.status === "unmet");
    const close = (left, right) => Math.abs(left - right) < 0.000001;
    const contributionIds = Object.values(INDICATOR_ISSUE_CONTRIBUTIONS).flatMap((items) => items.map((item) => item.mapId));
    const contributionTotalsValid = indicatorData.indicators.every((indicator) => close(INDICATOR_ISSUE_CONTRIBUTIONS[indicator.id].reduce((sum,item) => sum + item.contribution,0),INDICATOR_BASELINE_DEDUCTIONS[indicator.id].issue));
    const valid = indicatorData.categories.length === 2
      && indicatorData.indicators.length === 10
      && close(building.reduce((sum, item) => sum + item.weight, 0), 1)
      && close(community.reduce((sum, item) => sum + item.weight, 0), 1)
      && close(INDICATOR_CATEGORIES.reduce((sum, item) => sum + item.weight, 0), 1)
      && close(building.reduce((sum, item) => sum + item.score * item.weight, 0), 77.55)
      && close(community.reduce((sum, item) => sum + item.score * item.weight, 0), 84.45)
      && close(77.55 * 0.30 + 84.45 * 0.70, 82.38)
      && mappedIds.length === 42
      && new Set(mappedIds).size === 42
      && mappedIds.every((mapId) => validMapIds.has(mapId))
      && !mappedIds.includes("MAP-034")
      && unmet.length === 3
      && contributionIds.length === 42
      && new Set(contributionIds).size === 42
      && contributionTotalsValid
      && unmet.every((item) => expectedUnmet.has(item.id))
      && INDICATOR_ISSUE_MAPPING["IND-BS-03"].includes("MAP-021")
      && INDICATOR_ISSUE_MAPPING["IND-BS-03"].includes("MAP-024")
      && INDICATOR_ISSUE_MAPPING["IND-BS-04"].includes("MAP-028")
      && INDICATOR_ISSUE_MAPPING["IND-BS-02"].includes("MAP-031")
      && INDICATOR_ISSUE_MAPPING["IND-BS-04"].includes("MAP-038")
      && INDICATOR_ISSUE_MAPPING["IND-CE-01"].includes("MAP-041");
    if (!valid) throw new Error("V9.1 indicator demo data failed integrity validation");
    return { categories: 2, indicators: 10, mappedIssues: 42, unmet: unmet.map((item) => item.id), overall: 82.4 };
  }

  function validateGISIssueData() {
    const risks = gisIssueData.reduce((counts, issue) => {
      counts[issue.risk] += 1;
      return counts;
    }, { high: 0, medium: 0, general: 0 });
    const mapIds = new Set(gisIssueData.map((issue) => issue.mapId));
    const defectIds = new Set(gisIssueData.map((issue) => issue.defectId));
    const coordinatesValid = gisIssueData.every((issue) => issue.x >= 0 && issue.x <= 100 && issue.y >= 0 && issue.y <= 100);
    const valid = gisIssueData.length === 42
      && risks.high === 6
      && risks.medium === 18
      && risks.general === 18
      && !gisIssueData.some((issue) => issue.defectId === "DEF-034" || issue.mapId === "MAP-034")
      && mapIds.size === 42
      && defectIds.size === 42
      && coordinatesValid;
    const spatialValid = gisIssueData.every((issue) => issue.buildingId && issue.parcelId && issue.roadId && ["500", "800", "1000"].every((radius, index, radii) => {
      const values = Object.values(issue.surroundings[radius]);
      return values.every((value) => Number.isInteger(value) && value >= 0) && (!index || values.every((value, valueIndex) => value >= Object.values(issue.surroundings[radii[index - 1]])[valueIndex]));
    }));
    if (!valid || !spatialValid || GIS_SOURCE_REGISTRY.length !== 8) throw new Error("V9.1 GIS demo data failed integrity validation");
    return { risks, mapIds: mapIds.size, defectIds: defectIds.size, coordinatesValid };
  }

  function humanReviewCreateQuickLogs() {
    const priorityIndexes = new Set(humanReviewTaskDefinitions.map((item) => item.issueIndex));
    return aiRecognitionData.issues
      .filter((issue, index) => !priorityIndexes.has(index))
      .map((issue, index) => ({
        logId: "QUICK-" + String(index + 1).padStart(3, "0"),
        time: "初始状态",
        operator: HUMAN_REVIEW_LOCKED.operator,
        taskId: issue.issueId,
        imageId: issue.imageId,
        originalAI: { type: issue.type, severity: issue.severity, confidence: issue.confidence },
        action: "快速确认",
        before: { type: issue.type, severity: issue.severity, indicator: issue.suggestedIndicator },
        after: { type: issue.type, severity: issue.severity, indicator: issue.suggestedIndicator },
        note: "普通候选任务快速复核已完成",
        status: "快速复核已完成",
        retained: true,
        system: true
      }));
  }

  function humanReviewCreateState() {
    return {
      selectedTaskId: humanReviewTasks[0].taskId,
      riskFilter: "all",
      mode: "result",
      dirty: false,
      completed: false,
      pendingNavigation: null,
      supplementDraft: null,
      tasks: humanReviewTasks.map((template) => ({
        taskId: template.taskId,
        issue: template.issue,
        image: template.image,
        defaultAction: template.defaultAction,
        correctedType: template.correctedType,
        defaultOpinion: template.defaultOpinion,
        defaultExclusionReason: template.defaultExclusionReason,
        status: "pending",
        result: null,
        draft: null,
        revision: 0
      })),
      logs: humanReviewCreateQuickLogs()
    };
  }

  function humanReviewCalculateStats(state) {
    const savedTasks = state.tasks.filter((task) => task.result);
    const excludedTasks = savedTasks.filter((task) => task.result.action === "exclude");
    const risk = { ...HUMAN_REVIEW_LOCKED.initialRisk };
    savedTasks.forEach((task) => {
      const originalSeverity = task.issue.severity;
      if (task.result.action === "exclude") risk[originalSeverity] -= 1;
      else if (task.result.severity !== originalSeverity) {
        risk[originalSeverity] -= 1;
        risk[task.result.severity] += 1;
      }
    });
    const priorityCompleted = savedTasks.length;
    const reviewed = HUMAN_REVIEW_LOCKED.regularReviewed + priorityCompleted;
    return {
      reviewed,
      priorityCompleted,
      pending: HUMAN_REVIEW_LOCKED.priorityTotal - priorityCompleted,
      excluded: excludedTasks.length,
      effective: reviewed === HUMAN_REVIEW_LOCKED.candidateIssues ? HUMAN_REVIEW_LOCKED.candidateIssues - excludedTasks.length : null,
      risk
    };
  }

  function humanReviewPresetAligned(state) {
    const stats = humanReviewCalculateStats(state);
    const task024 = state.tasks.find((task) => task.taskId === "DEF-024");
    const excluded = state.tasks.filter((task) => task.result && task.result.action === "exclude");
    return stats.priorityCompleted === 7
      && state.tasks.every((task) => task.result && task.result.action === task.defaultAction)
      && stats.effective === HUMAN_REVIEW_LOCKED.finalEffective
      && excluded.length === 1
      && excluded[0].taskId === "DEF-034"
      && task024.result && task024.result.type === "外墙抹灰层空鼓"
      && stats.risk.high === HUMAN_REVIEW_LOCKED.finalRisk.high
      && stats.risk.medium === HUMAN_REVIEW_LOCKED.finalRisk.medium
      && stats.risk.general === HUMAN_REVIEW_LOCKED.finalRisk.general;
  }

  function humanReviewApplyPresetResult(state, taskId) {
    const task = state.tasks.find((item) => item.taskId === taskId);
    if (!task) throw new Error("Unknown review task: " + taskId);
    task.result = {
      action: task.defaultAction,
      type: task.correctedType,
      severity: task.issue.severity,
      indicator: task.issue.suggestedIndicator,
      opinion: task.defaultOpinion,
      exclusionReason: task.defaultExclusionReason,
      retained: task.defaultAction !== "exclude",
      operator: HUMAN_REVIEW_LOCKED.operator
    };
    task.status = task.defaultAction === "confirm" ? "confirmed" : task.defaultAction === "modify" ? "modified" : "excluded";
    return task;
  }

  function humanReviewRunPresetModel() {
    const state = humanReviewCreateState();
    state.tasks.forEach((task) => humanReviewApplyPresetResult(state, task.taskId));
    return { state, stats: humanReviewCalculateStats(state), aligned: humanReviewPresetAligned(state) };
  }

  const autoAIImageSequence = [
    { imageId: "IMG-XA-001", label: "外墙饰面脱落", issueCount: 8, cumulativeIssues: 8, processedImages: 33, confidence: 84.6, priorityReview: 2, risk: { high: 2, medium: 3, general: 3 } },
    { imageId: "IMG-XA-002", label: "外露管线", issueCount: 7, cumulativeIssues: 15, processedImages: 66, confidence: 87.1, priorityReview: 3, risk: { high: 3, medium: 6, general: 6 } },
    { imageId: "IMG-XA-003", label: "空调外机安装杂乱", issueCount: 7, cumulativeIssues: 22, processedImages: 99, confidence: 89, priorityReview: 4, risk: { high: 4, medium: 9, general: 9 } },
    { imageId: "IMG-XA-004", label: "道路破损", issueCount: 7, cumulativeIssues: 29, processedImages: 132, confidence: 90.5, priorityReview: 5, risk: { high: 5, medium: 12, general: 12 } },
    { imageId: "IMG-XA-005", label: "公共设施损坏", issueCount: 7, cumulativeIssues: 36, processedImages: 165, confidence: 91.7, priorityReview: 6, risk: { high: 5, medium: 15, general: 16 } },
    { imageId: "IMG-XA-006", label: "疑违建点", issueCount: 7, cumulativeIssues: 43, processedImages: 198, confidence: 92.6, priorityReview: 7, risk: { high: 6, medium: 18, general: 19 } }
  ];

  window.cityProjects = cityProjects;
  window.aiRecognitionData = aiRecognitionData;
  window.gisIssueData = gisIssueData;
  window.gisSpatialData = GIS_SPATIAL_DATA;
  window.gisSourceRegistry = GIS_SOURCE_REGISTRY;
  window.indicatorData = indicatorData;
  window.indicatorBaselineState = indicatorBaselineState;
  window.indicatorIssueContributions = INDICATOR_ISSUE_CONTRIBUTIONS;
  window.photoLocationData = photoLocationData;
  window.surveyRouteData = surveyRouteData;
  window.__humanReviewBetaModel = {
    locked: HUMAN_REVIEW_LOCKED,
    tasks: humanReviewTasks,
    createState: humanReviewCreateState,
    calculateStats: humanReviewCalculateStats,
    applyPresetResult: humanReviewApplyPresetResult,
    presetAligned: humanReviewPresetAligned,
    runPreset: humanReviewRunPresetModel
  };
  window.__urbanDemoState = "idle";
  window.__urbanDemoDebug = {
    currentStep: "idle",
    elapsed: 0,
    activeProjectId: null,
    activeModule: null,
    activeViewStage: null,
    activeDrawerStage: null,
    activeWorkspaceStage: null,
    workflowCurrentStage: null,
    workflowCompletedThrough: -1,
    leftDrawerOpen: false,
    rightDrawerOpen: false,
    workspaceOpen: false
  };

  document.addEventListener("DOMContentLoaded", () => {
    runtimeDiagnosticStep("DOMContentLoaded已触发");
    try {
      init();
    } catch (error) {
      runtimeDiagnosticError(error, "全局初始化");
      throw error;
    }
  }, { once: true });

  function init() {
    const $ = (selector, root) => (root || document).querySelector(selector);
    const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const easeOut = (value) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

    const appStage = $("#appStage");
    const mapViewport = $("#mapViewport");
    const mapTransform = $("#mapTransform");
    const mapContent = $("#mapContent");
    const projectPoints = $("#projectPoints");
    const cityProjectList = $("#cityProjectList");
    const projectEntry = $("#projectEntry");
    const leftDrawer = $("#leftDrawer");
    const cityListView = $("#cityListView");
    const projectDetailView = $("#projectDetailView");
    const moduleDrawer = $("#moduleDrawer");
    const moduleRailButtons = $$(".module-rail-item");
    const flowButtons = $$(".flow-step");
    const workspaceShell = $("#workspaceShell");
    const aiRecognitionWorkspace = $("#aiRecognitionWorkspace");
    const humanReviewWorkspace = $("#humanReviewWorkspace");
    const gisWorkspace = $("#gisWorkspace");
    const indicatorWorkspace = $("#indicatorWorkspace");
    const reportWorkspace = $("#reportWorkspace");
    const gisMapViewport = $("#gisMapViewport");
    const gisMapTransform = $("#gisMapTransform");
    const gisMapContent = $("#gisMapContent");
    const humanReviewMainImage = $("#humanReviewMainImage");
    const humanReviewMediaViewport = $("#humanReviewMediaViewport");
    const humanReviewMediaFrame = $("#humanReviewMediaFrame");
    const aiRecognitionMainImage = $("#aiRecognitionMainImage");
    const aiRecognitionMediaViewport = $("#aiRecognitionMediaViewport");
    const aiRecognitionMediaFrame = $("#aiRecognitionMediaFrame");
    const aiRecognitionBoxLayer = $("#aiRecognitionBoxLayer");
    const aiRecognitionScanLine = $("#aiRecognitionScanLine");
    const toast = $("#toast");
    const autoDemoButton = $("#autoDemoButton");

    const cityMapState = {
      mode: "overview",
      focusedProjectId: null,
      scale: 1,
      x: 0,
      y: 0,
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      movedDistance: 0,
      interactionSource: null
    };

    const appState = {
      activeProjectId: null,
      activeModuleIndex: null,
      activeViewStage: null,
      activeDrawerStage: null,
      activeWorkspaceStage: null,
      workflowCurrentStage: null,
      workflowCompletedThrough: -1,
      workflowNextOnly: false,
      stageNavigationInFlight: false,
      leftDrawerView: null,
      rightDrawerOpen: false,
      workspaceOpen: false,
      aiRecognitionWorkspaceOpen: false,
      humanReviewWorkspaceOpen: false,
      gisWorkspaceOpen: false,
      indicatorWorkspaceOpen: false,
      reportWorkspaceOpen: false,
      map: cityMapState,
      manualUpload: null,
      uploadComplete: false,
      toastTimer: 0,
      handoffHintTimer: 0
    };

    function createSpatialWorkflowState(source) {
      return {
        status: "raw",
        routeStatus: "raw",
        originalLocatedCount: 174,
        missingCount: 12,
        candidateLocationCount: 0,
        manualBoundCount: 0,
        totalLocatedCount: 174,
        routeLinkedCount: 0,
        visibleStopCount: 0,
        selectedMissingPhotoId: null,
        activeLocateGroup: null,
        mapViewMode: "overview",
        source: source === "demo" ? "demo" : "manual",
        operationToken: 0,
        timerIds: []
      };
    }

    let manualSpatialCollectionState = createSpatialWorkflowState("manual");
    let demoSpatialCollectionState = createSpatialWorkflowState("demo");

    const spatialCollectionState = {
      view: "governance",
      workflowSource: "manual",
      activeTab: "photo",
      selectedPhotoId: photoLocationData[0].photoId,
      selectedStopId: null,
      selectedRoutePoint: null,
      layers: { boundary: true, route: true, photos: true, manual: true, stops: true },
      focused: false
    };

    const aiRecognitionState = {
      status: "idle",
      progress: 0,
      processedImages: 0,
      candidateIssues: 0,
      averageConfidence: 0,
      priorityCount: 0,
      selectedImageId: aiRecognitionData.images[0].id,
      selectedIssueId: null,
      imageFilter: "all",
      riskFilter: "all",
      mode: "result",
      rafId: 0,
      startedAt: 0,
      elapsedMs: 0,
      durationMs: 5600,
      source: "manual",
      lastRenderedCandidateCount: -1,
      autoSequenceIndex: -1
    };

    let humanReviewState = humanReviewCreateState();
    let humanReviewInitialized = false;
    let gisInitialized = false;
    let indicatorInitialized = false;
    const gisState = {
      selectedMapId: "MAP-021",
      riskFilter: "all",
      typeFilter: "all",
      search: "",
      activeTab: "detail",
      radius: "500",
      objectFilter: null,
      distanceTarget: null,
      layerCollapsed: false,
      layers: { boundary: true, buildings: true, planning: false, roads: true, transit: false, publicServices: false, commercial: false, greenHeritage: false, points: true, risk: true, labels: true, imagePoints: false, analysisRange: false },
      pendingBindings: new Set(gisIssueData.filter((issue) => issue.gisStatus === "pending").map((issue) => issue.mapId)),
      bindingOverrides: new Map(),
      positionOverrides: new Map(),
      adjustmentHistory: new Map(),
      map: { scale: 1, x: 0, y: 0, dragging: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 }
    };

    const indicatorState = {
      selectedIndicatorId: "IND-BS-03",
      statusFilter: "all",
      search: "",
      categoryFocus: "all",
      activeTab: "detail",
      issueRiskFilter: "all",
      issueTypeFilter: "all",
      lastLocatedMapId: null
    };

    const reportWorkbenchState = {
      reportType: "comprehensive",
      specialTopic: "building",
      pageIndex: 0,
      activeTab: "config",
      zoom: 100,
      evidenceVisible: true,
      fullscreenPreview: false,
      mode: "baseline",
      printPreview: false,
      pendingTracePageId: null,
      confirmAction: null
    };
    const REPORT_COMPONENTS = [
      ["coreMetrics", "核心数据卡"], ["riskChart", "风险分布图"], ["indicatorBars", "指标得分条"],
      ["issueDistribution", "问题类型分布"], ["gisMap", "GIS地图缩略图"], ["fieldImage", "典型现场影像"],
      ["unmetTable", "未达标指标表"], ["evidenceChain", "证据链"], ["sourceNote", "数据来源说明"], ["disclaimer", "Demo免责声明"]
    ];
    const REPORT_REQUIRED_PAGES = {
      comprehensive: new Set(["RPT-01", "RPT-03", "RPT-08"]),
      special: new Set(["RPT-SPEC-01", "RPT-SPEC-02", "RPT-SPEC-05"]),
      spatial: new Set(["RPT-SPATIAL-01", "RPT-SPATIAL-02", "RPT-SPATIAL-06"])
    };
    const REPORT_REQUIRED_COMPONENTS = {
      "RPT-03": new Set(["coreMetrics"]), "RPT-04": new Set(["unmetTable"]),
      "RPT-06": new Set(["gisMap"]), "RPT-08": new Set(["evidenceChain"])
    };
    const REPORT_PAGE_LAYOUTS = {
      "RPT-03": [["focus", "重点数据版"], ["split", "左右分栏"]],
      "RPT-05": [["split", "图表优先"], ["mixed", "图文混排"]],
      "RPT-06": [["focus", "地图优先"], ["split", "地图与数据分栏"]],
      default: [["split", "左右分栏"], ["stacked", "上下布局"], ["mixed", "图文混排"]]
    };
    const REPORT_LOCKED_VALUES = ["96%", "43", "43 / 43", "42", "1", "6 / 18 / 18", "42 / 42", "8类", "78", "84", "82.4", "3项", "IND-BS-02", "79", "IND-BS-03", "72", "IND-CE-01", "76"];
    const reportBaselineState = { templates: reportTemplateData };
    const reportDraftState = {
      enabled: false,
      activeReportType: "comprehensive",
      activeTopic: "building",
      drafts: Object.create(null),
      debounceId: 0,
      lastValidation: null
    };
    const REPORT_GENERATION_STEPS = [
      [20, "数据与草稿校验"], [40, "章节与页码编排"], [65, "图表、地图与影像组织"],
      [85, "证据索引与来源登记"], [100, "报告包封装完成"]
    ];
    const reportGenerationState = {
      status: "idle", sourceMode: "baseline", reportType: "comprehensive", specialTopic: "building",
      snapshotId: null, snapshotCreatedAt: null, progress: 0, currentStep: null, generatedPages: 0,
      generatedFiles: [], generatedSnapshot: null, draftRevisionAtGeneration: null,
      draftChangedAfterGeneration: false, validation: { passed: 0, warnings: 0, blocking: 0 },
      timerIds: [], viewingSnapshot: false, completionVisible: false
    };
    const demoReportGenerationState = {
      active: false, status: "idle", progress: 0, currentStep: null, generatedSnapshot: null,
      outputReady: false, completionVisible: false, lastRenderedProgress: -1,
      validation: { passed: 11, warnings: 0, blocking: 0 }
    };
    let reportWorkspaceInitialized = false;

    function createIndicatorScenarioState(enabled) {
      return {
        enabled:Boolean(enabled),
        categoryWeights:{ ...indicatorBaselineState.categoryWeights },
        indicatorWeights:{ ...indicatorBaselineState.indicatorWeights },
        thresholds:{ ...indicatorBaselineState.thresholds },
        resolvedIssueIds:new Set(),
        modified:false
      };
    }

    let indicatorScenarioState = createIndicatorScenarioState(false);

    const demo = {
      state: "idle",
      currentStep: "idle",
      elapsed: 0,
      startedAt: 0,
      rafId: 0,
      fired: new Set(),
      queue: Promise.resolve(),
      runId: 0,
      workspaceReady: false,
      spatialActive: false,
      spatialRenderKey: "",
      aiWorkspaceReady: false,
      aiStartedAtElapsed: shiftedDemoTime(16.5),
      aiSequenceEndElapsed: shiftedDemoTime(22.5),
      aiNextStageAtElapsed: shiftedDemoTime(22.8),
      aiCompletedImages: new Set(),
      humanReviewActive: false,
      humanReviewCompletedTaskIds: new Set(),
      gisActive: false,
      gisDemoBoundIds: new Set(),
      indicatorActive: false,
      indicatorDemoSimulated: false,
      completing: false,
      seeking: false,
      seekToken: 0,
      seekPreview: 0
    };

    const motion = {
      left: { state: "closed", token: 0, promise: Promise.resolve(), contentState: "idle", contentPromise: Promise.resolve() },
      right: { state: "closed", token: 0, promise: Promise.resolve(), contentState: "idle", contentPromise: Promise.resolve() },
      workspace: { state: "closed", token: 0, promise: Promise.resolve() },
      aiRecognition: { state: "closed", token: 0, promise: Promise.resolve() },
      humanReview: { state: "closed", token: 0, promise: Promise.resolve() },
      gis: { state: "closed", token: 0, promise: Promise.resolve() },
      indicator: { state: "closed", token: 0, promise: Promise.resolve() },
      report: { state: "closed", token: 0, promise: Promise.resolve() }
    };

    window.__urbanMotionDebug = { left: "closed", right: "closed", workspace: "closed", aiRecognition: "closed", humanReview: "closed", gis: "closed", indicator: "closed", report: "closed", lastCompletion: "none" };
    window.__aiRecognitionBetaDebug = {
      workspaceOpen: false,
      motion: "closed",
      status: "idle",
      progress: 0,
      processedImages: 0,
      candidateIssues: 0,
      averageConfidence: 0,
      priorityReview: 0,
      selectedImageId: aiRecognitionData.images[0].id,
      selectedIssueId: null,
      imageCount: aiRecognitionData.images.length,
      issueCount: aiRecognitionData.issues.length,
      riskTotals: { high: 6, medium: 18, general: 19 },
      logicEnabled: true
    };
    window.__aiRecognitionSequenceDebug = {
      active: false,
      currentIndex: -1,
      currentImageId: aiRecognitionData.images[0].id,
      imageElapsed: 0,
      imageDuration: AUTO_AI_IMAGE_SECONDS,
      sequenceElapsed: 0,
      events: []
    };
    window.__humanReviewBetaDebug = {
      workspaceOpen: false,
      motion: "closed",
      selectedTaskId: humanReviewTasks[0].taskId,
      taskCount: humanReviewTasks.length,
      candidateIssues: 43,
      priorityReview: 7,
      formalResultCount: null,
      reviewed: 36,
      pending: 7,
      excluded: 0,
      completed: false,
      presetAligned: false
    };
    window.__gisBetaDebug = {
      workspaceOpen: false,
      motion: "closed",
      initialized: false,
      issueCount: gisIssueData.length,
      high: 6,
      medium: 18,
      general: 18,
      selectedMapId: gisState.selectedMapId,
      visibleCount: gisIssueData.length,
      bound: 36,
      pending: 6,
      radius: "500",
      inputLayers: GIS_SOURCE_REGISTRY.length,
      externalResources: 0
    };
    window.__indicatorAlphaDebug = {
      workspaceOpen: false,
      motion: "closed",
      initialized: false,
      selectedIndicatorId: indicatorState.selectedIndicatorId,
      categoryCount: indicatorData.categories.length,
      indicatorCount: indicatorData.indicators.length,
      mappedIssues: 42,
      overallScore: 82.4,
      buildingSafety: 78,
      communityEnvironment: 84,
      unmetCount: 3,
      externalResources: 0
    };

    function syncMotionDebug(completion) {
      window.__urbanMotionDebug.left = motion.left.state;
      window.__urbanMotionDebug.right = motion.right.state;
      window.__urbanMotionDebug.workspace = motion.workspace.state;
      window.__urbanMotionDebug.aiRecognition = motion.aiRecognition.state;
      window.__urbanMotionDebug.humanReview = motion.humanReview.state;
      window.__urbanMotionDebug.gis = motion.gis.state;
      window.__urbanMotionDebug.indicator = motion.indicator.state;
      window.__urbanMotionDebug.report = motion.report.state;
      window.__aiRecognitionBetaDebug.workspaceOpen = appState.aiRecognitionWorkspaceOpen;
      window.__aiRecognitionBetaDebug.motion = motion.aiRecognition.state;
      window.__humanReviewBetaDebug.workspaceOpen = appState.humanReviewWorkspaceOpen;
      window.__humanReviewBetaDebug.motion = motion.humanReview.state;
      window.__gisBetaDebug.workspaceOpen = appState.gisWorkspaceOpen;
      window.__gisBetaDebug.motion = motion.gis.state;
      window.__indicatorAlphaDebug.workspaceOpen = appState.indicatorWorkspaceOpen;
      window.__indicatorAlphaDebug.motion = motion.indicator.state;
      if (completion) window.__urbanMotionDebug.lastCompletion = completion;
    }

    function nextPaint() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function cssTimeToMs(value) {
      const text = String(value || "0s").trim();
      if (text.endsWith("ms")) return parseFloat(text) || 0;
      if (text.endsWith("s")) return (parseFloat(text) || 0) * 1000;
      return parseFloat(text) || 0;
    }

    function visualBudget(element, kind) {
      const style = getComputedStyle(element);
      const durationText = kind === "animation" ? style.animationDuration : style.transitionDuration;
      const delayText = kind === "animation" ? style.animationDelay : style.transitionDelay;
      const durations = durationText.split(",").map(cssTimeToMs);
      const delays = delayText.split(",").map(cssTimeToMs);
      const count = Math.max(durations.length, delays.length);
      let max = 0;
      for (let index = 0; index < count; index += 1) {
        max = Math.max(max, (durations[index % durations.length] || 0) + (delays[index % delays.length] || 0));
      }
      return max;
    }

    function waitForVisualEnd(element, options) {
      const settings = options || {};
      const kind = settings.kind === "animation" ? "animation" : "transition";
      const eventName = kind === "animation" ? "animationend" : "transitionend";
      const property = settings.property || null;
      const fallback = Math.max(100, visualBudget(element, kind) + 90);
      return new Promise((resolve) => {
        let finished = false;
        const finish = (source) => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          element.removeEventListener(eventName, onEnd);
          syncMotionDebug(source);
          resolve(source);
        };
        const onEnd = (event) => {
          if (event.target !== element) return;
          if (property && event.propertyName !== property) return;
          finish(eventName);
        };
        const timer = window.setTimeout(() => finish("fallback"), fallback);
        element.addEventListener(eventName, onEnd);
      });
    }

    function setBackdrop(mode) {
      appStage.classList.toggle("is-drawer-active", mode === "open");
      appStage.classList.toggle("is-drawer-closing", mode === "closing");
    }

    function setDemoState(nextState) {
      if (!ALLOWED_DEMO_STATES.has(nextState)) throw new Error("Invalid demo state: " + nextState);
      demo.state = nextState;
      window.__urbanDemoState = nextState;
      appStage.classList.toggle("is-demo-playing", nextState === "playing");
      appStage.classList.toggle("is-demo-paused", nextState === "paused");
      const labels = {
        idle: "自动演示",
        playing: "暂停演示",
        paused: "继续演示",
        completed: "重播演示"
      };
      $("#autoDemoLabel").textContent = labels[nextState];
      syncDebug();
    }

    function syncDebug() {
      const debug = window.__urbanDemoDebug;
      debug.currentStep = demo.currentStep;
      debug.elapsed = Number(demo.elapsed.toFixed(3));
      debug.activeProjectId = appState.activeProjectId;
      debug.activeModule = appState.activeModuleIndex === null ? null : modules[appState.activeModuleIndex].number;
      debug.activeViewStage = appState.activeViewStage;
      debug.activeDrawerStage = appState.activeDrawerStage;
      debug.activeWorkspaceStage = appState.activeWorkspaceStage;
      debug.workflowCurrentStage = appState.workflowCurrentStage;
      debug.workflowCompletedThrough = appState.workflowCompletedThrough;
      debug.cityMapMode = cityMapState.mode;
      debug.focusedProjectId = cityMapState.focusedProjectId;
      debug.cityMapScale = Number(cityMapState.scale.toFixed(3));
      debug.cityMapX = Number(cityMapState.x.toFixed(2));
      debug.cityMapY = Number(cityMapState.y.toFixed(2));
      debug.leftDrawerOpen = appState.leftDrawerView !== null;
      debug.rightDrawerOpen = appState.rightDrawerOpen;
      debug.workspaceOpen = appState.workspaceOpen || appState.aiRecognitionWorkspaceOpen || appState.humanReviewWorkspaceOpen || appState.gisWorkspaceOpen || appState.indicatorWorkspaceOpen || appState.reportWorkspaceOpen;
    }

    function formatTime(seconds) {
      const safe = Math.max(0, Math.min(DEMO_DURATION, seconds));
      const wholeSeconds = safe >= DEMO_DURATION ? Math.ceil(DEMO_DURATION) : Math.floor(safe);
      const minutes = Math.floor(wholeSeconds / 60);
      const remainingSeconds = wholeSeconds % 60;
      return String(minutes).padStart(2, "0") + ":" + String(remainingSeconds).padStart(2, "0");
    }

    function formatDemoDuration(seconds) {
      return formatTime(seconds);
    }

    function updateDemoProgress() {
      const percent = (clamp(demo.elapsed / DEMO_DURATION, 0, 1) * 100).toFixed(2) + "%";
      const totalLabel = formatDemoDuration(DEMO_DURATION);
      $("#demoProgressLabel").textContent = formatTime(demo.elapsed) + " / " + totalLabel;
      $("#demoProgressBar").style.width = percent;
      $("#demoTimelineThumb").style.left = percent;
      $("#demoTimeline").setAttribute("aria-valuenow", demo.elapsed.toFixed(1));
      $("#demoTimeline").setAttribute("aria-valuetext", formatTime(demo.elapsed) + " / " + totalLabel);
      syncDebug();
    }

    function previewDemoSeek(seconds) {
      const target = clamp(seconds, 0, DEMO_DURATION);
      const percent = (target / DEMO_DURATION * 100).toFixed(2) + "%";
      demo.seekPreview = target;
      const totalLabel = formatDemoDuration(DEMO_DURATION);
      $("#demoProgressLabel").textContent = formatTime(target) + " / " + totalLabel;
      $("#demoProgressBar").style.width = percent;
      $("#demoTimelineThumb").style.left = percent;
      $("#demoTimeline").setAttribute("aria-valuenow", target.toFixed(1));
      $("#demoTimeline").setAttribute("aria-valuetext", formatTime(target) + " / " + totalLabel);
    }

    function resizeStage() {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      appStage.style.setProperty("--stage-scale", scale.toFixed(6));
    }

    function showToast(message, tone, duration) {
      window.clearTimeout(appState.toastTimer);
      toast.classList.remove("is-warning", "is-success");
      if (tone === "warning") toast.classList.add("is-warning");
      if (tone === "success") toast.classList.add("is-success");
      $("span", toast).textContent = message;
      toast.classList.add("is-open");
      appState.toastTimer = window.setTimeout(() => toast.classList.remove("is-open"), duration || 2300);
    }

    function validateAIRecognitionData() {
      const riskCounts = aiRecognitionData.issues.reduce((counts, issue) => {
        counts[issue.severity] = (counts[issue.severity] || 0) + 1;
        return counts;
      }, { high: 0, medium: 0, general: 0 });
      const average = aiRecognitionData.issues.reduce((sum, issue) => sum + issue.confidence, 0) / aiRecognitionData.issues.length;
      const priority = aiRecognitionData.issues.filter((issue) => issue.priorityReview).length;
      const bboxValid = aiRecognitionData.issues.every((issue) => {
        const box = issue.bbox;
        return box && [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.x >= 0 && box.y >= 0 && box.width > 0 && box.height > 0 && box.x + box.width <= 100 && box.y + box.height <= 100;
      });
      const valid = aiRecognitionData.images.length === 6
        && aiRecognitionData.issues.length === 43
        && riskCounts.high === 6
        && riskCounts.medium === 18
        && riskCounts.general === 19
        && priority === 7
        && Math.abs(average - 92.6) < 0.001
        && bboxValid;
      if (!valid) throw new Error("AI recognition demo data failed integrity validation");
      window.__aiRecognitionBetaDebug.dataValid = true;
      window.__aiRecognitionBetaDebug.actualAverageConfidence = Number(average.toFixed(1));
      return true;
    }

    function syncAIRecognitionDebug() {
      const debug = window.__aiRecognitionBetaDebug;
      debug.status = aiRecognitionState.status;
      debug.progress = Number(aiRecognitionState.progress.toFixed(4));
      debug.processedImages = aiRecognitionState.processedImages;
      debug.candidateIssues = aiRecognitionState.candidateIssues;
      debug.averageConfidence = Number(aiRecognitionState.averageConfidence.toFixed(1));
      debug.priorityReview = aiRecognitionState.priorityCount;
      debug.selectedImageId = aiRecognitionState.selectedImageId;
      debug.selectedIssueId = aiRecognitionState.selectedIssueId;
      debug.riskFilter = aiRecognitionState.riskFilter;
      debug.mode = aiRecognitionState.mode;
    }

    function autoAISequenceStepByImageId(imageId) {
      return autoAIImageSequence.find((step) => step.imageId === imageId) || null;
    }

    function recordAISequenceEvent(type, step, elapsed, metrics) {
      const event = {
        type,
        elapsed: Number(elapsed.toFixed(3)),
        imageId: step.imageId,
        label: step.label,
        cumulativeIssues: metrics.candidateIssues,
        processedImages: metrics.processedImages,
        confidence: Number(metrics.averageConfidence.toFixed(1)),
        priorityReview: metrics.priorityCount,
        risk: { ...metrics.riskCounts }
      };
      window.__aiRecognitionSequenceDebug.events.push(event);
      return event;
    }

    function aiRecognitionImageById(id) {
      return aiRecognitionData.images.find((image) => image.id === id) || aiRecognitionData.images[0];
    }

    function aiRecognitionIssueById(id) {
      return aiRecognitionData.issues.find((issue) => issue.issueId === id) || null;
    }

    function aiRecognitionIssueMatchesRisk(issue) {
      if (aiRecognitionState.riskFilter === "all") return true;
      if (aiRecognitionState.riskFilter === "priority") return issue.priorityReview;
      return issue.severity === aiRecognitionState.riskFilter;
    }

    function aiRecognitionRevealedIssues() {
      return aiRecognitionData.issues.slice(0, aiRecognitionState.candidateIssues);
    }

    function aiRecognitionFilteredIssues() {
      return aiRecognitionRevealedIssues().filter(aiRecognitionIssueMatchesRisk);
    }

    function aiRecognitionVisibleImages() {
      const typeFiltered = aiRecognitionData.images.filter((image) => aiRecognitionState.imageFilter === "all" || image.type === aiRecognitionState.imageFilter);
      if (aiRecognitionState.riskFilter === "all") return typeFiltered;
      const imageIds = new Set(aiRecognitionFilteredIssues().map((issue) => issue.imageId));
      return typeFiltered.filter((image) => imageIds.has(image.id));
    }

    function renderAIRecognitionThumbnails() {
      const list = $("#aiRecognitionThumbnailList");
      const images = aiRecognitionVisibleImages();
      $("#aiRecognitionVisibleImageCount").textContent = String(images.length).padStart(2, "0");
      list.classList.toggle("is-empty", images.length === 0);
      if (!images.length) {
        list.replaceChildren(document.createTextNode(aiRecognitionState.imageFilter === "drone" ? "当前演示包未含无人机影像" : "当前筛选暂无候选影像"));
        return;
      }

      const fragment = document.createDocumentFragment();
      images.forEach((image) => {
        const issues = aiRecognitionRevealedIssues().filter((issue) => issue.imageId === image.id);
        const finalCount = aiRecognitionData.issues.filter((issue) => issue.imageId === image.id).length;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ai-recognition-thumbnail";
        button.classList.toggle("is-current", image.id === aiRecognitionState.selectedImageId);
        button.dataset.aiImageId = image.id;
        button.setAttribute("aria-pressed", String(image.id === aiRecognitionState.selectedImageId));
        const preview = document.createElement("img");
        preview.src = image.file;
        preview.alt = image.alt;
        const copy = document.createElement("div");
        const number = document.createElement("b");
        number.textContent = image.id;
        const title = document.createElement("span");
        title.textContent = image.title;
        const status = document.createElement("small");
        if (aiRecognitionState.candidateIssues === 0) status.textContent = "待识别 · 0项";
        else if (issues.length >= finalCount) {
          status.textContent = "已识别 · " + issues.length + "项";
          status.className = "is-processed";
        } else if (issues.length > 0) status.textContent = "识别中 · " + issues.length + "项";
        else status.textContent = "等待队列";
        copy.append(number, title, status);
        button.append(preview, copy);
        button.addEventListener("click", () => {
          manualAction();
          selectAIRecognitionImage(image.id);
        });
        fragment.appendChild(button);
      });
      list.replaceChildren(fragment);
    }

    function fitAIRecognitionMedia() {
      const image = aiRecognitionImageById(aiRecognitionState.selectedImageId);
      const width = aiRecognitionMediaViewport.clientWidth;
      const height = aiRecognitionMediaViewport.clientHeight;
      if (!width || !height) return;
      const naturalWidth = aiRecognitionMainImage.naturalWidth || 1448;
      const naturalHeight = aiRecognitionMainImage.naturalHeight || 1086;
      const scale = Math.min(width / naturalWidth, height / naturalHeight);
      const fittedWidth = Math.max(1, Math.floor(naturalWidth * scale));
      const fittedHeight = Math.max(1, Math.floor(naturalHeight * scale));
      aiRecognitionMediaFrame.style.width = fittedWidth + "px";
      aiRecognitionMediaFrame.style.height = fittedHeight + "px";
      aiRecognitionMediaFrame.style.setProperty("--ai-scan-distance", Math.max(1, fittedHeight - 2) + "px");
      aiRecognitionMainImage.alt = image.alt;
      window.__aiRecognitionBetaDebug.mediaFrame = { width: fittedWidth, height: fittedHeight, naturalWidth, naturalHeight };
    }

    function renderAIRecognitionMedia() {
      const image = aiRecognitionImageById(aiRecognitionState.selectedImageId);
      if (aiRecognitionMainImage.dataset.imageId !== image.id) {
        aiRecognitionMainImage.dataset.imageId = image.id;
        aiRecognitionMainImage.src = image.file;
        aiRecognitionMainImage.alt = image.alt;
      }
      $("#aiRecognitionImageId").textContent = image.id;
      const sequenceStep = aiRecognitionState.source === "auto" ? autoAISequenceStepByImageId(image.id) : null;
      $("#aiRecognitionImageLocation").textContent = sequenceStep ? sequenceStep.label + " · " + image.location : image.location;
      requestAnimationFrame(fitAIRecognitionMedia);
    }

    function restartAIRecognitionScanLine() {
      aiRecognitionScanLine.classList.remove("is-running", "is-paused");
      void aiRecognitionScanLine.offsetWidth;
      if (aiRecognitionState.status === "playing" || aiRecognitionState.status === "paused") {
        aiRecognitionScanLine.classList.add("is-running");
        if (aiRecognitionState.status === "paused" || demo.state === "paused") aiRecognitionScanLine.classList.add("is-paused");
      }
    }

    function animateAIRecognitionImageSwitch() {
      aiRecognitionMainImage.classList.remove("is-sequence-switching");
      void aiRecognitionMainImage.offsetWidth;
      aiRecognitionMainImage.classList.add("is-sequence-switching");
    }

    function renderAIRecognitionBoxes() {
      const currentIssues = aiRecognitionFilteredIssues().filter((issue) => issue.imageId === aiRecognitionState.selectedImageId);
      const fragment = document.createDocumentFragment();
      currentIssues.forEach((issue) => {
        const box = document.createElement("button");
        box.type = "button";
        box.className = "ai-recognition-box is-revealed is-" + issue.severity;
        box.classList.toggle("is-selected", issue.issueId === aiRecognitionState.selectedIssueId);
        box.classList.toggle("is-dimmed", Boolean(aiRecognitionState.selectedIssueId && issue.issueId !== aiRecognitionState.selectedIssueId));
        box.classList.toggle("is-key-label", Boolean(issue.priorityReview && issue.issueId !== aiRecognitionState.selectedIssueId));
        box.dataset.issueId = issue.issueId;
        box.dataset.label = issue.type;
        box.style.left = issue.bbox.x + "%";
        box.style.top = issue.bbox.y + "%";
        box.style.width = issue.bbox.width + "%";
        box.style.height = issue.bbox.height + "%";
        box.setAttribute("aria-label", issue.issueId + " " + issue.type);
        box.addEventListener("click", (event) => {
          event.stopPropagation();
          manualAction();
          selectAIRecognitionIssue(issue.issueId);
        });
        fragment.appendChild(box);
      });
      aiRecognitionBoxLayer.replaceChildren(fragment);
    }

    function renderAIRecognitionIssueDetail() {
      const issue = aiRecognitionIssueById(aiRecognitionState.selectedIssueId);
      const available = issue && aiRecognitionFilteredIssues().some((item) => item.issueId === issue.issueId);
      const empty = $("#aiRecognitionIssueEmpty");
      const detail = $("#aiRecognitionIssueDetail");
      empty.hidden = Boolean(available);
      detail.hidden = !available;
      if (!available) return;
      const severityLabels = { high: "高风险", medium: "中风险", general: "一般问题" };
      $("#aiRecognitionIssueId").textContent = issue.issueId;
      const severity = $("#aiRecognitionIssueSeverity");
      severity.textContent = severityLabels[issue.severity];
      severity.className = "is-" + issue.severity;
      $("#aiRecognitionIssueType").textContent = issue.type;
      $("#aiRecognitionIssueConfidence").textContent = issue.confidence.toFixed(1) + "%";
      $("#aiRecognitionIssueImage").textContent = issue.imageId;
      $("#aiRecognitionIssueLocation").textContent = issue.location;
      $("#aiRecognitionIssueIndicator").textContent = issue.suggestedIndicator;
      $("#aiRecognitionIssueDescription").textContent = issue.description;
    }

    function updateAIRecognitionStatusCopy() {
      const statusCopy = {
        idle: "等待开始AI识别",
        playing: "图像扫描与目标检测中",
        paused: "识别已暂停，可继续",
        completed: "AI识别完成，等待人工复核"
      };
      const runCopy = {
        idle: "开始AI识别",
        playing: "暂停识别",
        paused: "继续识别",
        completed: "重新识别"
      };
      const progressCopy = {
        idle: "识别引擎待命",
        playing: "正在解析现场影像并生成候选问题",
        paused: "识别进度已保留",
        completed: "AI识别完成 · 机器结果未正式入库"
      };
      const resultCopy = {
        idle: "待启动识别",
        playing: "机器预识别中，未正式入库",
        paused: "识别已暂停，结果未正式入库",
        completed: "机器预识别，未正式入库"
      };
      $("#aiRecognitionScanState span").textContent = statusCopy[aiRecognitionState.status];
      $("#aiRecognitionRunButton span").textContent = runCopy[aiRecognitionState.status];
      $("#aiRecognitionProgressCopy").textContent = progressCopy[aiRecognitionState.status];
      const resultStatus = $("#aiRecognitionResultStatus");
      $("strong", resultStatus).textContent = resultCopy[aiRecognitionState.status];
      resultStatus.classList.toggle("is-running", aiRecognitionState.status === "playing" || aiRecognitionState.status === "paused");
      resultStatus.classList.toggle("is-complete", aiRecognitionState.status === "completed");
      aiRecognitionScanLine.classList.toggle("is-running", (aiRecognitionState.status === "playing" || aiRecognitionState.status === "paused") && aiRecognitionState.progress < 1);
      aiRecognitionScanLine.classList.toggle("is-paused", aiRecognitionState.status === "paused" || demo.state === "paused");
      $("#aiRecognitionMediaEmpty").classList.toggle("is-hidden", aiRecognitionState.progress > 0);
    }

    function renderAIRecognitionProgress(progress, options) {
      const settings = options || {};
      const p = clamp(progress, 0, 1);
      const previousCandidateCount = aiRecognitionState.candidateIssues;
      aiRecognitionState.progress = p;
      if (settings.metrics) {
        aiRecognitionState.processedImages = settings.metrics.processedImages;
        aiRecognitionState.candidateIssues = settings.metrics.candidateIssues;
        aiRecognitionState.averageConfidence = settings.metrics.averageConfidence;
        aiRecognitionState.priorityCount = settings.metrics.priorityCount;
      } else {
        aiRecognitionState.processedImages = p >= 1 ? aiRecognitionData.totalImages : Math.floor(aiRecognitionData.totalImages * p);
        aiRecognitionState.candidateIssues = p >= 1 ? aiRecognitionData.targetCandidateIssues : Math.floor(aiRecognitionData.targetCandidateIssues * p);
        aiRecognitionState.averageConfidence = p === 0 ? 0 : Number((78 + (aiRecognitionData.targetAverageConfidence - 78) * easeOut(p)).toFixed(1));
        aiRecognitionState.priorityCount = p >= 1 ? 7 : aiRecognitionData.issues.slice(0, aiRecognitionState.candidateIssues).filter((issue) => issue.priorityReview).length;
      }
      if (p >= 1) aiRecognitionState.status = "completed";
      else if (settings.status) aiRecognitionState.status = settings.status;
      const isIdleEmpty = p === 0 && aiRecognitionState.status === "idle";

      $("#aiRecognitionProgressValue").textContent = Math.round(p * 100) + "%";
      $("#aiRecognitionProgressBar").style.width = (p * 100).toFixed(2) + "%";
      $("#aiRecognitionProcessedCount").textContent = String(aiRecognitionState.processedImages);
      $("#aiRecognitionCandidateCount").textContent = isIdleEmpty ? "—" : String(aiRecognitionState.candidateIssues);
      $("#aiRecognitionConfidence").textContent = isIdleEmpty ? "—" : aiRecognitionState.averageConfidence.toFixed(1);
      $("#aiRecognitionPriorityCount").textContent = isIdleEmpty ? "—" : String(aiRecognitionState.priorityCount);
      $("#aiRecognitionStats").classList.toggle("is-empty", isIdleEmpty);
      $("#aiRecognitionRiskSummary").classList.toggle("is-empty", isIdleEmpty);
      const riskCounts = settings.metrics && settings.metrics.riskCounts
        ? settings.metrics.riskCounts
        : aiRecognitionData.issues.slice(0, aiRecognitionState.candidateIssues).reduce((counts, issue) => {
            counts[issue.severity] += 1;
            return counts;
          }, { high: 0, medium: 0, general: 0 });
      $("#aiRecognitionHighCount").textContent = isIdleEmpty ? "—" : String(riskCounts.high);
      $("#aiRecognitionMediumCount").textContent = isIdleEmpty ? "—" : String(riskCounts.medium);
      $("#aiRecognitionGeneralCount").textContent = isIdleEmpty ? "—" : String(riskCounts.general);

      const selectedIssue = aiRecognitionIssueById(aiRecognitionState.selectedIssueId);
      if (!selectedIssue || !aiRecognitionFilteredIssues().some((issue) => issue.issueId === selectedIssue.issueId)) {
        const currentFirst = aiRecognitionFilteredIssues().find((issue) => issue.imageId === aiRecognitionState.selectedImageId);
        aiRecognitionState.selectedIssueId = currentFirst ? currentFirst.issueId : null;
      }
      if (previousCandidateCount !== aiRecognitionState.candidateIssues || aiRecognitionState.lastRenderedCandidateCount !== aiRecognitionState.candidateIssues || settings.force) {
        aiRecognitionState.lastRenderedCandidateCount = aiRecognitionState.candidateIssues;
        renderAIRecognitionThumbnails();
        renderAIRecognitionBoxes();
        renderAIRecognitionIssueDetail();
      }
      updateAIRecognitionStatusCopy();
      syncAIRecognitionDebug();
    }

    function selectAIRecognitionImage(imageId, options) {
      const image = aiRecognitionImageById(imageId);
      aiRecognitionState.selectedImageId = image.id;
      if (!(options && options.keepIssue)) {
        const firstIssue = aiRecognitionFilteredIssues().find((issue) => issue.imageId === image.id);
        aiRecognitionState.selectedIssueId = firstIssue ? firstIssue.issueId : null;
      }
      renderAIRecognitionMedia();
      renderAIRecognitionThumbnails();
      renderAIRecognitionBoxes();
      renderAIRecognitionIssueDetail();
      syncAIRecognitionDebug();
    }

    function selectAutoAIRecognitionImage(step, index) {
      aiRecognitionState.autoSequenceIndex = index;
      selectAIRecognitionImage(step.imageId);
      animateAIRecognitionImageSwitch();
      restartAIRecognitionScanLine();
    }

    function autoAISequenceTargetMetrics(index) {
      if (index < 0) return { processedImages: 0, candidateIssues: 0, averageConfidence: 0, priorityCount: 0, riskCounts: { high: 0, medium: 0, general: 0 } };
      const step = autoAIImageSequence[index];
      return {
        processedImages: step.processedImages,
        candidateIssues: step.cumulativeIssues,
        averageConfidence: step.confidence,
        priorityCount: step.priorityReview,
        riskCounts: { ...step.risk }
      };
    }

    function interpolateAutoAISequenceMetrics(index, localProgress) {
      const previous = autoAISequenceTargetMetrics(index - 1);
      const target = autoAISequenceTargetMetrics(index);
      const eased = easeOut(localProgress);
      const stepInteger = (from, to) => from + Math.min(to - from, Math.round((to - from) * eased));
      return {
        processedImages: stepInteger(previous.processedImages, target.processedImages),
        candidateIssues: stepInteger(previous.candidateIssues, target.candidateIssues),
        averageConfidence: Number((previous.averageConfidence + (target.averageConfidence - previous.averageConfidence) * eased).toFixed(1)),
        priorityCount: stepInteger(previous.priorityCount, target.priorityCount),
        riskCounts: {
          high: stepInteger(previous.riskCounts.high, target.riskCounts.high),
          medium: stepInteger(previous.riskCounts.medium, target.riskCounts.medium),
          general: stepInteger(previous.riskCounts.general, target.riskCounts.general)
        }
      };
    }

    function completeAutoAISequenceImage(index, elapsed) {
      if (index < 0 || demo.aiCompletedImages.has(index)) return;
      demo.aiCompletedImages.add(index);
      const step = autoAIImageSequence[index];
      recordAISequenceEvent("image-complete", step, elapsed, autoAISequenceTargetMetrics(index));
    }

    function renderAutoAIRecognitionSequence(elapsed) {
      const sequenceElapsed = clamp(elapsed - demo.aiStartedAtElapsed, 0, autoAIImageSequence.length * AUTO_AI_IMAGE_SECONDS);
      const rawIndex = Math.floor(sequenceElapsed / AUTO_AI_IMAGE_SECONDS);
      const index = Math.min(autoAIImageSequence.length - 1, rawIndex);
      const localProgress = clamp((sequenceElapsed - index * AUTO_AI_IMAGE_SECONDS) / AUTO_AI_IMAGE_SECONDS, 0, 0.999);
      const step = autoAIImageSequence[index];
      if (index !== aiRecognitionState.autoSequenceIndex) {
        if (aiRecognitionState.autoSequenceIndex >= 0) completeAutoAISequenceImage(aiRecognitionState.autoSequenceIndex, elapsed);
        selectAutoAIRecognitionImage(step, index);
        recordAISequenceEvent("image-switch", step, elapsed, autoAISequenceTargetMetrics(index));
      }
      const metrics = interpolateAutoAISequenceMetrics(index, localProgress);
      const totalProgress = clamp((index + localProgress) / autoAIImageSequence.length, 0, 0.999);
      renderAIRecognitionProgress(totalProgress, { status: "playing", metrics });
      const sequenceDebug = window.__aiRecognitionSequenceDebug;
      sequenceDebug.active = true;
      sequenceDebug.currentIndex = index;
      sequenceDebug.currentImageId = step.imageId;
      sequenceDebug.imageElapsed = Number((localProgress * AUTO_AI_IMAGE_SECONDS).toFixed(3));
      sequenceDebug.sequenceElapsed = Number(sequenceElapsed.toFixed(3));
    }

    function selectAIRecognitionIssue(issueId) {
      const issue = aiRecognitionIssueById(issueId);
      if (!issue || !aiRecognitionFilteredIssues().some((item) => item.issueId === issue.issueId)) return;
      aiRecognitionState.selectedIssueId = issue.issueId;
      if (aiRecognitionState.selectedImageId !== issue.imageId) {
        aiRecognitionState.selectedImageId = issue.imageId;
        renderAIRecognitionMedia();
        renderAIRecognitionThumbnails();
      }
      aiRecognitionState.mode = "result";
      aiRecognitionWorkspace.classList.remove("is-original-mode");
      $$('[data-ai-mode]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiMode === "result"));
      renderAIRecognitionBoxes();
      renderAIRecognitionIssueDetail();
      syncAIRecognitionDebug();
    }

    function setAIRecognitionRiskFilter(filter) {
      aiRecognitionState.riskFilter = ["all", "high", "medium", "general", "priority"].includes(filter) ? filter : "all";
      $$('[data-ai-risk]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiRisk === aiRecognitionState.riskFilter));
      const images = aiRecognitionVisibleImages();
      if (images.length && !images.some((image) => image.id === aiRecognitionState.selectedImageId)) aiRecognitionState.selectedImageId = images[0].id;
      const firstIssue = aiRecognitionFilteredIssues().find((issue) => issue.imageId === aiRecognitionState.selectedImageId);
      aiRecognitionState.selectedIssueId = firstIssue ? firstIssue.issueId : null;
      renderAIRecognitionMedia();
      renderAIRecognitionThumbnails();
      renderAIRecognitionBoxes();
      renderAIRecognitionIssueDetail();
      syncAIRecognitionDebug();
    }

    function setAIRecognitionImageFilter(filter) {
      aiRecognitionState.imageFilter = ["all", "photo", "drone"].includes(filter) ? filter : "all";
      $$('[data-ai-image-filter]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiImageFilter === aiRecognitionState.imageFilter));
      const images = aiRecognitionVisibleImages();
      if (images.length) selectAIRecognitionImage(images[0].id);
      else renderAIRecognitionThumbnails();
    }

    function setAIRecognitionMode(mode) {
      aiRecognitionState.mode = mode === "original" ? "original" : "result";
      aiRecognitionWorkspace.classList.toggle("is-original-mode", aiRecognitionState.mode === "original");
      $$('[data-ai-mode]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiMode === aiRecognitionState.mode));
      syncAIRecognitionDebug();
    }

    function cancelAIRecognitionFrame() {
      if (aiRecognitionState.rafId) cancelAnimationFrame(aiRecognitionState.rafId);
      aiRecognitionState.rafId = 0;
    }

    function resetAIRecognitionUI(options) {
      cancelAIRecognitionFrame();
      window.clearTimeout(appState.handoffHintTimer);
      appState.handoffHintTimer = 0;
      $("#aiRecognitionResultStatus").classList.remove("is-next-hint");
      $("#aiRecognitionHandoffButton").classList.remove("is-notifying");
      aiRecognitionState.status = "idle";
      aiRecognitionState.progress = 0;
      aiRecognitionState.elapsedMs = 0;
      aiRecognitionState.source = "manual";
      aiRecognitionState.selectedImageId = aiRecognitionData.images[0].id;
      aiRecognitionState.selectedIssueId = null;
      aiRecognitionState.imageFilter = "all";
      aiRecognitionState.riskFilter = "all";
      aiRecognitionState.mode = "result";
      aiRecognitionState.lastRenderedCandidateCount = -1;
      aiRecognitionState.autoSequenceIndex = -1;
      aiRecognitionWorkspace.classList.remove("is-original-mode", "is-auto-sequence");
      aiRecognitionMainImage.classList.remove("is-sequence-switching");
      window.__aiRecognitionSequenceDebug.active = false;
      window.__aiRecognitionSequenceDebug.currentIndex = -1;
      window.__aiRecognitionSequenceDebug.currentImageId = aiRecognitionData.images[0].id;
      window.__aiRecognitionSequenceDebug.imageElapsed = 0;
      window.__aiRecognitionSequenceDebug.sequenceElapsed = 0;
      window.__aiRecognitionSequenceDebug.events = [];
      resetAIRecognitionStageVisuals();
      if (appState.aiRecognitionWorkspaceOpen) {
        appState.activeModuleIndex = 1;
        setAIRecognitionRailState(true);
      }
      $$('[data-ai-mode]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiMode === "result"));
      $$('[data-ai-risk]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiRisk === "all"));
      $$('[data-ai-image-filter]').forEach((button) => button.classList.toggle("is-current", button.dataset.aiImageFilter === "all"));
      renderAIRecognitionMedia();
      renderAIRecognitionProgress(0, { status: "idle", force: true });
      syncDebug();
      if (!(options && options.silent)) showToast("AI识别已重置，01阶段治理结果保持完成");
    }

    function completeAIRecognitionRun(source) {
      cancelAIRecognitionFrame();
      aiRecognitionState.source = source || aiRecognitionState.source;
      renderAIRecognitionProgress(1, { status: "completed", force: true });
      window.__aiRecognitionSequenceDebug.active = false;
      if (aiRecognitionState.source === "manual") showToast("AI识别完成：43项机器候选问题等待人工复核", "success", 2800);
    }

    function startAIRecognitionRun() {
      cancelAIRecognitionFrame();
      resetAIRecognitionUI({ silent: true });
      aiRecognitionState.status = "playing";
      aiRecognitionState.source = "manual";
      aiRecognitionState.elapsedMs = 0;
      aiRecognitionState.startedAt = performance.now();
      renderAIRecognitionProgress(0, { status: "playing", force: true });
      function frame(now) {
        if (aiRecognitionState.status !== "playing" || aiRecognitionState.source !== "manual") return;
        aiRecognitionState.elapsedMs = now - aiRecognitionState.startedAt;
        const progress = clamp(aiRecognitionState.elapsedMs / aiRecognitionState.durationMs, 0, 1);
        renderAIRecognitionProgress(progress, { status: "playing" });
        if (progress < 1) aiRecognitionState.rafId = requestAnimationFrame(frame);
        else completeAIRecognitionRun("manual");
      }
      aiRecognitionState.rafId = requestAnimationFrame(frame);
    }

    function pauseAIRecognitionRun() {
      if (aiRecognitionState.status !== "playing") return;
      if (aiRecognitionState.source === "manual") aiRecognitionState.elapsedMs = Math.min(aiRecognitionState.durationMs, performance.now() - aiRecognitionState.startedAt);
      cancelAIRecognitionFrame();
      aiRecognitionState.status = "paused";
      renderAIRecognitionProgress(aiRecognitionState.progress, { status: "paused", force: true });
    }

    function resumeAIRecognitionRun() {
      if (aiRecognitionState.status !== "paused") return;
      aiRecognitionState.status = "playing";
      aiRecognitionState.source = "manual";
      aiRecognitionState.startedAt = performance.now() - aiRecognitionState.elapsedMs;
      renderAIRecognitionProgress(aiRecognitionState.progress, { status: "playing", force: true });
      function frame(now) {
        if (aiRecognitionState.status !== "playing" || aiRecognitionState.source !== "manual") return;
        aiRecognitionState.elapsedMs = now - aiRecognitionState.startedAt;
        const progress = clamp(aiRecognitionState.elapsedMs / aiRecognitionState.durationMs, 0, 1);
        renderAIRecognitionProgress(progress, { status: "playing" });
        if (progress < 1) aiRecognitionState.rafId = requestAnimationFrame(frame);
        else completeAIRecognitionRun("manual");
      }
      aiRecognitionState.rafId = requestAnimationFrame(frame);
    }

    function toggleAIRecognitionRun() {
      if (aiRecognitionState.status === "playing") pauseAIRecognitionRun();
      else if (aiRecognitionState.status === "paused") resumeAIRecognitionRun();
      else startAIRecognitionRun();
    }

    function stepAIRecognitionIssue(direction) {
      const issues = aiRecognitionFilteredIssues();
      if (!issues.length) return;
      const currentIndex = Math.max(0, issues.findIndex((issue) => issue.issueId === aiRecognitionState.selectedIssueId));
      const nextIndex = (currentIndex + direction + issues.length) % issues.length;
      selectAIRecognitionIssue(issues[nextIndex].issueId);
    }

    function setAIRecognitionNextStage() {
      const steps = $$(".ai-recognition-flow-step", aiRecognitionWorkspace);
      steps.forEach((step, index) => {
        step.classList.toggle("is-complete", index <= 1);
        step.classList.remove("is-current");
        step.classList.toggle("is-next", index === 2);
        const label = $("i", step);
        if (index <= 1) label.textContent = "已完成";
        else if (index === 2) label.textContent = "下一阶段";
        else label.textContent = "未开始";
      });
      moduleRailButtons.forEach((button, index) => {
        button.classList.toggle("is-complete", index <= 1);
        button.classList.toggle("is-active", index === 2);
        const label = $("i", button);
        if (index <= 1) label.textContent = "已完成";
        else if (index === 2) label.textContent = "下一阶段";
        else label.textContent = "未开始";
      });
      appState.activeModuleIndex = 2;
      setWorkflowStage(2, 1, true);
      syncDebug();
    }

    function resetAIRecognitionStageVisuals() {
      const steps = $$(".ai-recognition-flow-step", aiRecognitionWorkspace);
      steps.forEach((step, index) => {
        step.classList.toggle("is-complete", index === 0);
        step.classList.toggle("is-current", index === 1);
        step.classList.remove("is-next");
        const label = $("i", step);
        if (index === 0) label.textContent = "已完成";
        else if (index === 1) label.textContent = "当前阶段";
        else label.textContent = "未开始";
      });
    }

    function requestAIRecognitionHandoff() {
      if (aiRecognitionState.status === "completed") setAIRecognitionNextStage();
      window.clearTimeout(appState.handoffHintTimer);
      const resultStatus = $("#aiRecognitionResultStatus");
      const handoffButton = $("#aiRecognitionHandoffButton");
      resultStatus.classList.add("is-next-hint");
      handoffButton.classList.add("is-notifying");
      $("strong", resultStatus).textContent = "03人工复核工作台将在下一开发阶段完成";
      appState.handoffHintTimer = window.setTimeout(() => {
        resultStatus.classList.remove("is-next-hint");
        handoffButton.classList.remove("is-notifying");
        updateAIRecognitionStatusCopy();
        appState.handoffHintTimer = 0;
      }, 1800);
    }

    function projectById(id) {
      return cityProjects.find((project) => project.id === id) || null;
    }

    function renderProjectCollections() {
      const pointFragment = document.createDocumentFragment();
      const listFragment = document.createDocumentFragment();

      cityProjects.forEach((project) => {
        const point = document.createElement("button");
        point.type = "button";
        point.className = "city-project-point";
        point.dataset.projectId = project.id;
        point.style.left = project.x + "%";
        point.style.top = project.y + "%";
        point.setAttribute("aria-label", project.name);
        point.title = project.name;

        const label = document.createElement("span");
        label.className = "point-label";
        label.textContent = project.shortName;
        const debug = document.createElement("small");
        debug.className = "point-debug";
        debug.textContent = project.id + " · " + project.x.toFixed(2) + "% / " + project.y.toFixed(2) + "%";
        point.append(label, debug);
        point.addEventListener("click", (event) => {
          event.stopPropagation();
          manualAction();
          selectProject(project.id, { openDetail: true, pan: true });
        });
        pointFragment.appendChild(point);

        const item = document.createElement("button");
        item.type = "button";
        item.className = "project-list-item";
        item.dataset.projectId = project.id;
        item.setAttribute("aria-label", "查看" + project.name);
        const number = document.createElement("b");
        number.textContent = project.id;
        const copy = document.createElement("span");
        copy.className = "project-list-copy";
        const name = document.createElement("strong");
        name.textContent = project.name;
        const meta = document.createElement("small");
        meta.textContent = project.type + " · " + project.area.replace("西安市 · ", "");
        copy.append(name, meta);
        const status = document.createElement("i");
        status.setAttribute("aria-hidden", "true");
        item.append(number, copy, status);
        item.addEventListener("click", () => {
          manualAction();
          selectProject(project.id, { openDetail: true, pan: true });
        });
        listFragment.appendChild(item);
      });

      projectPoints.replaceChildren(pointFragment);
      cityProjectList.replaceChildren(listFragment);
    }

    function updateProjectSelection() {
      $$(".city-project-point").forEach((point) => {
        const selected = cityMapState.mode === "focused" && point.dataset.projectId === cityMapState.focusedProjectId;
        point.classList.toggle("is-selected", selected);
        point.setAttribute("aria-pressed", String(selected));
      });
      $$(".project-list-item").forEach((item) => item.classList.toggle("is-active", item.dataset.projectId === appState.activeProjectId));
    }

    function renderProjectDetail(project) {
      if (!project) return;
      $("#detailProjectId").textContent = "PROJECT / " + project.id;
      $("#detailProjectName").textContent = project.name;
      $("#detailProjectArea").textContent = project.area;
      $("#detailProjectType").textContent = project.type;
      $("#workspaceProjectName").textContent = project.name;
    }

    function selectProject(id, options) {
      const project = projectById(id);
      if (!project) return Promise.resolve();
      const settings = options || {};
      if (settings.pan && demo.state !== "playing") {
        const focusOptions = {
          openDetail: Boolean(settings.openDetail),
          reserveDetail: Boolean(settings.openDetail),
          interactionSource: settings.interactionSource || "manual"
        };
        if (cityMapState.mode === "focused" && cityMapState.focusedProjectId !== id) return switchFocusedProject(id, focusOptions);
        return focusCityProject(id, focusOptions);
      }
      appState.activeProjectId = id;
      renderProjectDetail(project);
      updateProjectSelection();
      if (settings.pan) panToProject(project, { interactionSource: "demo" });
      const transition = settings.openDetail ? openLeftDrawer("detail") : Promise.resolve();
      syncDebug();
      return transition;
    }

    function applyLeftDrawerView(view) {
      const nextView = view === "detail" ? "detail" : "list";
      appState.leftDrawerView = nextView;
      cityListView.hidden = nextView !== "list";
      projectDetailView.hidden = nextView !== "detail";
      $("#leftDrawerEyebrow").textContent = nextView === "list" ? "XI'AN / URBAN RENEWAL FIELD ATLAS" : "PROJECT DETAIL / URBAN HEALTH";
      $("#leftDrawerTitle").textContent = nextView === "list" ? "西安市城市更新项目总览" : "单项目体检档案";
      syncDebug();
    }

    function switchLeftDrawerView(view) {
      const nextView = view === "detail" ? "detail" : "list";
      if (appState.leftDrawerView === nextView) return Promise.resolve();
      if (motion.left.contentState === "switching") return motion.left.contentPromise;
      motion.left.contentState = "switching";
      motion.left.contentPromise = (async () => {
        const currentView = appState.leftDrawerView === "detail" ? projectDetailView : cityListView;
        leftDrawer.classList.remove("is-content-entering");
        leftDrawer.classList.add("is-content-leaving");
        await waitForVisualEnd(currentView, { property: "opacity" });
        if (motion.left.state !== "open") return;
        applyLeftDrawerView(nextView);
        leftDrawer.classList.remove("is-content-leaving");
        leftDrawer.classList.add("is-content-entering");
        const nextViewElement = nextView === "detail" ? projectDetailView : cityListView;
        await waitForVisualEnd(nextViewElement, { kind: "animation" });
        leftDrawer.classList.remove("is-content-entering");
        motion.left.contentState = "idle";
        syncMotionDebug("left-content-complete");
      })().finally(() => {
        motion.left.contentState = "idle";
      });
      return motion.left.contentPromise;
    }

    function openLeftDrawer(view) {
      const nextView = view === "detail" ? "detail" : "list";
      if (nextView === "detail" && !appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      if (motion.left.state === "open") return switchLeftDrawerView(nextView);
      if (motion.left.state === "opening") return motion.left.promise;
      if (motion.left.state === "closing") return motion.left.promise.then(() => openLeftDrawer(nextView));

      const token = ++motion.left.token;
      motion.left.state = "opening";
      syncMotionDebug();
      motion.left.promise = (async () => {
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.left.token) return;
        applyLeftDrawerView(nextView);
        leftDrawer.classList.remove("is-closing", "is-settled", "is-content-leaving", "is-content-entering");
        leftDrawer.classList.add("is-opening");
        leftDrawer.setAttribute("aria-hidden", "false");
        projectEntry.setAttribute("aria-expanded", "true");
        appStage.classList.add("is-left-open");
        setBackdrop("open");
        await nextPaint();
        if (token !== motion.left.token) return;
        leftDrawer.classList.add("is-open");
        const lastContent = nextView === "list" ? $("#createAssessmentButton") : $("#enterCurrentAssessment");
        await Promise.all([
          waitForVisualEnd(leftDrawer, { property: "transform" }),
          waitForVisualEnd(lastContent, { property: "opacity" })
        ]);
        if (token !== motion.left.token) return;
        leftDrawer.classList.remove("is-opening");
        leftDrawer.classList.add("is-settled");
        motion.left.state = "open";
        syncMotionDebug("left-open-complete");
        syncDebug();
      })();
      return motion.left.promise;
    }

    function closeLeftDrawer(options) {
      const keepBackdrop = Boolean(options && options.keepBackdrop);
      if (motion.left.state === "closed") return Promise.resolve();
      if (motion.left.state === "closing") return motion.left.promise;
      if (motion.left.state === "opening") return motion.left.promise.then(() => closeLeftDrawer(options));
      if (motion.left.contentState === "switching") return motion.left.contentPromise.then(() => closeLeftDrawer(options));

      const token = ++motion.left.token;
      motion.left.state = "closing";
      syncMotionDebug();
      motion.left.promise = (async () => {
        leftDrawer.classList.remove("is-settled", "is-opening", "is-content-leaving", "is-content-entering");
        leftDrawer.classList.add("is-closing");
        if (!keepBackdrop) setBackdrop("closing");
        await nextPaint();
        if (token !== motion.left.token) return;
        leftDrawer.classList.remove("is-open");
        await waitForVisualEnd(leftDrawer, { property: "transform" });
        if (token !== motion.left.token) return;
        leftDrawer.classList.remove("is-closing");
        leftDrawer.setAttribute("aria-hidden", "true");
        projectEntry.setAttribute("aria-expanded", "false");
        appStage.classList.remove("is-left-open");
        appState.leftDrawerView = null;
        motion.left.state = "closed";
        if (!keepBackdrop) setBackdrop("closed");
        syncMotionDebug("left-close-complete");
        syncDebug();
      })();
      return motion.left.promise;
    }

    function getStageBusinessStatus(stageId) {
      const stage = Number(stageId);
      const reportComplete = stage === 5 && ["completed", "stale"].includes(reportGenerationState.status) && demo.state === "idle";
      if (stage <= appState.workflowCompletedThrough || reportComplete) return "completed";
      if (appState.workflowCurrentStage === stage && !appState.workflowNextOnly) return "in-progress";
      return "not-started";
    }

    function getStageDataAvailability(stageId) {
      const stage = Number(stageId);
      return { previousComplete: stage === 0 || appState.workflowCompletedThrough >= stage - 1, completedThrough: appState.workflowCompletedThrough };
    }

    function stageSummaryModel(stageId) {
      const stage = Number(stageId);
      const status = getStageBusinessStatus(stage);
      const availability = getStageDataAvailability(stage);
      const processing = Number($("#processingValue").textContent) || 0;
      const governanceRatio = clamp(processing / 100, 0, 1);
      const boundLocations = 174 + Math.round(governanceRatio * 12);
      const reviewStats = humanReviewCalculateStats(humanReviewState);
      const gisBound = 42 - gisState.pendingBindings.size;
      const reportStatus = reportGenerationState.status === "generating" || demoReportGenerationState.status === "generating" ? "生成中" : "草稿预览";
      if (stage === 0) {
        const spatialWorkflow = activeSpatialWorkflowState();
        if (status === "completed") return { status, items: [["数据完整度", "96%"], ["现场照片", "186张"], ["照片定位", "186 / 186"], ["原始EXIF", "174张"], ["人工补绑", "12张"], ["踏勘路线", "1条"], ["关键节点", "8个"], ["路线关联", "186 / 186"]] };
        if (status === "in-progress" && spatialCollectionState.view === "spatial") {
          if (spatialWorkflow.status === "route-cleaning") return { status, items: [["数据完整度", "治理中"], ["照片定位", "174 / 186"], ["缺失定位", "12张"], ["踏勘路线", "清洗中"], ["关键节点", `${spatialWorkflow.visibleStopCount} / 8`]] };
          if (["route-ready", "locating", "located-pending-bind"].includes(spatialWorkflow.status)) return { status, items: [["照片定位", "174 / 186"], ["候选定位", `${spatialWorkflow.candidateLocationCount} / 12`], ["待补绑", "12张"], ["踏勘路线", "已清洗"]] };
          if (["binding", "completed"].includes(spatialWorkflow.status)) return { status, items: [["照片定位", `${spatialWorkflow.totalLocatedCount} / 186`], ["人工补绑", `${spatialWorkflow.manualBoundCount} / 12`], ["待补绑", `${12 - spatialWorkflow.manualBoundCount}张`], ["路线关联", `${spatialWorkflow.routeLinkedCount} / 186`]] };
        }
        if (status === "in-progress") return { status, items: [["数据完整度", `82% → ${Math.round(82 + governanceRatio * 14)}%`], ["已完成定位", `${boundLocations} / 186`], ["待补绑", `${186 - boundLocations}张`], ["路线状态", processing < 58 ? "解析中" : "关联中"], ["当前治理状态", "进行中"]] };
        return { status, items: [["数据完整度", "82%"], ["现场照片", "186张"], ["无人机影像", "12张"], ["外业调查表", "3份"], ["原始照片定位", "174 / 186"], ["缺失定位", "12张"], ["踏勘路线", "待清洗"], ["GIS图层", "8类"]] };
      }
      if (stage === 1) {
        if (status === "completed") return { status, items: [["识别影像", "198张"], ["候选问题", "43项"], ["平均置信度", "92.6%"], ["重点待复核", "7项"], ["风险分布", "6 / 18 / 19"]] };
        if (status === "in-progress") return { status, items: [["已处理影像", `${aiRecognitionState.processedImages} / 198`], ["候选问题", `${aiRecognitionState.candidateIssues}项`], ["平均置信度", aiRecognitionState.averageConfidence ? `${aiRecognitionState.averageConfidence.toFixed(1)}%` : "计算中"], ["重点待复核", `${aiRecognitionState.priorityCount}项`], ["当前状态", "AI识别中"]] };
        return { status, items: [[availability.previousComplete ? "待识别影像" : "识别影像", availability.previousComplete ? "198张" : "待治理"], ["候选问题", "待识别"], ["平均置信度", "待计算"], ["重点待复核", "待生成"], ["风险分布", "待识别"]] };
      }
      if (stage === 2) {
        if (status === "completed") return { status, items: [["已复核", "43 / 43"], ["有效问题", "42项"], ["排除误报", "1项"], ["风险分布", "6 / 18 / 18"]] };
        if (status === "in-progress") return { status, items: [["已复核", `${reviewStats.reviewed} / 43`], ["有效问题", reviewStats.effective === null ? `${reviewStats.reviewed - reviewStats.excluded}项（暂存）` : `${reviewStats.effective}项`], ["排除误报", `${reviewStats.excluded}项`], ["剩余任务", `${reviewStats.pending}项`], ["当前状态", "人工复核中"]] };
        return { status, items: availability.previousComplete ? [["待复核任务", "43项"], ["重点待复核", "7项"], ["有效问题", "待确认"], ["排除误报", "待确认"], ["最终风险分布", "待确认"]] : [["复核任务", "待生成"], ["有效问题", "待复核"], ["排除误报", "待复核"], ["最终风险分布", "待复核"]] };
      }
      if (stage === 3) {
        if (status === "completed") return { status, items: [["有效问题", "42项"], ["风险分布", "6 / 18 / 18"], ["空间绑定", "42 / 42"], ["GIS图层", "8类"], ["分析范围", "500 / 800 / 1000m"]] };
        if (status === "in-progress") return { status, items: [["有效问题", "42项"], ["空间绑定", `${gisBound} / 42`], ["待确认", `${42 - gisBound}项`], ["GIS图层", "8类"], ["分析范围", "500 / 800 / 1000m"]] };
        return { status, items: availability.previousComplete ? [["待落图问题", "42项"], ["风险分布", "6 / 18 / 18"], ["空间绑定", "0 / 42"], ["GIS图层", "8类"], ["分析范围", "待分析"]] : [["有效问题", "待复核"], ["空间绑定", "待落图"], ["GIS图层", "8类基础数据"], ["分析范围", "待分析"]] };
      }
      if (stage === 4) {
        if (status === "completed") return { status, items: [["一级指标", "2类"], ["二级指标", "10项"], ["建筑安全", "78"], ["社区环境", "84"], ["综合得分", "82.4"], ["未达标指标", "3项"]] };
        if (status === "in-progress") {
          const ratio = demo.indicatorActive ? clamp((demo.elapsed - shiftedDemoTime(39.95)) / 3.65, 0, 1) : 0;
          return { status, items: [["已映射问题", `${Math.round(42 * ratio)} / 42`], ["已核算指标", `${Math.round(10 * ratio)} / 10`], ["建筑安全", ratio > .7 ? "78" : "计算中"], ["社区环境", ratio > .8 ? "84" : "计算中"], ["综合得分", ratio > .9 ? "82.4" : "计算中"]] };
        }
        return { status, items: availability.previousComplete ? [["有效问题", "42项"], ["空间绑定", "42 / 42"], ["一级指标", "2类"], ["二级指标", "10项"], ["综合得分", "待核算"]] : [["核算输入", "待准备"], ["一级指标", "2类"], ["二级指标", "10项"], ["综合得分", "待核算"], ["未达标指标", "待核算"]] };
      }
      if (status === "completed") return { status, items: [["报告成果", "3类"], ["综合报告", "8页"], ["证据问题", "42项"], ["体检指标", "10项"], ["当前状态", "报告包已生成"]] };
      if (status === "in-progress") return { status, items: [["报告类型", "3类"], ["综合报告", "8页"], ["证据问题", "42项"], ["体检指标", "10项"], ["当前状态", reportStatus]] };
      return { status, items: availability.previousComplete ? [["可选报告模板", "3类"], ["综合报告模板", "8页"], ["证据问题", "42项待汇入"], ["体检指标", "10项待引用"], ["综合得分", "82.4"], ["当前状态", "待生成"]] : [["可选报告模板", "3类"], ["综合报告模板", "8页"], ["证据问题", "待汇入"], ["体检指标", "待引用"], ["当前状态", "输入待准备"]] };
    }

    function renderStageDrawerSummary(stageId) {
      const host = $("#stageDrawerSummary");
      if (!host) return;
      const model = stageSummaryModel(stageId);
      const statusLabel = model.status === "completed" ? "已完成" : model.status === "in-progress" ? "进行中" : "未开始";
      host.dataset.status = model.status;
      host.innerHTML = `<header class="stage-summary-heading"><span>STAGE DATA / 阶段数据</span><b>${statusLabel}</b></header><div class="stage-module-summary-grid">${model.items.map(([label, value]) => `<article><span>${label}</span><b>${value}</b></article>`).join("")}</div>${Number(stageId) === 5 ? '<p class="stage-summary-disclaimer">Demo预置报告能力 · 非正式成果</p>' : ""}`;
    }

    function setSpatialCollectionView(view) {
      spatialCollectionState.view = view === "spatial" ? "spatial" : "governance";
      $("#governanceView").hidden = spatialCollectionState.view !== "governance";
      $("#spatialCollectionView").hidden = spatialCollectionState.view !== "spatial";
      $$('[data-upload-view]').forEach((button) => button.classList.toggle("is-current", button.dataset.uploadView === spatialCollectionState.view));
      if (spatialCollectionState.view === "spatial") renderSpatialCollectionView();
    }

    function activeSpatialWorkflowState() {
      return spatialCollectionState.workflowSource === "demo" ? demoSpatialCollectionState : manualSpatialCollectionState;
    }

    function clearSpatialWorkflowTimers(state) {
      state.timerIds.forEach((timerId) => window.clearTimeout(timerId));
      state.timerIds.length = 0;
      state.operationToken += 1;
    }

    function scheduleSpatialWorkflow(state, delay, token, action) {
      const timerId = window.setTimeout(() => {
        state.timerIds = state.timerIds.filter((id) => id !== timerId);
        if (state.operationToken !== token) return;
        action();
      }, delay);
      state.timerIds.push(timerId);
    }

    function resetSpatialWorkflowState(state) {
      clearSpatialWorkflowTimers(state);
      Object.assign(state, createSpatialWorkflowState(state.source));
      return state;
    }

    function applySpatialLocateGroup(state, groupIndex) {
      const group = clamp(Math.floor(groupIndex), 0, 2);
      state.status = "locating";
      state.routeStatus = "ready";
      state.visibleStopCount = 8;
      state.activeLocateGroup = group;
      state.mapViewMode = `locate-group-${group + 1}`;
      state.candidateLocationCount = Math.min(12, (group + 1) * 4);
      state.selectedMissingPhotoId = photoLocationData[174 + group * 4].photoId;
      return state;
    }

    function completeSpatialAutoLocate(state) {
      state.status = "located-pending-bind";
      state.routeStatus = "ready";
      state.visibleStopCount = 8;
      state.activeLocateGroup = 2;
      state.mapViewMode = "overview";
      state.candidateLocationCount = 12;
      return state;
    }

    function applySpatialBindingProgress(state, progress) {
      const ratio = clamp(progress, 0, 1);
      state.status = "binding";
      state.routeStatus = "ready";
      state.visibleStopCount = 8;
      state.candidateLocationCount = 12;
      state.manualBoundCount = Math.round(12 * ratio);
      state.totalLocatedCount = 174 + state.manualBoundCount;
      state.missingCount = 12 - state.manualBoundCount;
      state.mapViewMode = "overview";
      return state;
    }

    function applySpatialRouteLinkingProgress(state, progress) {
      const ratio = clamp(progress, 0, 1);
      state.status = ratio >= 1 ? "completed" : "binding";
      state.routeStatus = "ready";
      state.visibleStopCount = 8;
      state.candidateLocationCount = 12;
      state.manualBoundCount = 12;
      state.totalLocatedCount = 186;
      state.missingCount = 0;
      state.routeLinkedCount = Math.round(186 * ratio);
      state.mapViewMode = "overview";
      return state;
    }

    function startSpatialAutoLocate(options = {}) {
      const state = options.state || manualSpatialCollectionState;
      if (!["raw", "route-ready"].includes(state.status) || state.timerIds.length) return false;
      clearSpatialWorkflowTimers(state);
      const token = state.operationToken;
      state.status = "route-cleaning";
      state.routeStatus = "cleaning";
      state.visibleStopCount = 0;
      state.mapViewMode = "overview";
      if (state === manualSpatialCollectionState) spatialCollectionState.workflowSource = "manual";
      renderSpatialCollectionView();
      scheduleSpatialWorkflow(state, 420, token, () => { state.status = "route-ready"; state.routeStatus = "ready"; state.visibleStopCount = 8; renderSpatialCollectionView(); });
      [0, 1, 2].forEach((group, index) => scheduleSpatialWorkflow(state, 760 + index * 360, token, () => { applySpatialLocateGroup(state, group); renderSpatialCollectionView(); }));
      scheduleSpatialWorkflow(state, 1880, token, () => { completeSpatialAutoLocate(state); renderSpatialCollectionView(); });
      return true;
    }

    function startSpatialManualBinding(options = {}) {
      const state = options.state || manualSpatialCollectionState;
      if (state.status !== "located-pending-bind" || state.timerIds.length) return false;
      clearSpatialWorkflowTimers(state);
      const token = state.operationToken;
      applySpatialBindingProgress(state, 0);
      if (state === manualSpatialCollectionState) spatialCollectionState.workflowSource = "manual";
      renderSpatialCollectionView();
      [0.5, 1].forEach((ratio, index) => scheduleSpatialWorkflow(state, 420 + index * 430, token, () => { applySpatialBindingProgress(state, ratio); renderSpatialCollectionView(); }));
      [62 / 186, 124 / 186, 1].forEach((ratio, index) => scheduleSpatialWorkflow(state, 1120 + index * 300, token, () => { applySpatialRouteLinkingProgress(state, ratio); renderSpatialCollectionView(); }));
      return true;
    }

    function applySpatialDemoStateAt(target) {
      const state = demoSpatialCollectionState;
      clearSpatialWorkflowTimers(state);
      Object.assign(state, createSpatialWorkflowState("demo"));
      const local = clamp(target - SPATIAL_DEMO_START, 0, SPATIAL_DEMO_DURATION);
      if (local < .65) {
        if (local >= .15) { state.status = "route-cleaning"; state.routeStatus = "cleaning"; state.visibleStopCount = Math.round(clamp((local - .15) / .5, 0, 1) * 8); }
      } else if (local < 1.05) {
        state.status = "route-ready"; state.routeStatus = "ready"; state.visibleStopCount = 8;
      } else if (local < 2.1) {
        applySpatialLocateGroup(state, local < 1.4 ? 0 : local < 1.75 ? 1 : 2);
      } else if (local < 2.3) {
        completeSpatialAutoLocate(state);
      } else if (local < 2.85) {
        applySpatialBindingProgress(state, local < 2.75 ? .5 : 1);
      } else if (local < 3.5) {
        const routeRatio = local < 3.05 ? 62 / 186 : local < 3.25 ? 124 / 186 : 1;
        applySpatialRouteLinkingProgress(state, routeRatio);
        state.status = "binding";
      } else {
        applySpatialRouteLinkingProgress(state, 1);
      }
      spatialCollectionState.workflowSource = "demo";
      spatialCollectionState.view = "spatial";
      spatialCollectionState.focused = state.mapViewMode !== "overview";
      spatialCollectionState.activeTab = state.status === "located-pending-bind" || state.status === "binding" ? "binding" : "route";
      const renderKey = [state.status, state.visibleStopCount, state.candidateLocationCount, state.manualBoundCount, state.routeLinkedCount, state.mapViewMode].join("|");
      if (demo.spatialRenderKey !== renderKey) {
        demo.spatialRenderKey = renderKey;
        renderSpatialCollectionView();
      }
      return state;
    }

    function spatialWorkflowPresentation(state) {
      const presentations = {
        raw: ["原始数据待治理", "原始定位174 / 186，识别到12张缺失定位照片。", "route"],
        "route-cleaning": ["步骤1 · 清洗踏勘路线", "路线清洗中，正在识别起终点与8个关键停留节点。", "route"],
        "route-ready": ["踏勘路线清洗完成", "路线、起终点和8个关键节点已就绪。", "locate"],
        locating: ["步骤2 · 自动定位缺失照片", `第${Number(state.activeLocateGroup) + 1}组定位推演完成，候选点${state.candidateLocationCount} / 12。`, "locate"],
        "located-pending-bind": ["候选定位12 / 12", "等待确认补绑；依据路线顺序、相邻照片和人工规则。", "bind"],
        binding: state.manualBoundCount < 12 ? ["步骤3 · 确认照片补绑", `照片定位${state.totalLocatedCount} / 186，人工补绑${state.manualBoundCount} / 12。`, "bind"] : ["步骤4 · 建立路线关联", `路线关联${state.routeLinkedCount} / 186。`, "link"],
        completed: ["空间采集治理完成", "照片定位186 / 186，人工补绑12 / 12，路线关联186 / 186。", "complete"]
      };
      return presentations[state.status] || presentations.raw;
    }

    function spatialCollectionInfoMarkup() {
      const workflow = activeSpatialWorkflowState();
      if (spatialCollectionState.activeTab === "route") {
        return `<section class="spatial-info-card"><span>ROUTE / 踏勘路线</span><h3>${surveyRouteData.name}</h3><dl><div><dt>路线编号</dt><dd>${surveyRouteData.routeId}</dd></div><div><dt>起点</dt><dd>${workflow.visibleStopCount ? surveyRouteData.startPoint.name : "待识别"}</dd></div><div><dt>终点</dt><dd>${workflow.visibleStopCount ? surveyRouteData.endPoint.name : "待识别"}</dd></div><div><dt>关键节点</dt><dd>${workflow.visibleStopCount} / 8</dd></div><div><dt>关联照片</dt><dd>${workflow.routeLinkedCount} / 186</dd></div><div><dt>数据来源</dt><dd>Demo预置采集数据</dd></div><div><dt>当前状态</dt><dd>${workflow.routeStatus === "raw" ? "待清洗" : workflow.routeStatus === "cleaning" ? "清洗中" : workflow.routeLinkedCount === 186 ? "路线关联完成" : "路线已清洗"}</dd></div></dl><p>非真实GPS轨迹，不用于实际测绘或导航。</p></section><div class="spatial-stop-list">${surveyRouteData.keyStops.slice(0, workflow.visibleStopCount).map((stop) => `<button type="button" data-spatial-stop="${stop.stopId}" class="${spatialCollectionState.selectedStopId === stop.stopId ? "is-current" : ""}"><b>${stop.stopId}</b><span>${stop.note}</span><i>${stop.linkedPhotoCount}张</i></button>`).join("")}</div>`;
      }
      if (spatialCollectionState.activeTab === "binding") {
        const manual = photoLocationData.filter((photo) => photo.locationSource === "manual-bind");
        return `<section class="spatial-info-card spatial-demo-preset-card"><span>DEMO PRESET / 定位推演</span><h3>缺失定位治理</h3><dl><div><dt>原始缺失定位</dt><dd>12张</dd></div><div><dt>候选定位</dt><dd>${workflow.candidateLocationCount} / 12</dd></div><div><dt>已补绑</dt><dd>${workflow.manualBoundCount} / 12</dd></div><div><dt>待补绑</dt><dd>${12 - workflow.manualBoundCount}张</dd></div><div><dt>定位推演依据</dt><dd>项目边界、拍摄时间、前后顺序、相邻照片坐标、踏勘路线、关键节点、人工规则</dd></div></dl><p>Demo预置定位推演 · 所有候选点固定且可复现 · 非真实GPS自动定位</p></section><div class="spatial-binding-list">${manual.map((photo, index) => `<button type="button" data-spatial-photo="${photo.photoId}" class="${spatialCollectionState.selectedPhotoId === photo.photoId ? "is-current" : ""}" ${index >= workflow.candidateLocationCount ? "disabled" : ""}><b>${photo.photoId}</b><span>${index < workflow.candidateLocationCount ? `${photo.x.toFixed(2)}, ${photo.y.toFixed(2)}` : "缺失定位"}</span><i>${index < workflow.manualBoundCount ? "已补绑" : index < workflow.candidateLocationCount ? "候选定位" : "待定位"}</i></button>`).join("")}</div>`;
      }
      const photo = photoLocationData.find((item) => item.photoId === spatialCollectionState.selectedPhotoId) || photoLocationData[0];
      const manualIndex = photo.locationSource === "manual-bind" ? photo.routeOrder - 175 : -1;
      const photoStatus = manualIndex < 0 ? "已定位" : manualIndex < workflow.manualBoundCount ? "已补绑" : manualIndex < workflow.candidateLocationCount ? "候选定位" : "缺失定位";
      const photoSource = manualIndex < 0 ? "原始EXIF" : manualIndex < workflow.manualBoundCount ? "人工补绑" : manualIndex < workflow.candidateLocationCount ? "Demo自动定位建议" : "待定位";
      return `<section class="spatial-info-card"><span>PHOTO LOCATION / 照片定位</span><h3>${photo.photoId}</h3><dl><div><dt>拍摄时间</dt><dd>${photo.shotTime}</dd></div><div><dt>项目内相对坐标</dt><dd>${manualIndex >= workflow.candidateLocationCount ? "待定位" : `${photo.x.toFixed(2)}, ${photo.y.toFixed(2)}`}</dd></div><div><dt>定位来源</dt><dd>${photoSource}</dd></div><div><dt>定位状态</dt><dd>${photoStatus}</dd></div><div><dt>路线顺序</dt><dd>${photo.routeOrder} / 186</dd></div><div><dt>所属路线</dt><dd>${photo.routeId}</dd></div><div><dt>关键停留节点</dt><dd>${photo.keyStopId}</dd></div></dl><p>${manualIndex < 0 ? photo.note : "Demo预置定位推演 · 非真实GPS自动定位"}</p></section>`;
    }

    function renderSpatialCollectionMap() {
      const svg = $("#spatialCollectionSvg");
      if (!svg) return;
      const workflow = activeSpatialWorkflowState();
      const layer = spatialCollectionState.layers;
      const routePoints = surveyRouteData.routePoints.map((point) => `${point.x},${point.y}`).join(" ");
      const exifPhotos = layer.photos ? photoLocationData.slice(0, 174).map((photo) => `<circle class="spatial-photo-point is-exif ${photo.photoId === spatialCollectionState.selectedPhotoId ? "is-selected" : ""}" data-spatial-photo="${photo.photoId}" cx="${photo.x}" cy="${photo.y}" r="${photo.photoId === spatialCollectionState.selectedPhotoId ? 1.15 : .46}"/>`).join("") : "";
      const manualPhotos = layer.manual ? photoLocationData.slice(174, 174 + workflow.candidateLocationCount).map((photo, index) => `<circle class="spatial-photo-point ${index < workflow.manualBoundCount ? "is-manual is-bound" : "is-candidate"} ${photo.photoId === spatialCollectionState.selectedPhotoId ? "is-selected" : ""}" data-spatial-photo="${photo.photoId}" cx="${photo.x}" cy="${photo.y}" r="${photo.photoId === spatialCollectionState.selectedPhotoId ? 1.15 : .72}"/>`).join("") : "";
      const stops = layer.stops ? surveyRouteData.keyStops.slice(0, workflow.visibleStopCount).map((stop) => `<g class="spatial-stop ${stop.stopId === spatialCollectionState.selectedStopId ? "is-selected" : ""}" data-spatial-stop="${stop.stopId}"><circle cx="${stop.x}" cy="${stop.y}" r="1.45"/><text x="${stop.x + 1.7}" y="${stop.y - 1.1}">${stop.stopId.replace("STOP-", "S")}</text></g>`).join("") : "";
      const routeClass = workflow.routeStatus === "raw" ? "is-raw" : workflow.routeStatus === "cleaning" ? "is-cleaning" : "is-ready";
      const terminals = workflow.visibleStopCount ? `<g class="spatial-route-terminal" data-spatial-route-point="start"><circle class="is-start" cx="${surveyRouteData.startPoint.x}" cy="${surveyRouteData.startPoint.y}" r="1.8"/><text x="${surveyRouteData.startPoint.x + 2}" y="${surveyRouteData.startPoint.y - 2}">起点</text></g><g class="spatial-route-terminal" data-spatial-route-point="end"><circle class="is-end" cx="${surveyRouteData.endPoint.x}" cy="${surveyRouteData.endPoint.y}" r="1.8"/><text x="${surveyRouteData.endPoint.x + 2}" y="${surveyRouteData.endPoint.y + 3}">终点</text></g>` : "";
      svg.innerHTML = `${layer.boundary ? '<polygon class="spatial-boundary" points="9,74 15,50 30,25 55,18 82,32 91,61 80,86 49,92 23,84"/>' : ""}${layer.route ? `<polyline class="spatial-route ${routeClass}" points="${routePoints}"/>${terminals}` : ""}${exifPhotos}${manualPhotos}${stops}`;
      const map = $("#spatialCollectionMap");
      map.className = `spatial-collection-map ${spatialCollectionState.focused ? "is-route-focused" : ""} ${workflow.mapViewMode.startsWith("locate-group-") ? `is-${workflow.mapViewMode}` : ""}`.trim();
      $$('[data-spatial-layer]').forEach((button) => button.classList.toggle("is-on", spatialCollectionState.layers[button.dataset.spatialLayer]));
    }

    function renderSpatialCollectionView() {
      const workflow = activeSpatialWorkflowState();
      renderSpatialCollectionMap();
      $("#spatialCollectionInfo").innerHTML = spatialCollectionInfoMarkup();
      $$('[data-spatial-tab]').forEach((button) => button.classList.toggle("is-current", button.dataset.spatialTab === spatialCollectionState.activeTab));
      $("#spatialMissingCount").textContent = `${workflow.missingCount}张`;
      $("#spatialCandidateCount").textContent = `${workflow.candidateLocationCount} / 12`;
      $("#spatialLocatedCount").textContent = `${workflow.totalLocatedCount} / 186`;
      $("#spatialBoundCount").textContent = `${workflow.manualBoundCount} / 12`;
      $("#spatialStopCount").textContent = `${workflow.visibleStopCount} / 8`;
      $("#spatialRouteLinkedCount").textContent = `${workflow.routeLinkedCount} / 186`;
      $("#spatialWorkflowLocatedCount").textContent = `${workflow.totalLocatedCount} / 186`;
      $("#spatialWorkflowCandidateCount").textContent = `${workflow.candidateLocationCount} / 12`;
      $("#spatialWorkflowBoundCount").textContent = `${workflow.manualBoundCount} / 12`;
      const [status, message, activeStep] = spatialWorkflowPresentation(workflow);
      $("#spatialWorkflowStatus").textContent = status;
      $("#spatialWorkflowMessage").textContent = message;
      $$('[data-spatial-step]').forEach((step) => {
        const order = ["route", "locate", "bind", "link"];
        const activeIndex = activeStep === "complete" ? 4 : order.indexOf(activeStep);
        const index = order.indexOf(step.dataset.spatialStep);
        step.classList.toggle("is-current", index === activeIndex);
        step.classList.toggle("is-complete", index < activeIndex || activeStep === "complete");
      });
      const locating = ["route-cleaning", "locating"].includes(workflow.status) || workflow.timerIds.length > 0;
      const autoButton = $("#spatialAutoLocateButton");
      const bindButton = $("#spatialConfirmBindButton");
      autoButton.disabled = locating || !["raw", "route-ready"].includes(workflow.status) || spatialCollectionState.workflowSource === "demo";
      autoButton.textContent = workflow.status === "route-cleaning" ? "路线清洗中" : workflow.status === "locating" ? `自动定位 ${workflow.candidateLocationCount} / 12` : workflow.candidateLocationCount === 12 ? "候选定位已生成" : "自动定位缺失照片";
      bindButton.disabled = workflow.status !== "located-pending-bind" || spatialCollectionState.workflowSource === "demo";
      bindButton.textContent = workflow.status === "completed" ? "定位补绑已完成" : workflow.status === "binding" ? `确认补绑 ${workflow.manualBoundCount} / 12` : "确认并补绑12张";
    }

    function selectPhotoLocation(photoId) {
      if (!photoLocationData.some((photo) => photo.photoId === photoId)) return;
      spatialCollectionState.selectedPhotoId = photoId;
      spatialCollectionState.selectedStopId = null;
      spatialCollectionState.activeTab = "photo";
      renderSpatialCollectionView();
    }

    function selectSurveyStop(stopId) {
      const stop = surveyRouteData.keyStops.find((item) => item.stopId === stopId);
      if (!stop) return;
      spatialCollectionState.selectedStopId = stopId;
      spatialCollectionState.activeTab = "route";
      renderSpatialCollectionView();
    }

    function resetSpatialCollectionView(options = {}) {
      if (options.resetWorkflow !== false) {
        resetSpatialWorkflowState(manualSpatialCollectionState);
        resetSpatialWorkflowState(demoSpatialCollectionState);
      }
      spatialCollectionState.view = "governance";
      spatialCollectionState.workflowSource = "manual";
      spatialCollectionState.activeTab = "photo";
      spatialCollectionState.selectedPhotoId = photoLocationData[0].photoId;
      spatialCollectionState.selectedStopId = null;
      spatialCollectionState.selectedRoutePoint = null;
      spatialCollectionState.layers = { boundary: true, route: true, photos: true, manual: true, stops: true };
      spatialCollectionState.focused = false;
      if (options.render !== false) setSpatialCollectionView("governance");
    }

    function renderModule(index) {
      const module = modules[index];
      const project = projectById(appState.activeProjectId);
      const projectContext = $("#moduleProjectContext");
      moduleDrawer.classList.toggle("is-indicator-module", index === 4);
      moduleDrawer.classList.toggle("is-report-module", index === 5);
      moduleDrawer.classList.toggle("is-stage-module", index >= 0 && index <= 3);
      moduleDrawer.dataset.stage = module.number;
      $("#moduleNumber").textContent = "MODULE / " + module.number;
      $("#moduleTitle").textContent = module.title;
      $("#moduleGoal").textContent = module.goal;
      $("#moduleInput").textContent = module.input;
      $("#moduleProcess").textContent = module.process;
      $("#moduleOutput").textContent = module.output;
      projectContext.hidden = index !== 0 || !project;
      projectContext.textContent = project ? `当前项目 / ${project.name}` : "";
      $("#moduleEnterButton").hidden = !module.available;
      $("#moduleDevelopmentNote").hidden = module.available;
      renderStageDrawerSummary(index);
      $("#moduleEnterLabel").textContent = index === 0 ? "进入资料治理工作台" : index === 1 ? "进入AI识别工作台" : index === 2 ? "进入人工复核工作台" : index === 3 ? "进入GIS工作台" : index === 4 ? "进入指标核算" : "进入报告生成工作台";
    }

    function stageNavigationGroups() {
      return [
        { nodes: moduleRailButtons, rail: true },
        { nodes: flowButtons, rail: false },
        { nodes: $$(".ai-recognition-flow-step"), rail: false },
        { nodes: $$(".human-review-flow-step"), rail: false },
        { nodes: $$(".gis-flow-step"), rail: false },
        { nodes: $$(".indicator-flow-step"), rail: false },
        { nodes: $$(".report-flow-step"), rail: false }
      ];
    }

    function renderStageNavigation() {
      stageNavigationGroups().forEach(({ nodes, rail }) => nodes.forEach((node, index) => {
        const standaloneReportComplete = index === 5 && ["completed", "stale"].includes(reportGenerationState.status) && demo.state === "idle";
        const complete = index <= appState.workflowCompletedThrough || standaloneReportComplete;
        const workflowFocus = index === appState.workflowCurrentStage;
        const current = workflowFocus && !appState.workflowNextOnly;
        const next = workflowFocus && appState.workflowNextOnly;
        node.classList.toggle("is-complete", complete);
        node.classList.toggle("human-review-is-complete", complete);
        node.classList.toggle("is-current", current);
        node.classList.toggle("is-next", next);
        node.classList.toggle("human-review-is-next", next);
        node.classList.toggle("is-active", rail && workflowFocus);
        node.classList.toggle("is-viewing", index === appState.activeViewStage);
        const label = $("i", node);
        if (label) label.textContent = complete ? "已完成" : current ? "当前阶段" : "未开始";
      }));
      if (appState.activeDrawerStage !== null) renderStageDrawerSummary(appState.activeDrawerStage);
      syncDebug();
    }

    function setWorkflowStage(currentStage, completedThrough, nextOnly) {
      appState.workflowCurrentStage = Number.isInteger(currentStage) ? clamp(currentStage, 0, 5) : null;
      appState.workflowCompletedThrough = clamp(completedThrough, -1, 5);
      appState.workflowNextOnly = Boolean(nextOnly);
      renderStageNavigation();
    }

    async function closeAllStageWorkspaces() {
      if (appState.workspaceOpen) await closeWorkspace();
      if (appState.aiRecognitionWorkspaceOpen) await closeAIRecognitionWorkspace();
      if (appState.humanReviewWorkspaceOpen) await closeHumanReviewWorkspace();
      if (appState.gisWorkspaceOpen) await closeGISWorkspace();
      if (appState.indicatorWorkspaceOpen) await closeIndicatorWorkspace();
      if (appState.reportWorkspaceOpen) await closeReportWorkspace();
    }

    let stageNavigationPromise = Promise.resolve();
    let pendingStageNavigation = null;

    function openStageDrawer(stageId, options) {
      const stageIndex = Number(stageId);
      if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 5) return Promise.resolve(false);
      if (appState.indicatorWorkspaceOpen) resetIndicatorScenario({ render:false });
      appState.activeViewStage = stageIndex;
      appState.activeDrawerStage = stageIndex;
      appState.activeWorkspaceStage = null;
      return closeAllStageWorkspaces().then(() => openModule(stageIndex)).then(() => { renderStageNavigation(); return true; });
    }

    function openStageWorkspace(stageId, options) {
      const stageIndex = Number(stageId);
      if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 5) return Promise.resolve(false);
      if (!(options && options.automated)) manualAction();
      appState.activeViewStage = stageIndex;
      appState.activeDrawerStage = null;
      appState.activeWorkspaceStage = stageIndex;
      if (stageIndex === 0 && appState.workflowCurrentStage === null) setWorkflowStage(0, -1, false);
      if (stageIndex === 0) return openWorkspace();
      if (stageIndex === 1) return openAIRecognitionWorkspace();
      if (stageIndex === 2) return openHumanReviewWorkspace();
      if (stageIndex === 3) return openGISWorkspace();
      if (stageIndex === 4) return openIndicatorWorkspace();
      return openReportWorkspace();
    }

    function navigateToStage(stageId, options) {
      const stageIndex = Number(stageId);
      if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex > 5) return Promise.resolve(false);
      const automated = Boolean(options && options.automated);
      if (!automated) manualAction();
      if (appState.humanReviewWorkspaceOpen && humanReviewState.dirty && !automated && !(options && options.skipDirtyGuard)) {
        humanReviewRequestNavigation(() => navigateToStage(stageIndex, { skipDirtyGuard: true }), "切换阶段将放弃当前未保存修改。");
        return Promise.resolve(false);
      }
      if (appState.stageNavigationInFlight) {
        pendingStageNavigation = stageIndex;
        return stageNavigationPromise;
      }
      appState.stageNavigationInFlight = true;
      appState.activeViewStage = stageIndex;
      appStage.classList.add("is-stage-switching");
      stageNavigationPromise = (async () => {
        try {
          await openStageDrawer(stageIndex, { automated });
          renderStageNavigation();
          await nextPaint();
          return true;
        } finally {
          appStage.classList.remove("is-stage-switching");
          appState.stageNavigationInFlight = false;
          const pending = pendingStageNavigation;
          pendingStageNavigation = null;
          if (pending !== null && pending !== stageIndex) navigateToStage(pending, { automated });
        }
      })();
      return stageNavigationPromise;
    }

    function openNextStageDrawer(currentStageId, options) {
      const current = Number(currentStageId);
      const next = current + 1;
      if (!Number.isInteger(current) || current < 0 || next > 5) return Promise.resolve(false);
      const automated = Boolean(options && options.automated);
      if (!automated) manualAction();
      if (current === 2 && appState.humanReviewWorkspaceOpen && humanReviewState.dirty && !automated && !(options && options.skipDirtyGuard)) {
        humanReviewRequestNavigation(() => openNextStageDrawer(current, { automated: false, skipDirtyGuard: true }), "进入下一阶段说明将放弃当前未保存修改。");
        return Promise.resolve(false);
      }
      return openStageDrawer(next, { source: "workspace-next", automated });
    }

    function bindUnifiedStageNavigation() {
      stageNavigationGroups().forEach(({ nodes }) => nodes.forEach((node, index) => {
        if (node.dataset.stageNavigationBound === "true") return;
        node.dataset.stageNavigationBound = "true";
        node.setAttribute("role", "button");
        if (node.tagName !== "BUTTON") node.tabIndex = 0;
        node.addEventListener("click", () => navigateToStage(index));
        if (node.tagName !== "BUTTON") node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigateToStage(index); }
        });
      }));
    }

    function completeReturnToMap(message) {
      appState.activeViewStage = null;
      appState.activeDrawerStage = null;
      appState.activeWorkspaceStage = null;
      resetCityMapFocus({ closeDetail: false, interactionSource: "workspace-return" });
      renderStageNavigation();
      if (message) showToast(message);
    }

    function switchModuleContent(index) {
      if (appState.activeModuleIndex === index) return Promise.resolve();
      if (motion.right.contentState === "switching") return motion.right.contentPromise;
      motion.right.contentState = "switching";
      motion.right.contentPromise = (async () => {
        moduleDrawer.classList.remove("is-content-entering", "is-settled");
        moduleDrawer.classList.add("is-content-leaving");
        await waitForVisualEnd($(".module-goal", moduleDrawer), { property: "opacity" });
        if (motion.right.state !== "open") return;
        appState.activeModuleIndex = index;
        renderModule(index);
        moduleDrawer.classList.remove("is-content-leaving");
        moduleDrawer.classList.add("is-content-entering");
        await waitForVisualEnd($("header", moduleDrawer), { kind: "animation" });
        moduleDrawer.classList.remove("is-content-entering");
        moduleDrawer.classList.add("is-settled");
        motion.right.contentState = "idle";
        syncMotionDebug("right-content-complete");
        syncDebug();
      })().finally(() => {
        motion.right.contentState = "idle";
      });
      return motion.right.contentPromise;
    }

    function openModule(index) {
      if (!modules[index]) return Promise.resolve();
      if (appState.indicatorWorkspaceOpen) {
        showToast(index === 4 ? "当前正在使用指标核算工作台" : "请使用顶部阶段条直接切换其他模块", "warning", 2400);
        return Promise.resolve();
      }
      if (appState.gisWorkspaceOpen) {
        showToast(index === 3 ? "当前正在使用GIS落图工作台" : "请先返回地图，再切换其他模块", "warning", 2400);
        return Promise.resolve();
      }
      if (appState.humanReviewWorkspaceOpen) {
        showToast(index === 2 ? "当前正在使用人工复核工作台" : "请先返回地图，再切换其他模块", "warning", 2400);
        return Promise.resolve();
      }
      if (appState.aiRecognitionWorkspaceOpen) {
        if (index === 2) return closeAIRecognitionWorkspace().then(openHumanReviewWorkspace);
        showToast(index === 1 ? "当前正在使用AI智能识别工作台" : "请先返回地图，再切换其他模块", "warning", 2400);
        return Promise.resolve();
      }
      if (appState.workspaceOpen) {
        if (index === 2) return closeWorkspace().then(openHumanReviewWorkspace);
        appState.activeModuleIndex = index;
        renderModule(index);
        if (index > 0) highlightNextStage(index);
        else {
          setFlowState(0);
          showToast("当前正在使用资料上传与治理工作台");
        }
        syncDebug();
        return Promise.resolve();
      }
      appState.activeViewStage = index;
      appState.activeDrawerStage = index;
      appState.activeWorkspaceStage = null;
      renderStageNavigation();
      if (motion.right.state === "open") return switchModuleContent(index);
      if (motion.right.state === "opening") return motion.right.promise;
      if (motion.right.state === "closing") return motion.right.promise.then(() => openModule(index));

      const token = ++motion.right.token;
      motion.right.state = "opening";
      syncMotionDebug();
      motion.right.promise = (async () => {
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (token !== motion.right.token) return;
        appState.activeModuleIndex = index;
        renderModule(index);
        appState.rightDrawerOpen = true;
        moduleDrawer.classList.remove("is-closing", "is-settled", "is-content-leaving", "is-content-entering");
        moduleDrawer.classList.add("is-opening");
        moduleDrawer.setAttribute("aria-hidden", "false");
        setBackdrop("open");
        await nextPaint();
        if (token !== motion.right.token) return;
        moduleDrawer.classList.add("is-open");
        const lastContent = modules[index].available ? $("#moduleEnterButton") : $("#moduleDevelopmentNote");
        await Promise.all([
          waitForVisualEnd(moduleDrawer, { property: "transform" }),
          waitForVisualEnd(lastContent, { property: "opacity" })
        ]);
        if (token !== motion.right.token) return;
        moduleDrawer.classList.remove("is-opening");
        moduleDrawer.classList.add("is-settled");
        motion.right.state = "open";
        syncMotionDebug("right-open-complete");
        syncDebug();
      })();
      return motion.right.promise;
    }

    function closeRightDrawer(options) {
      const keepBackdrop = Boolean(options && options.keepBackdrop);
      if (motion.right.state === "closed") return Promise.resolve();
      if (motion.right.state === "closing") return motion.right.promise;
      if (motion.right.state === "opening") return motion.right.promise.then(() => closeRightDrawer(options));
      if (motion.right.contentState === "switching") return motion.right.contentPromise.then(() => closeRightDrawer(options));

      const token = ++motion.right.token;
      motion.right.state = "closing";
      syncMotionDebug();
      motion.right.promise = (async () => {
        moduleDrawer.classList.remove("is-settled", "is-opening", "is-content-leaving", "is-content-entering");
        moduleDrawer.classList.add("is-closing");
        if (!keepBackdrop) setBackdrop("closing");
        await nextPaint();
        if (token !== motion.right.token) return;
        moduleDrawer.classList.remove("is-open");
        await waitForVisualEnd(moduleDrawer, { property: "transform" });
        if (token !== motion.right.token) return;
        moduleDrawer.classList.remove("is-closing");
        moduleDrawer.setAttribute("aria-hidden", "true");
        appState.rightDrawerOpen = false;
        appState.activeDrawerStage = null;
        if (appState.activeWorkspaceStage === null) appState.activeViewStage = null;
        if (!appState.workspaceOpen) appState.activeModuleIndex = null;
        renderStageNavigation();
        motion.right.state = "closed";
        if (!keepBackdrop) setBackdrop("closed");
        syncMotionDebug("right-close-complete");
        syncDebug();
      })();
      return motion.right.promise;
    }

    function openWorkspace() {
      if (appState.gisWorkspaceOpen) return closeGISWorkspace().then(openWorkspace);
      if (appState.humanReviewWorkspaceOpen) return closeHumanReviewWorkspace().then(openWorkspace);
      if (appState.aiRecognitionWorkspaceOpen) return closeAIRecognitionWorkspace().then(openWorkspace);
      if (motion.workspace.state === "open" || motion.workspace.state === "opening") return motion.workspace.promise;
      if (motion.workspace.state === "closing") return motion.workspace.promise.then(openWorkspace);
      if (!appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      const token = ++motion.workspace.token;
      motion.workspace.state = "opening";
      syncMotionDebug();
      motion.workspace.promise = (async () => {
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.workspace.token) return;
        setBackdrop("closed");
        appState.workspaceOpen = true;
        appState.activeModuleIndex = 0;
        appState.activeViewStage = 0;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = 0;
        appState.rightDrawerOpen = false;
        workspaceShell.classList.remove("is-closing", "is-settled");
        workspaceShell.classList.add("is-opening");
        workspaceShell.setAttribute("aria-hidden", "false");
        renderModule(0);
        setSpatialCollectionView(spatialCollectionState.view);
        renderStageNavigation();
        await nextPaint();
        if (token !== motion.workspace.token) return;
        appStage.classList.add("is-workspace");
        await waitForVisualEnd(workspaceShell, { property: "transform" });
        if (token !== motion.workspace.token) return;
        workspaceShell.classList.remove("is-opening");
        workspaceShell.classList.add("is-settled");
        motion.workspace.state = "open";
        syncMotionDebug("workspace-open-complete");
        syncDebug();
      })();
      return motion.workspace.promise;
    }

    function closeWorkspace() {
      if (motion.workspace.state === "closed") return Promise.resolve();
      if (motion.workspace.state === "closing") return motion.workspace.promise;
      if (motion.workspace.state === "opening") return motion.workspace.promise.then(closeWorkspace);
      const token = ++motion.workspace.token;
      motion.workspace.state = "closing";
      syncMotionDebug();
      motion.workspace.promise = (async () => {
        workspaceShell.classList.remove("is-settled", "is-opening");
        workspaceShell.classList.add("is-closing");
        appStage.classList.remove("is-workspace");
        await waitForVisualEnd(workspaceShell, { property: "transform" });
        if (token !== motion.workspace.token) return;
        workspaceShell.classList.remove("is-closing");
        workspaceShell.setAttribute("aria-hidden", "true");
        appState.workspaceOpen = false;
        if (appState.activeWorkspaceStage === 0) appState.activeWorkspaceStage = null;
        appState.activeModuleIndex = null;
        moduleRailButtons.forEach((button) => button.classList.remove("is-active"));
        renderStageNavigation();
        motion.workspace.state = "closed";
        syncMotionDebug("workspace-close-complete");
        syncDebug();
      })();
      return motion.workspace.promise;
    }

    function setAIRecognitionRailState(isOpen) {
      if (!isOpen) {
        renderStageNavigation();
        return;
      }
      moduleRailButtons.forEach((button, index) => {
        button.classList.toggle("is-active", index === 1);
        button.classList.toggle("is-complete", index === 0);
        const label = $("i", button);
        if (index === 0) label.textContent = "已完成";
        else if (index === 1) label.textContent = "当前阶段";
        else label.textContent = "未开始";
      });
      renderStageNavigation();
    }

    function openAIRecognitionWorkspace() {
      if (motion.aiRecognition.state === "open" || motion.aiRecognition.state === "opening") return motion.aiRecognition.promise;
      if (motion.aiRecognition.state === "closing") return motion.aiRecognition.promise.then(openAIRecognitionWorkspace);
      if (!appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      const token = ++motion.aiRecognition.token;
      motion.aiRecognition.state = "opening";
      syncMotionDebug();
      motion.aiRecognition.promise = (async () => {
        if (appState.gisWorkspaceOpen) await closeGISWorkspace();
        if (appState.humanReviewWorkspaceOpen) await closeHumanReviewWorkspace();
        if (appState.workspaceOpen) await closeWorkspace();
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.aiRecognition.token) return;
        setBackdrop("closed");
        appState.aiRecognitionWorkspaceOpen = true;
        appState.activeModuleIndex = 1;
        appState.activeViewStage = 1;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = 1;
        appState.rightDrawerOpen = false;
        const project = cityProjects.find((item) => item.id === appState.activeProjectId) || cityProjects[0];
        $("#aiRecognitionProjectName").textContent = project.name;
        aiRecognitionWorkspace.classList.remove("is-closing", "is-settled");
        aiRecognitionWorkspace.classList.add("is-opening");
        aiRecognitionWorkspace.setAttribute("aria-hidden", "false");
        setAIRecognitionRailState(true);
        await nextPaint();
        if (token !== motion.aiRecognition.token) return;
        appStage.classList.add("ai-recognition-workspace-active");
        aiRecognitionWorkspace.classList.add("is-open");
        await waitForVisualEnd(aiRecognitionWorkspace, { property: "transform" });
        if (token !== motion.aiRecognition.token) return;
        aiRecognitionWorkspace.classList.remove("is-opening");
        aiRecognitionWorkspace.classList.add("is-settled");
        motion.aiRecognition.state = "open";
        renderAIRecognitionMedia();
        renderAIRecognitionProgress(aiRecognitionState.progress, { status: aiRecognitionState.status, force: true });
        fitAIRecognitionMedia();
        syncMotionDebug("ai-recognition-open-complete");
        syncDebug();
      })();
      return motion.aiRecognition.promise;
    }

    function closeAIRecognitionWorkspace() {
      if (motion.aiRecognition.state === "closed") return Promise.resolve();
      if (motion.aiRecognition.state === "closing") return motion.aiRecognition.promise;
      if (motion.aiRecognition.state === "opening") return motion.aiRecognition.promise.then(closeAIRecognitionWorkspace);
      const token = ++motion.aiRecognition.token;
      motion.aiRecognition.state = "closing";
      if (aiRecognitionState.status === "playing" && aiRecognitionState.source === "manual") pauseAIRecognitionRun();
      syncMotionDebug();
      motion.aiRecognition.promise = (async () => {
        aiRecognitionWorkspace.classList.remove("is-settled", "is-opening");
        aiRecognitionWorkspace.classList.add("is-closing");
        appStage.classList.remove("ai-recognition-workspace-active");
        await nextPaint();
        aiRecognitionWorkspace.classList.remove("is-open");
        await waitForVisualEnd(aiRecognitionWorkspace, { property: "transform" });
        if (token !== motion.aiRecognition.token) return;
        aiRecognitionWorkspace.classList.remove("is-closing");
        aiRecognitionWorkspace.setAttribute("aria-hidden", "true");
        appState.aiRecognitionWorkspaceOpen = false;
        if (appState.activeWorkspaceStage === 1) appState.activeWorkspaceStage = null;
        appState.activeModuleIndex = null;
        setAIRecognitionRailState(false);
        motion.aiRecognition.state = "closed";
        syncMotionDebug("ai-recognition-close-complete");
        syncDebug();
      })();
      return motion.aiRecognition.promise;
    }

    function humanReviewTaskById(taskId) {
      return humanReviewState.tasks.find((task) => task.taskId === taskId) || null;
    }

    function humanReviewVisibleTasks() {
      if (humanReviewState.riskFilter === "all") return humanReviewState.tasks.slice();
      return humanReviewState.tasks.filter((task) => task.issue.severity === humanReviewState.riskFilter);
    }

    function humanReviewSeverityLabel(severity) {
      return severity === "high" ? "高风险" : severity === "medium" ? "中风险" : "一般问题";
    }

    function humanReviewStatusMeta(status) {
      const labels = { pending: "待复核", confirmed: "已确认", modified: "已修改", excluded: "已排除" };
      return { label: labels[status] || "待复核", className: status === "pending" ? "" : "human-review-is-" + status };
    }

    function humanReviewActionLabel(action) {
      return action === "confirm" ? "确认问题" : action === "modify" ? "修改问题" : action === "exclude" ? "排除误报" : "未选择";
    }

    function humanReviewFilterLabel(filter) {
      return filter === "high" ? "高风险" : filter === "medium" ? "中风险" : filter === "general" ? "一般问题" : "全部任务";
    }

    function humanReviewFitMedia() {
      if (!humanReviewMainImage || !humanReviewMediaViewport || !humanReviewMediaFrame) return;
      if (!appState.humanReviewWorkspaceOpen || !humanReviewMainImage.naturalWidth || !humanReviewMainImage.naturalHeight) return;
      const width = humanReviewMediaViewport.clientWidth;
      const height = humanReviewMediaViewport.clientHeight;
      if (!width || !height) return;
      const scale = Math.min(width / humanReviewMainImage.naturalWidth, height / humanReviewMainImage.naturalHeight);
      humanReviewMediaFrame.style.width = Math.max(1, humanReviewMainImage.naturalWidth * scale) + "px";
      humanReviewMediaFrame.style.height = Math.max(1, humanReviewMainImage.naturalHeight * scale) + "px";
    }

    function humanReviewDraftFor(task) {
      if (task.draft) return task.draft;
      const source = task.result || {};
      task.draft = {
        action: source.action || null,
        type: source.type || task.issue.type,
        severity: source.severity || task.issue.severity,
        indicator: source.indicator || task.issue.suggestedIndicator,
        opinion: source.opinion || "",
        exclusionReason: source.exclusionReason || ""
      };
      return task.draft;
    }

    function humanReviewSetSessionMessage(copy) {
      humanReviewState.sessionMessage = copy;
      humanReviewRenderLogList();
    }

    function humanReviewSetPanel(name, open) {
      const button = $(`[data-human-review-toggle="${name}"]`);
      const panel = $(`[data-human-review-panel="${name}"]`);
      if (!button || !panel) return;
      panel.hidden = !open;
      button.classList.toggle("human-review-is-expanded", open);
      const icon = $("i", button);
      if (icon) icon.textContent = open ? "－" : "＋";
    }

    function humanReviewRenderTaskList() {
      const visibleTasks = humanReviewVisibleTasks();
      const list = $("#humanReviewTaskList");
      list.classList.toggle("human-review-is-filtered", visibleTasks.length !== humanReviewState.tasks.length);
      if (!visibleTasks.length) {
        const empty = document.createElement("p");
        empty.className = "human-review-empty";
        empty.textContent = "当前筛选下无重点复核任务";
        list.replaceChildren(empty);
        return;
      }
      const fragment = document.createDocumentFragment();
      visibleTasks.forEach((task) => {
        const status = humanReviewStatusMeta(task.status);
        const displayType = task.result ? task.result.type : task.issue.type;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "human-review-task";
        button.classList.toggle("is-current", task.taskId === humanReviewState.selectedTaskId);
        button.dataset.humanReviewTask = task.taskId;
        button.innerHTML = `<img src="${task.image.file}" alt="${task.image.alt}"><strong>${task.taskId}</strong><em class="${status.className}">${status.label}</em><span>${displayType}</span><b class="is-${task.issue.severity}">${humanReviewSeverityLabel(task.issue.severity)}</b><small>${task.image.id} · ${task.issue.confidence.toFixed(1)}%</small>`;
        button.addEventListener("click", () => {
          manualAction();
          humanReviewSelectTask(task.taskId);
        });
        fragment.appendChild(button);
      });
      list.replaceChildren(fragment);
    }

    function humanReviewRenderEditors(task) {
      const draft = humanReviewDraftFor(task);
      $$('[data-human-review-decision]').forEach((button) => button.classList.toggle("is-selected", button.dataset.humanReviewDecision === draft.action));
      $$('input[name="humanReviewRisk"]').forEach((input) => { input.checked = draft.severity === input.value; });
      $("#humanReviewTypeInput").value = draft.type;
      $("#humanReviewIndicatorInput").value = draft.indicator;
      $("#humanReviewOpinionInput").value = draft.opinion;
      $("#humanReviewExclusionReason").value = draft.exclusionReason;
      const exclusionItem = $("#humanReviewExclusionItem");
      exclusionItem.hidden = draft.action !== "exclude";
      if (draft.action === "exclude") humanReviewSetPanel("exclusion", true);
      $("#humanReviewSaveButton").disabled = !draft.action || humanReviewState.completed;
    }

    function humanReviewRenderCurrent() {
      const task = humanReviewTaskById(humanReviewState.selectedTaskId) || humanReviewState.tasks[0];
      humanReviewState.selectedTaskId = task.taskId;
      const visibleTasks = humanReviewVisibleTasks();
      const visualIndex = visibleTasks.findIndex((item) => item.taskId === task.taskId);
      const display = task.result || task.issue;
      humanReviewMainImage.src = task.image.file;
      humanReviewMainImage.alt = task.image.alt;
      $("#humanReviewImageId").textContent = task.image.id;
      $("#humanReviewIssueMeta").textContent = task.taskId + " · " + display.type;
      $("#humanReviewBoxLabel").textContent = task.taskId + " · " + display.type;
      const box = $("#humanReviewCurrentBox");
      box.className = "human-review-box is-selected is-" + display.severity;
      box.style.left = task.issue.bbox.x + "%";
      box.style.top = task.issue.bbox.y + "%";
      box.style.width = task.issue.bbox.width + "%";
      box.style.height = task.issue.bbox.height + "%";
      $("#humanReviewIssueType").textContent = display.type;
      $("#humanReviewIssueDescription").textContent = task.issue.description;
      const severity = $("#humanReviewSeverity");
      severity.textContent = humanReviewSeverityLabel(display.severity);
      severity.className = "is-" + display.severity;
      $("#humanReviewConfidence").textContent = task.issue.confidence.toFixed(1) + "%";
      $("#humanReviewIndicator").textContent = display.indicator || task.issue.suggestedIndicator;
      $("#humanReviewTraceImage").textContent = task.image.id;
      $("#humanReviewTraceIssue").textContent = task.taskId;
      $("#humanReviewTraceAction").textContent = task.result ? humanReviewActionLabel(task.result.action) : "待人工复核";
      $("#humanReviewTraceMap").textContent = "MAP-" + task.taskId.slice(-3);
      const positionCopy = visibleTasks.length && visualIndex >= 0 ? (visualIndex + 1) + " / " + visibleTasks.length : "0 / " + visibleTasks.length;
      $("#humanReviewProgress").textContent = positionCopy + " · " + humanReviewFilterLabel(humanReviewState.riskFilter);
      $("#humanReviewProgressBar").style.width = visibleTasks.length && visualIndex >= 0 ? ((visualIndex + 1) / visibleTasks.length * 100) + "%" : "0%";
      $("#humanReviewZoomPlaceholder").hidden = true;
      humanReviewRenderEditors(task);
      humanReviewRenderTaskList();
      requestAnimationFrame(humanReviewFitMedia);
      window.__humanReviewBetaDebug.selectedTaskId = task.taskId;
    }

    function humanReviewRenderStats() {
      const stats = humanReviewCalculateStats(humanReviewState);
      $("#humanReviewReviewedCount").textContent = stats.reviewed + " / 43";
      $("#humanReviewPriorityProgress").textContent = stats.priorityCompleted + " / 7";
      $("#humanReviewPendingCount").textContent = String(stats.pending);
      $("#humanReviewOverallStatus").textContent = humanReviewState.completed ? "人工复核已完成" : stats.pending ? "重点任务待人工复核" : "重点任务已复核，等待完成确认";
      $("#humanReviewGisStatus").textContent = humanReviewState.completed ? "待GIS落图" : "未入库";
      const completeButton = $("#humanReviewCompleteButton");
      const saveButton = $("#humanReviewSaveButton");
      completeButton.disabled = stats.priorityCompleted < 7 || humanReviewState.completed;
      completeButton.classList.toggle("human-review-is-misaligned", stats.priorityCompleted === 7 && !humanReviewPresetAligned(humanReviewState));
      $("#humanReviewCompletion").hidden = !humanReviewState.completed;
      saveButton.classList.toggle("is-complete", humanReviewState.completed);
      $("span", saveButton).textContent = humanReviewState.completed ? "人工复核已完成" : "保存当前复核";
      $("small", saveButton).textContent = humanReviewState.completed ? "43 / 43 已复核 · 不重复写入结果" : "保存后写入任务状态与追溯日志";
      saveButton.disabled = humanReviewState.completed || saveButton.disabled;
      $("#humanReviewFinalEffective").textContent = stats.effective === null ? "—" : String(stats.effective);
      $("#humanReviewFinalExcluded").textContent = String(stats.excluded);
      $("#humanReviewFinalHigh").textContent = String(stats.risk.high);
      $("#humanReviewFinalMedium").textContent = String(stats.risk.medium);
      $("#humanReviewFinalGeneral").textContent = String(stats.risk.general);
      window.__humanReviewBetaDebug.reviewed = stats.reviewed;
      window.__humanReviewBetaDebug.pending = stats.pending;
      window.__humanReviewBetaDebug.excluded = stats.excluded;
      window.__humanReviewBetaDebug.formalResultCount = humanReviewState.completed ? stats.effective : null;
      window.__humanReviewBetaDebug.completed = humanReviewState.completed;
      window.__humanReviewBetaDebug.presetAligned = humanReviewPresetAligned(humanReviewState);
    }

    function humanReviewRenderLogList() {
      const list = $("#humanReviewLogList");
      const fragment = document.createDocumentFragment();
      const session = document.createElement("article");
      session.innerHTML = `<i></i><div><b id="humanReviewTraceTask">${humanReviewState.selectedTaskId}</b><span id="humanReviewTraceCopy">${humanReviewState.sessionMessage || "任务已载入，等待人工操作"}</span></div><time>当前会话</time>`;
      fragment.appendChild(session);
      humanReviewState.logs.slice().reverse().forEach((log) => {
        const row = document.createElement("article");
        row.classList.toggle("human-review-is-system", Boolean(log.system));
        row.title = `${log.operator}｜${log.taskId}｜原始：${log.originalAI.type}/${humanReviewSeverityLabel(log.originalAI.severity)}｜操作：${log.action}｜修改前：${log.before.type}/${humanReviewSeverityLabel(log.before.severity)}｜修改后：${log.after.type}/${humanReviewSeverityLabel(log.after.severity)}｜${log.note || "无复核意见"}｜${log.status}`;
        row.innerHTML = `<i></i><div><b>${log.taskId}</b><span>${log.action} · ${log.status}</span></div><time>${log.time}</time>`;
        fragment.appendChild(row);
      });
      list.replaceChildren(fragment);
      $("#humanReviewLogCount").textContent = humanReviewState.logs.length + " RECORDS";
    }

    function humanReviewRenderAll() {
      if (!humanReviewWorkspace) return false;
      humanReviewRenderCurrent();
      humanReviewRenderStats();
      humanReviewRenderLogList();
      humanReviewSetRailState(appState.humanReviewWorkspaceOpen);
      return true;
    }

    function humanReviewDiscardCurrentDraft() {
      const task = humanReviewTaskById(humanReviewState.selectedTaskId);
      if (task) task.draft = null;
      humanReviewState.dirty = false;
      humanReviewState.sessionMessage = "未保存修改已放弃";
      humanReviewRenderAll();
    }

    function humanReviewRequestNavigation(action, detail) {
      if (!humanReviewState.dirty) {
        action();
        return;
      }
      humanReviewState.pendingNavigation = action;
      $("#humanReviewUnsavedDetail").textContent = detail || "继续将丢弃当前任务草稿。";
      $("#humanReviewUnsavedPrompt").hidden = false;
    }

    function humanReviewResolveNavigation(discard) {
      const action = humanReviewState.pendingNavigation;
      humanReviewState.pendingNavigation = null;
      $("#humanReviewUnsavedPrompt").hidden = true;
      if (!discard || !action) return;
      humanReviewDiscardCurrentDraft();
      action();
    }

    function humanReviewSelectTask(taskId, options) {
      if (!humanReviewTaskById(taskId) || taskId === humanReviewState.selectedTaskId) return;
      const select = () => {
        humanReviewState.selectedTaskId = taskId;
        humanReviewState.sessionMessage = "任务已载入，等待人工操作";
        humanReviewRenderAll();
      };
      if (options && options.force) select();
      else humanReviewRequestNavigation(select, "切换任务将丢弃当前未保存修改。");
    }

    function humanReviewStepTask(direction) {
      const visibleTasks = humanReviewVisibleTasks();
      if (!visibleTasks.length) return;
      const currentIndex = Math.max(0, visibleTasks.findIndex((task) => task.taskId === humanReviewState.selectedTaskId));
      const nextIndex = (currentIndex + direction + visibleTasks.length) % visibleTasks.length;
      humanReviewSelectTask(visibleTasks[nextIndex].taskId);
    }

    function humanReviewSetRiskFilter(filter) {
      const apply = () => {
        humanReviewState.riskFilter = filter;
        $$('[data-human-review-risk]').forEach((button) => button.classList.toggle("is-current", button.dataset.humanReviewRisk === filter));
        const visibleTasks = humanReviewVisibleTasks();
        if (visibleTasks.length && !visibleTasks.some((task) => task.taskId === humanReviewState.selectedTaskId)) humanReviewState.selectedTaskId = visibleTasks[0].taskId;
        humanReviewState.sessionMessage = visibleTasks.length ? "已切换风险筛选" : "当前筛选下无重点复核任务";
        humanReviewRenderAll();
      };
      humanReviewRequestNavigation(apply, "切换筛选将丢弃当前未保存修改。");
    }

    function humanReviewSetMode(mode) {
      humanReviewState.mode = mode === "original" ? "original" : "result";
      humanReviewWorkspace.classList.toggle("is-original-mode", humanReviewState.mode === "original");
      $$('[data-human-review-mode]').forEach((button) => button.classList.toggle("is-current", button.dataset.humanReviewMode === humanReviewState.mode));
      humanReviewSetSessionMessage(humanReviewState.mode === "original" ? "已切换原图" : "已切换AI识别结果");
    }

    function humanReviewUpdateDraft(patch, message) {
      const task = humanReviewTaskById(humanReviewState.selectedTaskId);
      if (!task || humanReviewState.completed) return;
      Object.assign(humanReviewDraftFor(task), patch);
      humanReviewState.dirty = true;
      humanReviewState.sessionMessage = message || "当前修改尚未保存";
      $("#humanReviewSaveButton").disabled = !task.draft.action;
      humanReviewRenderLogList();
    }

    function humanReviewSelectDecision(action) {
      const task = humanReviewTaskById(humanReviewState.selectedTaskId);
      if (!task || humanReviewState.completed) return;
      const draft = humanReviewDraftFor(task);
      draft.action = action;
      if (!task.result) {
        if (task.taskId === "DEF-024" && action === "modify") draft.type = task.correctedType;
        if (task.taskId === "DEF-034" && action === "exclude") draft.exclusionReason = task.defaultExclusionReason;
        if (task.taskId === "DEF-041" && action === "confirm") draft.opinion = task.defaultOpinion;
      }
      humanReviewState.dirty = true;
      if (action === "modify") ["risk", "type", "indicator", "opinion"].forEach((name) => humanReviewSetPanel(name, true));
      $("#humanReviewExclusionItem").hidden = action !== "exclude";
      if (action === "exclude") humanReviewSetPanel("exclusion", true);
      humanReviewState.sessionMessage = "已选择“" + humanReviewActionLabel(action) + "”，保存后生效";
      humanReviewRenderEditors(task);
      humanReviewRenderLogList();
    }

    function humanReviewTimeLabel() {
      return new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function humanReviewSaveCurrent(options) {
      const automated = Boolean(options && options.automated);
      const task = humanReviewTaskById(humanReviewState.selectedTaskId);
      if (!task) return false;
      if (automated && task.result) return false;
      const draft = humanReviewDraftFor(task);
      if (!draft.action) {
        if (!automated) showToast("请先选择确认、修改或排除操作", "warning", 2400);
        return false;
      }
      if (!humanReviewState.dirty && task.result) {
        if (!automated) showToast("当前任务已保存，未重复计入进度", "warning", 2300);
        return false;
      }
      if (draft.action === "exclude" && !draft.exclusionReason.trim()) {
        humanReviewSetPanel("exclusion", true);
        if (!automated) showToast("排除误报必须填写排除原因", "warning", 2500);
        return false;
      }
      const before = { type: task.issue.type, severity: task.issue.severity, indicator: task.issue.suggestedIndicator };
      const result = {
        action: draft.action,
        type: draft.type.trim() || task.issue.type,
        severity: draft.severity,
        indicator: draft.indicator.trim() || task.issue.suggestedIndicator,
        opinion: draft.opinion.trim(),
        exclusionReason: draft.exclusionReason.trim(),
        retained: draft.action !== "exclude",
        operator: HUMAN_REVIEW_LOCKED.operator,
        savedAt: humanReviewTimeLabel()
      };
      task.result = result;
      task.status = result.action === "confirm" ? "confirmed" : result.action === "modify" ? "modified" : "excluded";
      task.revision += 1;
      task.draft = { ...result };
      humanReviewState.logs.push({
        logId: "REVIEW-" + task.taskId + "-" + task.revision,
        time: result.savedAt,
        operator: HUMAN_REVIEW_LOCKED.operator,
        taskId: task.taskId,
        imageId: task.image.id,
        originalAI: { type: task.issue.type, severity: task.issue.severity, confidence: task.issue.confidence },
        action: humanReviewActionLabel(result.action),
        before,
        after: { type: result.type, severity: result.severity, indicator: result.indicator },
        note: result.action === "exclude" ? result.exclusionReason : result.opinion,
        status: humanReviewStatusMeta(task.status).label,
        retained: result.retained,
        system: false
      });
      humanReviewState.dirty = false;
      humanReviewState.sessionMessage = task.taskId + "已保存，追溯日志已更新";
      const currentIndex = humanReviewState.tasks.findIndex((item) => item.taskId === task.taskId);
      const nextPending = humanReviewState.tasks.slice(currentIndex + 1).concat(humanReviewState.tasks.slice(0, currentIndex)).find((item) => !item.result);
      if (nextPending) humanReviewState.selectedTaskId = nextPending.taskId;
      humanReviewRenderAll();
      if (!automated) showToast(task.taskId + "已保存，进度按任务状态重新计算", "success", 2500);
      return true;
    }

    function humanReviewPrepareAutomatedTask(taskId) {
      if (!initializeHumanReview()) return false;
      const task = humanReviewTaskById(taskId);
      if (!task || task.result || humanReviewState.completed) return false;
      humanReviewState.riskFilter = "all";
      humanReviewState.selectedTaskId = taskId;
      $$('[data-human-review-risk]').forEach((button) => button.classList.toggle("is-current", button.dataset.humanReviewRisk === "all"));
      humanReviewSelectDecision(task.defaultAction);
      humanReviewState.dirty = false;
      humanReviewState.sessionMessage = "自动演示：" + task.taskId + " · " + humanReviewActionLabel(task.defaultAction) + "待保存";
      humanReviewRenderAll();
      return true;
    }

    function humanReviewCommitAutomatedTask(taskId) {
      const task = humanReviewTaskById(taskId);
      if (!task || task.result || demo.humanReviewCompletedTaskIds.has(taskId)) return false;
      humanReviewState.selectedTaskId = taskId;
      const saved = humanReviewSaveCurrent({ automated: true });
      if (saved) demo.humanReviewCompletedTaskIds.add(taskId);
      return saved;
    }

    function humanReviewSaveSupplementDraft() {
      const type = $("#humanReviewSupplementType").value.trim();
      if (!type) {
        showToast("请填写补录问题类型", "warning", 2200);
        return;
      }
      humanReviewState.supplementDraft = {
        type,
        severity: $("#humanReviewSupplementRisk").value,
        indicator: $("#humanReviewSupplementIndicator").value.trim(),
        note: $("#humanReviewSupplementNote").value.trim(),
        status: "演示草稿，尚未纳入锁定结果口径"
      };
      humanReviewSetSessionMessage("补录问题已保存为演示草稿，未改变42项锁定结果口径");
      showToast("演示草稿已保存，尚未纳入锁定结果口径", "warning", 2600);
    }

    function humanReviewComplete(options) {
      const automated = Boolean(options && options.automated);
      const stats = humanReviewCalculateStats(humanReviewState);
      if (stats.priorityCompleted < 7) {
        if (!automated) showToast("需先保存全部7项重点复核任务", "warning", 2400);
        return false;
      }
      if (!humanReviewPresetAligned(humanReviewState)) {
        if (!automated) showToast("当前人工调整结果与演示预设口径不一致，可继续保存为草稿或重置为标准演示流程。", "warning", 4200);
        return false;
      }
      humanReviewState.completed = true;
      humanReviewState.dirty = false;
      humanReviewState.sessionMessage = "人工复核已完成，等待GIS落图与问题清单生成";
      humanReviewRenderAll();
      setWorkflowStage(3, 2, true);
      if (!automated) showToast("人工复核完成，04仅标记为下一阶段", "success", 3000);
      return true;
    }

    function humanReviewReset() {
      humanReviewState = humanReviewCreateState();
      $("#humanReviewUnsavedPrompt").hidden = true;
      $("#humanReviewSupplementForm").hidden = true;
      $("#humanReviewAddIssueButton").classList.remove("is-selected");
      ["risk", "type", "indicator", "opinion", "exclusion"].forEach((name) => humanReviewSetPanel(name, false));
      $("#humanReviewExclusionItem").hidden = true;
      $("#humanReviewSupplementType").value = "";
      $("#humanReviewSupplementIndicator").value = "";
      $("#humanReviewSupplementNote").value = "";
      $$('[data-human-review-risk]').forEach((button) => button.classList.toggle("is-current", button.dataset.humanReviewRisk === "all"));
      humanReviewWorkspace.classList.remove("is-original-mode");
      humanReviewRenderAll();
      showToast("人工复核已重置为36 / 43、0 / 7", "success", 2500);
    }

    function humanReviewClearTransientUI() {
      if (!humanReviewWorkspace) return;
      humanReviewState.pendingNavigation = null;
      humanReviewState.dirty = false;
      ["humanReviewUnsavedPrompt", "humanReviewCompletion", "humanReviewSupplementForm", "humanReviewExclusionItem", "humanReviewZoomPlaceholder"].forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.hidden = true;
      });
      const addIssueButton = $("#humanReviewAddIssueButton");
      if (addIssueButton) addIssueButton.classList.remove("is-selected");
      ["risk", "type", "indicator", "opinion", "exclusion"].forEach((name) => humanReviewSetPanel(name, false));
      ["humanReviewSupplementType", "humanReviewSupplementIndicator", "humanReviewSupplementNote"].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });
      humanReviewWorkspace.classList.remove("is-original-mode");
    }

    function humanReviewSetRailState(isOpen) {
      const flowSteps = $$(".human-review-flow-step");
      flowSteps.forEach((step, index) => {
        step.classList.toggle("is-complete", index < 2 || (humanReviewState.completed && index === 2));
        step.classList.toggle("is-current", !humanReviewState.completed && index === 2);
        step.classList.toggle("human-review-is-next", humanReviewState.completed && index === 3);
        const label = $("i", step);
        if (index < 2 || (humanReviewState.completed && index === 2)) label.textContent = "已完成";
        else if (!humanReviewState.completed && index === 2) label.textContent = "当前阶段";
        else if (humanReviewState.completed && index === 3) label.textContent = "下一阶段";
        else label.textContent = "未开始";
      });
      flowButtons.forEach((button, index) => {
        const complete = humanReviewState.completed ? index < 3 : index < 2;
        const current = !humanReviewState.completed && index === 2;
        const next = humanReviewState.completed && index === 3;
        button.classList.toggle("human-review-is-complete", complete);
        button.classList.toggle("is-current", current);
        button.classList.toggle("is-next", next);
        const label = $("i", button);
        if (complete) label.textContent = "已完成";
        else if (current) label.textContent = "当前阶段";
        else if (next) label.textContent = "下一阶段";
        else label.textContent = "未开始";
      });
      if (!isOpen && !humanReviewState.completed) {
        flowButtons.forEach((button) => button.classList.remove("human-review-is-complete"));
        renderStageNavigation();
        return;
      }
      moduleRailButtons.forEach((button, index) => {
        button.classList.toggle("is-active", humanReviewState.completed ? index === 3 : index === 2);
        button.classList.toggle("is-complete", humanReviewState.completed ? index < 3 : index < 2);
        const label = $("i", button);
        if (humanReviewState.completed && index < 3) label.textContent = "已完成";
        else if (humanReviewState.completed && index === 3) label.textContent = "下一阶段";
        else if (!humanReviewState.completed && index < 2) label.textContent = "已完成";
        else if (!humanReviewState.completed && index === 2) label.textContent = "当前阶段";
        else label.textContent = "未开始";
      });
      appState.activeModuleIndex = humanReviewState.completed ? 3 : 2;
      renderStageNavigation();
    }

    function openHumanReviewWorkspace() {
      if (!initializeHumanReview()) {
        showToast("03模块初始化失败，01、02及全局导航仍可继续使用", "warning", 3200);
        return Promise.resolve(false);
      }
      if (motion.humanReview.state === "open" || motion.humanReview.state === "opening") return motion.humanReview.promise;
      if (motion.humanReview.state === "closing") return motion.humanReview.promise.then(openHumanReviewWorkspace);
      if (!appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      const token = ++motion.humanReview.token;
      motion.humanReview.state = "opening";
      syncMotionDebug();
      motion.humanReview.promise = (async () => {
        if (appState.gisWorkspaceOpen) await closeGISWorkspace();
        if (appState.workspaceOpen) await closeWorkspace();
        if (appState.aiRecognitionWorkspaceOpen) await closeAIRecognitionWorkspace();
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.humanReview.token) return;
        setBackdrop("closed");
        appState.humanReviewWorkspaceOpen = true;
        appState.activeModuleIndex = humanReviewState.completed ? 3 : 2;
        appState.activeViewStage = 2;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = 2;
        appState.rightDrawerOpen = false;
        const project = cityProjects.find((item) => item.id === appState.activeProjectId) || cityProjects[0];
        $("#humanReviewProjectName").textContent = project.name;
        humanReviewWorkspace.classList.remove("is-closing", "is-settled");
        humanReviewWorkspace.classList.add("is-opening");
        humanReviewWorkspace.setAttribute("aria-hidden", "false");
        humanReviewRenderAll();
        await nextPaint();
        if (token !== motion.humanReview.token) return;
        appStage.classList.add("human-review-workspace-active");
        humanReviewWorkspace.classList.add("is-open");
        await waitForVisualEnd(humanReviewWorkspace, { property: "transform" });
        if (token !== motion.humanReview.token) return;
        humanReviewWorkspace.classList.remove("is-opening");
        humanReviewWorkspace.classList.add("is-settled");
        motion.humanReview.state = "open";
        humanReviewFitMedia();
        syncMotionDebug("human-review-open-complete");
        syncDebug();
      })();
      return motion.humanReview.promise;
    }

    function closeHumanReviewWorkspace() {
      if (!humanReviewWorkspace) return Promise.resolve(false);
      if (motion.humanReview.state === "closed") return Promise.resolve();
      if (motion.humanReview.state === "closing") return motion.humanReview.promise;
      if (motion.humanReview.state === "opening") return motion.humanReview.promise.then(closeHumanReviewWorkspace);
      const token = ++motion.humanReview.token;
      motion.humanReview.state = "closing";
      syncMotionDebug();
      motion.humanReview.promise = (async () => {
        humanReviewWorkspace.classList.remove("is-settled", "is-opening");
        humanReviewWorkspace.classList.add("is-closing");
        appStage.classList.remove("human-review-workspace-active");
        $("#humanReviewUnsavedPrompt").hidden = true;
        await nextPaint();
        humanReviewWorkspace.classList.remove("is-open");
        await waitForVisualEnd(humanReviewWorkspace, { property: "transform" });
        if (token !== motion.humanReview.token) return;
        humanReviewWorkspace.classList.remove("is-closing");
        humanReviewWorkspace.setAttribute("aria-hidden", "true");
        appState.humanReviewWorkspaceOpen = false;
        if (appState.activeWorkspaceStage === 2) appState.activeWorkspaceStage = null;
        appState.activeModuleIndex = humanReviewState.completed ? 3 : null;
        humanReviewSetRailState(false);
        motion.humanReview.state = "closed";
        syncMotionDebug("human-review-close-complete");
        syncDebug();
      })();
      return motion.humanReview.promise;
    }

    function gisRiskLabel(risk) {
      return risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "一般问题";
    }

    function gisIssueById(mapId) {
      return gisIssueData.find((issue) => issue.mapId === mapId) || null;
    }

    function gisIssuePosition(issue) {
      return gisState.positionOverrides.get(issue.mapId) || { x: issue.x, y: issue.y };
    }

    function gisBindingFor(issue) {
      return Object.assign({ buildingId: issue.buildingId, parcelId: issue.parcelId, roadId: issue.roadId }, gisState.bindingOverrides.get(issue.mapId) || {});
    }

    function gisBindingStatus(issue) {
      return gisState.pendingBindings.has(issue.mapId) ? "待空间确认" : "已绑定";
    }

    function gisVisibleIssues() {
      const keyword = gisState.search.trim().toLowerCase();
      return gisIssueData.filter((issue) => {
        if (gisState.riskFilter !== "all" && issue.risk !== gisState.riskFilter) return false;
        if (gisState.typeFilter !== "all" && issue.type !== gisState.typeFilter) return false;
        if (gisState.objectFilter) {
          const binding = gisBindingFor(issue);
          if (![binding.buildingId, binding.parcelId, binding.roadId].includes(gisState.objectFilter)) return false;
        }
        if (!keyword) return true;
        return [issue.mapId, issue.defectId, issue.type, issue.originalType, issue.imageId, issue.location]
          .some((value) => String(value).toLowerCase().includes(keyword));
      });
    }

    function gisSyncDebug(visibleIssues) {
      const visible = visibleIssues || gisVisibleIssues();
      window.__gisBetaDebug.initialized = gisInitialized;
      window.__gisBetaDebug.selectedMapId = gisState.selectedMapId;
      window.__gisBetaDebug.visibleCount = visible.length;
      window.__gisBetaDebug.riskFilter = gisState.riskFilter;
      window.__gisBetaDebug.typeFilter = gisState.typeFilter;
      window.__gisBetaDebug.search = gisState.search;
      window.__gisBetaDebug.layers = { ...gisState.layers };
      window.__gisBetaDebug.radius = gisState.radius;
      window.__gisBetaDebug.bound = 42 - gisState.pendingBindings.size;
      window.__gisBetaDebug.pending = gisState.pendingBindings.size;
      window.__gisBetaDebug.objectFilter = gisState.objectFilter;
      window.__gisBetaDebug.map = { scale: gisState.map.scale, x: gisState.map.x, y: gisState.map.y };
    }

    function gisRenderTypeOptions() {
      const select = $("#gisTypeFilter");
      const coreTypes = ["外墙饰面脱落", "外露管线", "空调外机安装杂乱", "道路破损", "公共设施损坏", "疑似违建点", "外墙抹灰层空鼓"];
      const types = [...new Set(coreTypes.concat(gisIssueData.map((issue) => issue.type)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
      select.replaceChildren(new Option("全部问题类型", "all"));
      types.forEach((type) => select.add(new Option(type, type)));
      select.value = gisState.typeFilter;
    }

    function gisRenderList(visibleIssues) {
      const list = $("#gisIssueList");
      list.replaceChildren();
      $("#gisVisibleCount").textContent = visibleIssues.length + "项";
      if (!visibleIssues.length) {
        const empty = document.createElement("p");
        empty.className = "gis-list-empty";
        empty.textContent = "当前筛选下没有问题，请调整风险、类型或搜索条件。";
        list.appendChild(empty);
        return;
      }
      const fragment = document.createDocumentFragment();
      visibleIssues.forEach((issue) => {
        const status = gisBindingStatus(issue);
        const binding = gisBindingFor(issue);
        const card = document.createElement("button");
        card.type = "button";
        card.className = "gis-issue-card" + (issue.mapId === gisState.selectedMapId ? " is-current" : "");
        card.dataset.gisMapId = issue.mapId;
        card.innerHTML = `<strong>${issue.mapId} <span>/ ${issue.defectId}</span></strong><b class="is-${issue.risk}">${gisRiskLabel(issue.risk)}</b><span>${issue.type}</span><small>${issue.imageId} · ${binding.buildingId} / ${binding.parcelId} · ${status}</small>`;
        card.addEventListener("click", () => {
          manualAction();
          if (!gisState.layers.points) {
            gisState.layers.points = true;
            const checkbox = $('[data-gis-layer="points"]');
            if (checkbox) checkbox.checked = true;
            showToast("问题点位图层已自动开启并定位", "success", 2200);
          }
          gisSelectIssue(issue.mapId, { center: true, scroll: false });
        });
        fragment.appendChild(card);
      });
      list.appendChild(fragment);
    }

    function gisRenderBindingStats() {
      const pending = gisState.pendingBindings.size;
      $("#gisBoundCount").textContent = 42 - pending;
      $("#gisPendingCount").textContent = pending;
      $("#gisObjectFilterStatus").textContent = gisState.objectFilter ? `对象筛选：${gisState.objectFilter} · 点击地图空白清除` : `GIS状态：${42 - pending}已绑定 / ${pending}待确认`;
    }

    function gisShowTooltip(issue) {
      const tooltip = $("#gisMapTooltip");
      $("b", tooltip).textContent = issue.mapId;
      $("span", tooltip).textContent = issue.type;
      $("i", tooltip).textContent = gisRiskLabel(issue.risk);
      tooltip.hidden = false;
    }

    function gisHideTooltip() {
      $("#gisMapTooltip").hidden = true;
      $("#gisFacilityTooltip").hidden = true;
    }

    function gisRenderSpatialLayers() {
      const issue = gisIssueById(gisState.selectedMapId) || gisIssueData[0];
      const binding = gisBindingFor(issue);
      const planning = GIS_SPATIAL_DATA.planning.map((item) => `<polygon class="gis-planning-shape" data-gis-object="${item.id}" points="${item.points}"><title>${item.type} · Demo预置条件</title></polygon>`).join("");
      const parcels = GIS_SPATIAL_DATA.parcels.map((item) => `<polygon class="gis-parcel-shape${item.id === binding.parcelId ? " is-selected" : ""}" data-gis-object="${item.id}" points="${item.points}"><title>${item.id} · ${item.planningUse}</title></polygon>`).join("");
      const buildings = GIS_SPATIAL_DATA.buildings.map((item) => `<rect class="gis-building-shape${item.id === binding.buildingId ? " is-selected" : ""}" data-gis-object="${item.id}" x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}"><title>${item.id}</title></rect><text class="gis-object-label" x="${item.x + 1}" y="${item.y + 2.4}">${item.id}</text>`).join("");
      const roads = GIS_SPATIAL_DATA.roads.map((item) => `<polyline class="gis-road-${item.kind}" data-gis-object="${item.id}" points="${item.points}"><title>${item.name}</title></polyline>`).join("");
      const context = GIS_SPATIAL_DATA.greenHeritage.map((item) => `<circle class="gis-${item.shape}-shape" data-gis-object="${item.id}" cx="${item.x}" cy="${item.y}" r="${item.shape === "water" ? 3.8 : 3}"><title>${item.name}</title></circle>`).join("");
      $("#gisSpatialLayer").innerHTML = planning + parcels + buildings + roads + context;
    }

    function gisAllFacilities() {
      const facilities = [];
      if (gisState.layers.transit) facilities.push(...GIS_SPATIAL_DATA.transit.map((item) => ({ ...item, group: "transit", sourceType: "Demo预置" })));
      if (gisState.layers.publicServices) facilities.push(...GIS_SPATIAL_DATA.publicServices.map((item) => ({ ...item, group: "public", sourceType: "Demo预置" })));
      if (gisState.layers.commercial) facilities.push(...GIS_SPATIAL_DATA.commercial.map((item) => ({ ...item, group: "commercial", sourceType: "Demo预置" })));
      if (gisState.layers.greenHeritage) facilities.push(...GIS_SPATIAL_DATA.greenHeritage.map((item) => ({ ...item, group: item.shape === "heritage" ? "heritage" : "green", sourceType: "Demo预置" })));
      if (gisState.layers.imagePoints) {
        const seen = new Set();
        gisIssueData.forEach((issue) => { if (!seen.has(issue.imageId)) { seen.add(issue.imageId); const position = gisIssuePosition(issue); facilities.push({ id: issue.imageId, name: issue.imageId, type: "现场影像点", x: position.x + 1.2, y: position.y - 1.2, group: "image", sourceType: "项目资料" }); } });
      }
      return facilities;
    }

    function gisFacilityDistance(facility) {
      const issue = gisIssueById(gisState.selectedMapId) || gisIssueData[0];
      const position = gisIssuePosition(issue);
      return Math.max(35, Math.round(Math.hypot(facility.x - position.x, facility.y - position.y) * 17));
    }

    function gisRenderFacilities() {
      const layer = $("#gisFacilityLayer");
      layer.replaceChildren();
      gisAllFacilities().forEach((facility) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "gis-facility is-" + facility.group;
        button.dataset.gisFacility = facility.id;
        button.style.left = facility.x + "%";
        button.style.top = facility.y + "%";
        button.setAttribute("aria-label", facility.name + " " + facility.type);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          manualAction();
          const tooltip = $("#gisFacilityTooltip");
          $("b", tooltip).textContent = facility.name;
          $("span", tooltip).textContent = facility.type;
          $("i", tooltip).textContent = `距当前问题 ${gisFacilityDistance(facility)}m`;
          $("small", tooltip).textContent = facility.sourceType + "空间数据";
          tooltip.hidden = false;
        });
        layer.appendChild(button);
      });
    }

    function gisRenderPoints(visibleIssues) {
      const layer = $("#gisPointLayer");
      layer.replaceChildren();
      const fragment = document.createDocumentFragment();
      visibleIssues.forEach((issue) => {
        const position = gisIssuePosition(issue);
        const point = document.createElement("button");
        point.type = "button";
        point.className = "gis-point is-" + issue.risk + (gisState.layers.risk ? "" : " is-neutral") + (issue.mapId === gisState.selectedMapId ? " is-selected" : "");
        point.dataset.gisMapId = issue.mapId;
        point.style.left = position.x + "%";
        point.style.top = position.y + "%";
        point.setAttribute("aria-label", issue.mapId + " " + issue.type + " " + gisRiskLabel(issue.risk));
        point.innerHTML = `<span>${issue.mapId.replace("MAP-", "M")}</span>`;
        point.addEventListener("mouseenter", () => gisShowTooltip(issue));
        point.addEventListener("mouseleave", gisHideTooltip);
        point.addEventListener("focus", () => gisShowTooltip(issue));
        point.addEventListener("blur", gisHideTooltip);
        point.addEventListener("click", (event) => {
          event.stopPropagation();
          manualAction();
          gisSelectIssue(issue.mapId, { center: false, scroll: true });
        });
        fragment.appendChild(point);
      });
      layer.appendChild(fragment);
    }

    function gisRenderSourceRegistry() {
      $("#gisSourceList").innerHTML = GIS_SOURCE_REGISTRY.map((source) => `<article class="gis-source-card"><header><b>${source.layerName}</b><span>${source.updateStatus}</span></header><dl><div><dt>来源</dt><dd>${source.sourceName}</dd></div><div><dt>类型</dt><dd>${source.sourceType}</dd></div><div><dt>数据日期</dt><dd>${source.sourceDate}</dd></div><div><dt>精度</dt><dd>${source.accuracy}</dd></div></dl><p>${source.note}</p></article>`).join("");
    }

    function initializeGISPublicData() {
      if (GIS_SOURCE_REGISTRY.length !== 8) throw new Error("8类GIS输入图层登记不完整");
      gisRenderSourceRegistry();
      return true;
    }

    function gisRenderBindingOptions(issue) {
      const binding = gisBindingFor(issue);
      const fill = (select, data, label) => {
        select.replaceChildren();
        data.forEach((item) => select.add(new Option(item.id + (item.name ? " · " + item.name : ""), item.id)));
        select.value = binding[label];
      };
      fill($("#gisBuildingSelect"), GIS_SPATIAL_DATA.buildings, "buildingId");
      fill($("#gisParcelSelect"), GIS_SPATIAL_DATA.parcels, "parcelId");
      fill($("#gisRoadSelect"), GIS_SPATIAL_DATA.roads, "roadId");
      const pending = gisState.pendingBindings.has(issue.mapId);
      $("#gisBindingStatus").textContent = pending ? "待空间确认" : "已绑定";
      $("#gisBindingBadge").textContent = pending ? "待确认" : "已绑定";
      $("#gisBindingBadge").classList.toggle("is-bound", !pending);
      $("#gisConfirmBinding").disabled = !pending;
      $("#gisConfirmBinding").textContent = pending ? "确认空间绑定" : "已完成绑定";
    }

    function gisRenderSurroundings(issue) {
      const data = issue.surroundings[gisState.radius];
      const binding = gisBindingFor(issue);
      $("#gisSurroundingRadius").textContent = gisState.radius + "m";
      $("#gisInsideBoundary").textContent = issue.insideBoundary ? "项目边界内" : "紧邻项目边界";
      $("#gisParcelValue").textContent = binding.parcelId;
      $("#gisObjectValue").textContent = binding.buildingId + " / " + binding.roadId;
      $("#gisPlanningUse").textContent = issue.planningUse;
      $("#gisPlanningControl").textContent = issue.planningControl;
      $("#gisHeritageRelation").textContent = issue.heritageRelation;
      $("#gisNearestRoad").textContent = issue.nearestRoadName + " · " + issue.distanceToMainRoad + "m";
      $("#gisNearestBus").textContent = issue.nearestBusName + " · " + issue.distanceToBusStop + "m";
      $("#gisNearestParking").textContent = issue.nearestParkingName + " · " + issue.distanceToParking + "m";
      $("#gisNearestMetro").textContent = gisState.radius + "m范围内暂无轨道站";
      const keys = ["education", "medical", "elderly", "culture", "sports", "community"];
      const ids = ["gisEducationCount", "gisMedicalCount", "gisElderlyCount", "gisCultureCount", "gisSportsCount", "gisCommunityCount"];
      keys.forEach((key, index) => $("#" + ids[index]).textContent = data[key]);
      $("#gisServiceTotal").textContent = keys.reduce((sum, key) => sum + data[key], 0) + "处";
      $("#gisCommercialCount").textContent = data.commercial + "处";
      $("#gisNearestCommercial").textContent = issue.nearestCommercialName + " · " + issue.distanceToCommercial + "m";
      $("#gisNearestGreen").textContent = issue.nearestGreenName + " · " + issue.distanceToGreenSpace + "m";
      $("#gisNearestHeritage").textContent = issue.heritageRelation === "无直接关联" ? "当前范围无直接关联" : issue.heritageRelation;
    }

    function gisRenderAnalysisRange(issue) {
      const position = gisIssuePosition(issue);
      const range = $("#gisAnalysisRange");
      range.style.left = position.x + "%";
      range.style.top = position.y + "%";
      range.style.setProperty("--range-size", gisState.radius === "500" ? "22%" : gisState.radius === "800" ? "34%" : "46%");
      range.classList.toggle("is-visible", gisState.layers.analysisRange);
      $("#gisAnalysisRangeLabel").textContent = gisState.radius + "m";
      $$('[data-gis-radius]').forEach((button) => button.classList.toggle("is-current", button.dataset.gisRadius === gisState.radius));
    }

    function gisFindTarget(targetId) {
      return [...GIS_SPATIAL_DATA.roads, ...GIS_SPATIAL_DATA.transit, ...GIS_SPATIAL_DATA.publicServices, ...GIS_SPATIAL_DATA.commercial, ...GIS_SPATIAL_DATA.greenHeritage].find((item) => item.id === targetId) || null;
    }

    function gisRenderDistanceLine(issue) {
      const layer = $("#gisDistanceLayer");
      layer.replaceChildren();
      if (!gisState.distanceTarget) return;
      const target = gisFindTarget(gisState.distanceTarget.id);
      if (!target) return;
      const position = gisIssuePosition(issue);
      layer.innerHTML = `<line x1="${position.x}" y1="${position.y}" x2="${target.x}" y2="${target.y}"></line><text x="${(position.x + target.x) / 2}" y="${(position.y + target.y) / 2}">${gisState.distanceTarget.distance}m</text>`;
    }

    function gisRenderDetail() {
      const issue = gisIssueById(gisState.selectedMapId) || gisIssueData[0];
      if (!issue) return;
      $("#gisCurrentMapId").textContent = issue.mapId;
      $("#gisDetailMapId").textContent = issue.mapId;
      $("#gisDetailDefectId").textContent = issue.defectId;
      $("#gisDetailImageId").textContent = issue.imageId;
      $("#gisDetailType").textContent = issue.type;
      const position = gisIssuePosition(issue);
      $("#gisDetailCoordinate").textContent = position.x.toFixed(1) + "%, " + position.y.toFixed(1) + "%";
      $("#gisDetailLocation").textContent = issue.location;
      const risk = $("#gisDetailRisk");
      risk.textContent = gisRiskLabel(issue.risk);
      risk.className = "is-" + issue.risk;
      $("#gisEvidenceImage").src = issue.imageFile;
      $("#gisEvidenceImage").alt = issue.type + "现场影像证据";
      $("#gisEvidenceImageId").textContent = issue.imageId;
      $("#gisEvidenceType").textContent = issue.type;
      $("#gisEvidenceConclusion").textContent = issue.reviewResult;
      $("#gisOriginalType").textContent = issue.originalType;
      $("#gisReviewResult").textContent = issue.reviewResult;
      $("#gisReviewRisk").textContent = gisRiskLabel(issue.risk);
      $("#gisReviewNote").textContent = issue.reviewNote;
      $("#gisTraceImage").textContent = issue.trace[0];
      $("#gisTraceDefect").textContent = issue.trace[1];
      $("#gisTraceReview").textContent = issue.trace[2];
      $("#gisTraceMap").textContent = issue.trace[3];
      $("#gisImagePreviewSource").src = issue.imageFile;
      $("#gisImagePreviewSource").alt = issue.type + "原始现场影像";
      $("#gisImagePreviewId").textContent = issue.imageId;
      gisRenderSurroundings(issue);
      gisRenderBindingOptions(issue);
      gisRenderAnalysisRange(issue);
      gisRenderDistanceLine(issue);
    }

    function gisRenderLayers() {
      gisMapViewport.classList.toggle("gis-boundary-hidden", !gisState.layers.boundary);
      gisMapViewport.classList.toggle("gis-points-hidden", !gisState.layers.points);
      gisMapViewport.classList.toggle("gis-labels-hidden", !gisState.layers.labels);
      gisMapViewport.classList.toggle("gis-buildings-hidden", !gisState.layers.buildings);
      gisMapViewport.classList.toggle("gis-planning-hidden", !gisState.layers.planning);
      gisMapViewport.classList.toggle("gis-roads-hidden", !gisState.layers.roads);
      gisMapViewport.classList.toggle("gis-green-hidden", !gisState.layers.greenHeritage);
      $(".gis-map-footer b").textContent = "项目边界：" + (gisState.layers.boundary ? "显示" : "隐藏");
      $$('[data-gis-layer]').forEach((checkbox) => { checkbox.checked = Boolean(gisState.layers[checkbox.dataset.gisLayer]); });
    }

    function gisRenderTabs() {
      $$('[data-gis-tab]').forEach((button) => button.classList.toggle("is-current", button.dataset.gisTab === gisState.activeTab));
      $$('[data-gis-panel]').forEach((panel) => panel.classList.toggle("is-current", panel.dataset.gisPanel === gisState.activeTab));
    }

    function gisRenderAll() {
      let visibleIssues = gisVisibleIssues();
      if (visibleIssues.length && !visibleIssues.some((issue) => issue.mapId === gisState.selectedMapId)) gisState.selectedMapId = visibleIssues[0].mapId;
      gisRenderList(visibleIssues);
      gisRenderBindingStats();
      gisRenderSpatialLayers();
      gisRenderFacilities();
      gisRenderPoints(visibleIssues);
      gisRenderDetail();
      gisRenderLayers();
      gisRenderTabs();
      $$('[data-gis-risk]').forEach((button) => button.classList.toggle("is-current", button.dataset.gisRisk === gisState.riskFilter));
      gisSyncDebug(visibleIssues);
    }

    function gisApplyMapTransform() {
      gisMapTransform.style.setProperty("--gis-map-scale", gisState.map.scale.toFixed(3));
      gisMapTransform.style.setProperty("--gis-map-x", gisState.map.x.toFixed(2) + "px");
      gisMapTransform.style.setProperty("--gis-map-y", gisState.map.y.toFixed(2) + "px");
      $("#gisMapScaleLabel").textContent = Math.round(gisState.map.scale * 100) + "%";
      gisSyncDebug();
    }

    function gisSetMapScale(scale) {
      gisState.map.scale = clamp(scale, 1, 2.4);
      const boundX = gisMapContent.clientWidth * (gisState.map.scale - 1) * 0.5;
      const boundY = gisMapContent.clientHeight * (gisState.map.scale - 1) * 0.5;
      gisState.map.x = clamp(gisState.map.x, -boundX, boundX);
      gisState.map.y = clamp(gisState.map.y, -boundY, boundY);
      gisApplyMapTransform();
    }

    function gisCenterSelected() {
      const issue = gisIssueById(gisState.selectedMapId);
      if (!issue) return;
      const position = gisIssuePosition(issue);
      gisState.map.scale = Math.max(1.65, gisState.map.scale);
      const width = gisMapContent.clientWidth;
      const height = gisMapContent.clientHeight;
      const boundX = width * (gisState.map.scale - 1) * 0.5;
      const boundY = height * (gisState.map.scale - 1) * 0.5;
      gisState.map.x = clamp((50 - position.x) / 100 * width * gisState.map.scale, -boundX, boundX);
      gisState.map.y = clamp((50 - position.y) / 100 * height * gisState.map.scale, -boundY, boundY);
      gisApplyMapTransform();
    }

    function gisResetMap() {
      gisState.map.scale = 1;
      gisState.map.x = 0;
      gisState.map.y = 0;
      gisApplyMapTransform();
    }

    function gisSelectIssue(mapId, options) {
      const issue = gisIssueById(mapId);
      if (!issue) return;
      gisState.selectedMapId = issue.mapId;
      gisState.distanceTarget = null;
      gisRenderAll();
      if (options && options.center) gisCenterSelected();
      if (options && options.scroll) {
        const card = $(`[data-gis-map-id="${issue.mapId}"]`, $("#gisIssueList"));
        if (card) card.scrollIntoView({ block: "nearest" });
      }
    }

    function gisStepIssue(direction) {
      const visible = gisVisibleIssues();
      if (!visible.length) return;
      const current = Math.max(0, visible.findIndex((issue) => issue.mapId === gisState.selectedMapId));
      const next = visible[(current + direction + visible.length) % visible.length];
      gisSelectIssue(next.mapId, { center: true, scroll: true });
    }

    function gisSetActiveTab(tab, options) {
      gisState.activeTab = tab;
      if (tab === "surroundings" && !(options && options.autoEnable === false)) {
        ["transit", "publicServices", "commercial", "greenHeritage", "analysisRange"].forEach((layer) => gisState.layers[layer] = true);
      }
      gisRenderAll();
    }

    function gisSetRailState() {
      moduleRailButtons.forEach((button, index) => {
        button.classList.toggle("is-active", index === 3);
        button.classList.toggle("is-complete", index < 3);
        const label = $("i", button);
        if (index < 3) label.textContent = "已完成";
        else if (index === 3) label.textContent = "当前阶段";
        else label.textContent = "未开始";
      });
      flowButtons.forEach((button, index) => {
        button.classList.toggle("human-review-is-complete", index < 3);
        button.classList.toggle("is-current", index === 3);
        button.classList.remove("is-next");
        const label = $("i", button);
        if (index < 3) label.textContent = "已完成";
        else if (index === 3) label.textContent = "当前阶段";
        else label.textContent = "未开始";
      });
      appState.activeModuleIndex = 3;
      renderStageNavigation();
    }

    function gisObjectIssues(objectId) {
      return gisIssueData.filter((issue) => {
        const binding = gisBindingFor(issue);
        return [binding.buildingId, binding.parcelId, binding.roadId].includes(objectId);
      });
    }

    function gisSelectObject(objectId) {
      const issues = gisObjectIssues(objectId);
      const counts = issues.reduce((result, issue) => { result[issue.risk] += 1; return result; }, { high: 0, medium: 0, general: 0 });
      const tooltip = $("#gisObjectTooltip");
      $("b", tooltip).textContent = objectId;
      $("span", tooltip).textContent = `关联问题 ${issues.length}项 · 高${counts.high} / 中${counts.medium} / 一般${counts.general}`;
      $("small", tooltip).textContent = issues.length ? "已筛选该对象关联问题 · 点击地图空白清除" : "当前对象暂无关联问题";
      tooltip.hidden = false;
      gisState.objectFilter = issues.length ? objectId : null;
      if (issues.length) gisState.selectedMapId = issues[0].mapId;
      gisRenderAll();
    }

    function gisSetDistanceFact(kind) {
      const issue = gisIssueById(gisState.selectedMapId) || gisIssueData[0];
      const definitions = {
        bus: { id: issue.nearestBusId, distance: issue.distanceToBusStop, layer: "transit" },
        parking: { id: issue.nearestParkingId, distance: issue.distanceToParking, layer: "transit" },
        commercial: { id: issue.nearestCommercialId, distance: issue.distanceToCommercial, layer: "commercial" },
        green: { id: issue.nearestGreenId, distance: issue.distanceToGreenSpace, layer: "greenHeritage" }
      };
      if (kind === "road") {
        gisState.layers.roads = true;
        gisState.distanceTarget = gisState.distanceTarget && gisState.distanceTarget.id === issue.nearestRoadId ? null : { id: issue.nearestRoadId, distance: issue.distanceToMainRoad, layer: "roads" };
      } else if (definitions[kind]) {
        const next = definitions[kind];
        gisState.layers[next.layer] = true;
        gisState.distanceTarget = gisState.distanceTarget && gisState.distanceTarget.id === next.id ? null : next;
      }
      gisRenderAll();
    }

    function gisChangeBinding(field, value) {
      const issue = gisIssueById(gisState.selectedMapId);
      if (!issue) return;
      const current = gisState.bindingOverrides.get(issue.mapId) || {};
      gisState.bindingOverrides.set(issue.mapId, { ...current, [field]: value });
      gisRenderAll();
    }

    function gisNudgeSelected(direction) {
      const issue = gisIssueById(gisState.selectedMapId);
      if (!issue) return;
      const current = gisIssuePosition(issue);
      const history = gisState.adjustmentHistory.get(issue.mapId) || [];
      history.push({ ...current });
      gisState.adjustmentHistory.set(issue.mapId, history);
      const delta = { up: [0, -0.6], down: [0, 0.6], left: [-0.6, 0], right: [0.6, 0] }[direction];
      gisState.positionOverrides.set(issue.mapId, { x: clamp(current.x + delta[0], 12, 88), y: clamp(current.y + delta[1], 10, 88) });
      gisRenderAll();
    }

    function gisUndoAdjustment() {
      const issue = gisIssueById(gisState.selectedMapId);
      if (!issue) return;
      const history = gisState.adjustmentHistory.get(issue.mapId) || [];
      if (!history.length) { showToast("当前点位没有可撤销的微调", "warning", 1800); return; }
      gisState.positionOverrides.set(issue.mapId, history.pop());
      gisState.adjustmentHistory.set(issue.mapId, history);
      gisRenderAll();
    }

    function gisRestorePosition() {
      const issue = gisIssueById(gisState.selectedMapId);
      if (!issue) return;
      gisState.positionOverrides.delete(issue.mapId);
      gisState.adjustmentHistory.delete(issue.mapId);
      gisRenderAll();
      showToast("已恢复原始固定点位", "success", 1800);
    }

    function gisConfirmBinding() {
      const issue = gisIssueById(gisState.selectedMapId);
      if (!issue || !gisState.pendingBindings.has(issue.mapId)) return;
      gisState.pendingBindings.delete(issue.mapId);
      gisRenderAll();
      const pending = gisState.pendingBindings.size;
      showToast(pending ? `${issue.mapId}空间绑定已确认，剩余${pending}项` : "42项问题已完成空间绑定，等待进入下一阶段", "success", 2600);
    }

    function bindGISEvents() {
      $("#gisBackButton").addEventListener("click", () => { manualAction(); closeGISWorkspace().then(() => completeReturnToMap("已返回西安市城市项目总览")); });
      $("#gisCloseButton").addEventListener("click", () => { manualAction(); closeGISWorkspace().then(() => completeReturnToMap("GIS落图工作台已关闭")); });
      $("#gisSearchInput").addEventListener("input", (event) => { manualAction(); gisState.search = event.target.value; gisRenderAll(); });
      $("#gisTypeFilter").addEventListener("change", (event) => { manualAction(); gisState.typeFilter = event.target.value; gisRenderAll(); });
      $$('[data-gis-risk]').forEach((button) => button.addEventListener("click", () => { manualAction(); gisState.riskFilter = button.dataset.gisRisk; gisRenderAll(); }));
      $$('[data-gis-tab]').forEach((button) => button.addEventListener("click", () => { manualAction(); gisSetActiveTab(button.dataset.gisTab); }));
      $$('[data-gis-radius]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        gisState.radius = button.dataset.gisRadius;
        gisState.layers.analysisRange = true;
        ["transit", "publicServices", "commercial", "greenHeritage"].forEach((layer) => gisState.layers[layer] = true);
        gisRenderAll();
      }));
      $$('[data-gis-layer]').forEach((checkbox) => checkbox.addEventListener("change", () => {
        manualAction();
        gisState.layers[checkbox.dataset.gisLayer] = checkbox.checked;
        if (!checkbox.checked && ["transit", "publicServices", "commercial", "greenHeritage"].includes(checkbox.dataset.gisLayer)) gisState.distanceTarget = null;
        gisRenderAll();
      }));
      $("#gisLayerCollapse").addEventListener("click", () => { manualAction(); gisState.layerCollapsed = !gisState.layerCollapsed; $("#gisLayerControl").classList.toggle("is-collapsed", gisState.layerCollapsed); $("#gisLayerCollapse").textContent = gisState.layerCollapsed ? "+" : "−"; });
      $("#gisSourceEntry").addEventListener("click", () => { manualAction(); gisSetActiveTab("sources"); });
      $("#gisZoomIn").addEventListener("click", () => { manualAction(); gisSetMapScale(gisState.map.scale + .2); });
      $("#gisZoomOut").addEventListener("click", () => { manualAction(); gisSetMapScale(gisState.map.scale - .2); });
      $("#gisMapReset").addEventListener("click", () => { manualAction(); gisResetMap(); showToast("GIS地图已复位"); });
      $("#gisLocateButton").addEventListener("click", () => {
        manualAction();
        if (!gisState.layers.points) {
          gisState.layers.points = true;
          $('[data-gis-layer="points"]').checked = true;
          gisRenderLayers();
          showToast("问题点位图层已自动开启", "success", 2000);
        }
        gisCenterSelected();
      });
      $("#gisPreviousIssue").addEventListener("click", () => { manualAction(); gisStepIssue(-1); });
      $("#gisNextIssue").addEventListener("click", () => { manualAction(); gisStepIssue(1); });
      $("#gisBuildingSelect").addEventListener("change", (event) => { manualAction(); gisChangeBinding("buildingId", event.target.value); });
      $("#gisParcelSelect").addEventListener("change", (event) => { manualAction(); gisChangeBinding("parcelId", event.target.value); });
      $("#gisRoadSelect").addEventListener("change", (event) => { manualAction(); gisChangeBinding("roadId", event.target.value); });
      $$('[data-gis-nudge]').forEach((button) => button.addEventListener("click", () => { manualAction(); gisNudgeSelected(button.dataset.gisNudge); }));
      $("#gisUndoAdjustment").addEventListener("click", () => { manualAction(); gisUndoAdjustment(); });
      $("#gisRestorePosition").addEventListener("click", () => { manualAction(); gisRestorePosition(); });
      $("#gisConfirmBinding").addEventListener("click", () => { manualAction(); gisConfirmBinding(); });
      $$('[data-gis-distance]').forEach((button) => button.addEventListener("click", () => { manualAction(); gisSetDistanceFact(button.dataset.gisDistance); }));
      $("#gisEvidencePreview").addEventListener("click", () => { manualAction(); $("#gisImagePreview").hidden = false; });
      $("#gisImagePreviewClose").addEventListener("click", () => { $("#gisImagePreview").hidden = true; });
      $("#gisImagePreview").addEventListener("click", (event) => { if (event.target === $("#gisImagePreview")) $("#gisImagePreview").hidden = true; });
      gisMapViewport.addEventListener("wheel", (event) => { event.preventDefault(); manualAction(); gisSetMapScale(gisState.map.scale + (event.deltaY < 0 ? .14 : -.14)); }, { passive: false });
      $("#gisSpatialLayer").addEventListener("click", (event) => { const object = event.target.closest("[data-gis-object]"); if (object) { event.stopPropagation(); manualAction(); gisSelectObject(object.dataset.gisObject); } });
      gisMapViewport.addEventListener("click", (event) => {
        if (!event.target.closest(".gis-point") && !event.target.closest(".gis-facility") && !event.target.closest("[data-gis-object]")) {
          gisHideTooltip();
          $("#gisObjectTooltip").hidden = true;
          if (gisState.objectFilter) { gisState.objectFilter = null; gisRenderAll(); }
        }
      });
      gisMapViewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest(".gis-point") || event.target.closest(".gis-facility") || event.target.closest("[data-gis-object]") || event.target.closest(".gis-layer-control") || event.target.closest(".gis-map-buttons") || event.target.closest(".gis-radius-switch")) return;
        manualAction();
        gisState.map.dragging = true;
        gisState.map.pointerId = event.pointerId;
        gisState.map.startX = event.clientX;
        gisState.map.startY = event.clientY;
        gisState.map.originX = gisState.map.x;
        gisState.map.originY = gisState.map.y;
        gisMapViewport.classList.add("is-dragging");
        if (typeof gisMapViewport.setPointerCapture === "function") gisMapViewport.setPointerCapture(event.pointerId);
      });
      gisMapViewport.addEventListener("pointermove", (event) => {
        if (!gisState.map.dragging || event.pointerId !== gisState.map.pointerId) return;
        const stageScale = parseFloat(getComputedStyle(appStage).getPropertyValue("--stage-scale")) || 1;
        const dx = (event.clientX - gisState.map.startX) / stageScale;
        const dy = (event.clientY - gisState.map.startY) / stageScale;
        const boundX = gisMapContent.clientWidth * (gisState.map.scale - 1) * .5;
        const boundY = gisMapContent.clientHeight * (gisState.map.scale - 1) * .5;
        gisState.map.x = clamp(gisState.map.originX + dx, -boundX, boundX);
        gisState.map.y = clamp(gisState.map.originY + dy, -boundY, boundY);
        gisApplyMapTransform();
      });
      const finishGISDrag = (event) => {
        if (!gisState.map.dragging || event.pointerId !== gisState.map.pointerId) return;
        gisState.map.dragging = false;
        gisMapViewport.classList.remove("is-dragging");
        if (typeof gisMapViewport.hasPointerCapture === "function" && gisMapViewport.hasPointerCapture(event.pointerId)) gisMapViewport.releasePointerCapture(event.pointerId);
        gisState.map.pointerId = null;
      };
      gisMapViewport.addEventListener("pointerup", finishGISDrag);
      gisMapViewport.addEventListener("pointercancel", finishGISDrag);
    }

    function initializeGISWorkspace() {
      if (gisInitialized) return true;
      const requiredIds = ["gisWorkspace", "gisBackButton", "gisCloseButton", "gisIssueList", "gisPointLayer", "gisSpatialLayer", "gisFacilityLayer", "gisMapViewport", "gisMapTransform", "gisMapContent", "gisTypeFilter", "gisSourceList", "gisConfirmBinding"];
      const missing = requiredIds.filter((id) => !document.getElementById(id));
      if (missing.length) {
        runtimeDiagnosticError(new Error("04工作台DOM缺失: " + missing.join(", ")), "04惰性初始化");
        return false;
      }
      try {
        validateGISIssueData();
        gisRenderTypeOptions();
        initializeGISPublicData();
        bindGISEvents();
        gisRenderAll();
        gisApplyMapTransform();
        gisInitialized = true;
        gisSyncDebug();
        runtimeDiagnosticStep("04模块惰性初始化完成", "42项问题、8类底图、周边条件及空间绑定已就绪");
        return true;
      } catch (error) {
        runtimeDiagnosticError(error, "04惰性初始化");
        return false;
      }
    }

    function openGISWorkspace() {
      if (!initializeGISWorkspace()) {
        showToast("04模块初始化失败，01—03及全局导航仍可继续使用", "warning", 3200);
        return Promise.resolve(false);
      }
      if (motion.gis.state === "open" || motion.gis.state === "opening") return motion.gis.promise;
      if (motion.gis.state === "closing") return motion.gis.promise.then(openGISWorkspace);
      if (!appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      const token = ++motion.gis.token;
      motion.gis.state = "opening";
      syncMotionDebug();
      motion.gis.promise = (async () => {
        if (appState.workspaceOpen) await closeWorkspace();
        if (appState.aiRecognitionWorkspaceOpen) await closeAIRecognitionWorkspace();
        if (appState.humanReviewWorkspaceOpen) await closeHumanReviewWorkspace();
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.gis.token) return;
        setBackdrop("closed");
        appState.gisWorkspaceOpen = true;
        appState.activeModuleIndex = 3;
        appState.activeViewStage = 3;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = 3;
        appState.rightDrawerOpen = false;
        const project = cityProjects.find((item) => item.id === appState.activeProjectId) || cityProjects[0];
        $("#gisProjectName").textContent = project.name;
        gisWorkspace.classList.remove("is-closing", "is-settled");
        gisWorkspace.classList.add("is-opening");
        gisWorkspace.setAttribute("aria-hidden", "false");
        gisSetRailState();
        gisRenderAll();
        await nextPaint();
        if (token !== motion.gis.token) return;
        appStage.classList.add("gis-workspace-active");
        gisWorkspace.classList.add("is-open");
        await waitForVisualEnd(gisWorkspace, { property: "transform" });
        if (token !== motion.gis.token) return;
        gisWorkspace.classList.remove("is-opening");
        gisWorkspace.classList.add("is-settled");
        motion.gis.state = "open";
        syncMotionDebug("gis-open-complete");
        syncDebug();
      })();
      return motion.gis.promise;
    }

    function closeGISWorkspace() {
      if (!gisWorkspace || motion.gis.state === "closed") return Promise.resolve();
      if (motion.gis.state === "closing") return motion.gis.promise;
      if (motion.gis.state === "opening") return motion.gis.promise.then(closeGISWorkspace);
      const token = ++motion.gis.token;
      motion.gis.state = "closing";
      syncMotionDebug();
      motion.gis.promise = (async () => {
        gisWorkspace.classList.remove("is-settled", "is-opening");
        gisWorkspace.classList.add("is-closing");
        appStage.classList.remove("gis-workspace-active");
        $("#gisImagePreview").hidden = true;
        await nextPaint();
        gisWorkspace.classList.remove("is-open");
        await waitForVisualEnd(gisWorkspace, { property: "transform" });
        if (token !== motion.gis.token) return;
        gisWorkspace.classList.remove("is-closing");
        gisWorkspace.setAttribute("aria-hidden", "true");
        appState.gisWorkspaceOpen = false;
        if (appState.activeWorkspaceStage === 3) appState.activeWorkspaceStage = null;
        gisSetRailState();
        motion.gis.state = "closed";
        syncMotionDebug("gis-close-complete");
        syncDebug();
      })();
      return motion.gis.promise;
    }

    function indicatorById(indicatorId) {
      return indicatorData.indicators.find((item) => item.id === indicatorId) || indicatorData.indicators[0];
    }

    function indicatorCategoryById(categoryId) {
      return indicatorData.categories.find((item) => item.id === categoryId) || indicatorData.categories[0];
    }

    function indicatorIssues(indicator) {
      const ids = new Set(indicator.issueIds);
      return gisIssueData.filter((issue) => ids.has(issue.mapId));
    }

    function calculateIndicatorResults() {
      const state = indicatorScenarioState.enabled ? indicatorScenarioState : indicatorBaselineState;
      const indicators = indicatorData.indicators.map((definition) => {
        const contributions = INDICATOR_ISSUE_CONTRIBUTIONS[definition.id];
        const issueDeduction = Number(contributions.reduce((sum,item) => sum + (indicatorScenarioState.enabled && state.resolvedIssueIds.has(item.mapId) ? 0 : item.contribution),0).toFixed(2));
        const score = Number(clamp(100 - issueDeduction - INDICATOR_BASELINE_DEDUCTIONS[definition.id].gis,0,100).toFixed(2));
        const threshold = state.thresholds[definition.id];
        const weight = state.indicatorWeights[definition.id];
        return { ...definition,score,baselineScore:definition.score,delta:Number((score-definition.score).toFixed(2)),threshold,weight,status:indicatorStatusForScore(score,threshold),issueDeduction,gisDeduction:INDICATOR_BASELINE_DEDUCTIONS[definition.id].gis,contributions };
      });
      const categories = indicatorData.categories.map((definition) => {
        const children = indicators.filter((item) => item.categoryId === definition.id);
        const rawScore = Number(children.reduce((sum,item) => sum + item.score * item.weight / 100,0).toFixed(2));
        return { ...definition,rawScore,displayScore:Math.round(rawScore),baselineRawScore:definition.rawScore,delta:Number((rawScore-definition.rawScore).toFixed(2)),weight:state.categoryWeights[definition.id] };
      });
      const overallRawScore = Number(categories.reduce((sum,item) => sum + item.rawScore * item.weight / 100,0).toFixed(2));
      const overallDisplayScore = Number(overallRawScore.toFixed(1));
      return { indicators,categories,overallRawScore,overallDisplayScore,overallDelta:Number((overallDisplayScore-indicatorData.overallDisplayScore).toFixed(1)),unmet:indicators.filter((item) => item.status === "unmet") };
    }

    function indicatorResultById(indicatorId,results) {
      const current = results || calculateIndicatorResults();
      return current.indicators.find((item) => item.id === indicatorId) || current.indicators[0];
    }

    function indicatorDeltaLabel(value,digits) {
      const rounded = Number(value.toFixed(digits === undefined ? 1 : digits));
      return rounded === 0 ? "无变化" : (rounded > 0 ? "+" : "") + rounded;
    }

    function indicatorStatusLabel(status) {
      return status === "unmet" ? "未达标" : status === "basic" ? "基本达标" : "表现较好";
    }

    function indicatorRiskLabel(risk) {
      return risk === "high" ? "高风险" : risk === "medium" ? "中风险" : "一般问题";
    }

    function indicatorFilteredDefinitions() {
      const keyword = indicatorState.search.trim().toLowerCase();
      return calculateIndicatorResults().indicators.filter((indicator) => {
        if (indicatorState.statusFilter !== "all" && indicator.status !== indicatorState.statusFilter) return false;
        if (indicatorState.categoryFocus !== "all" && indicator.categoryId !== indicatorState.categoryFocus) return false;
        if (!keyword) return true;
        const issueText = indicatorIssues(indicator).map((issue) => `${issue.mapId} ${issue.defectId} ${issue.type}`).join(" ");
        return `${indicator.id} ${indicator.name} ${issueText}`.toLowerCase().includes(keyword);
      });
    }

    function indicatorRenderTree() {
      const results = calculateIndicatorResults();
      const visible = indicatorFilteredDefinitions();
      $("#indicatorVisibleCount").textContent = `${visible.length}项`;
      $("#indicatorTree").innerHTML = visible.length ? results.categories.map((category) => {
        const items = visible.filter((indicator) => indicator.categoryId === category.id);
        if (!items.length) return "";
        return `<section class="indicator-category-group"><button class="indicator-category-heading" type="button" data-indicator-category="${category.id}"><b>${category.name}</b><span>${category.displayScore} · ${category.weight}%</span></button>${items.map((indicator) => `<button class="indicator-tree-item ${indicator.status === "unmet" ? "is-unmet" : ""} ${indicator.id === indicatorState.selectedIndicatorId ? "is-current" : ""}" type="button" data-indicator-id="${indicator.id}"><strong>${indicator.id} · ${indicator.name}</strong><b>${Number.isInteger(indicator.score)?indicator.score:indicator.score.toFixed(1)}</b><small><span>基线${indicator.baselineScore} · 权重${indicator.weight}% · 阈值${indicator.threshold}</span><span>${indicatorStatusLabel(indicator.status)}${indicatorScenarioState.enabled&&indicator.delta?` · ${indicatorDeltaLabel(indicator.delta,1)}`:""}</span></small></button>`).join("")}</section>`;
      }).join("") : `<div class="indicator-tree-empty">当前筛选无匹配指标</div>`;
      $$('[data-indicator-category]', $("#indicatorWorkspace")).forEach((button) => button.classList.toggle("is-current", button.dataset.indicatorCategory === indicatorState.categoryFocus));
    }

    function indicatorRenderUnmet() {
      const results = calculateIndicatorResults();
      const unmet = results.unmet;
      $("#indicatorUnmetCount").textContent = indicatorScenarioState.enabled ? `基线3 / 模拟${unmet.length}` : `${unmet.length}项`;
      $(".indicator-tree-stats .is-unmet b").textContent = String(unmet.length);
      $("#indicatorUnmetList").innerHTML = unmet.map((indicator) => `<button class="indicator-unmet-card ${indicator.id === indicatorState.selectedIndicatorId ? "is-current" : ""}" type="button" data-indicator-id="${indicator.id}"><span>${indicator.id}</span><b>${Number.isInteger(indicator.score)?indicator.score:indicator.score.toFixed(1)}</b><strong>${indicator.name}</strong><small>阈值 ${indicator.threshold} · 差值 ${(indicator.score-indicator.threshold).toFixed(1)} · ${indicator.issueIds.length}项问题</small></button>`).join("");
    }

    function indicatorRenderContribution() {
      const results = calculateIndicatorResults();
      const selected = indicatorResultById(indicatorState.selectedIndicatorId,results);
      const category = results.categories.find((item) => item.id === selected.categoryId);
      const indicators = results.indicators.filter((indicator) => indicator.categoryId === category.id);
      $("#indicatorContributionTitle").textContent = `${category.name} · 核算构成`;
      $("#indicatorContributionSummary").textContent = `${category.rawScore.toFixed(2)} → ${category.displayScore}`;
      $("#indicatorContributionList").innerHTML = indicators.map((indicator) => {
        const contribution = indicator.score * indicator.weight / 100;
        return `<div class="indicator-contribution-row ${indicator.status === "unmet" ? "is-unmet" : ""}"><span>${indicator.id} · ${indicator.name}</span><div class="indicator-contribution-track"><i style="width:${indicator.score}%"></i></div><b>${indicator.score.toFixed(1)} × ${indicator.weight}% = ${contribution.toFixed(2)}</b></div>`;
      }).join("");
    }

    function indicatorRenderIssueFilters(issues) {
      const types = [...new Set(issues.map((issue) => issue.type))].sort((a, b) => a.localeCompare(b, "zh-CN"));
      const select = $("#indicatorIssueTypeFilter");
      const previous = indicatorState.issueTypeFilter;
      select.innerHTML = `<option value="all">全部类型</option>${types.map((type) => `<option value="${type}">${type}</option>`).join("")}`;
      if (!types.includes(previous)) indicatorState.issueTypeFilter = "all";
      select.value = indicatorState.issueTypeFilter;
      $("#indicatorIssueRiskFilter").value = indicatorState.issueRiskFilter;
    }

    function indicatorRenderIssueList(indicator) {
      const allIssues = indicatorIssues(indicator);
      indicatorRenderIssueFilters(allIssues);
      const visible = allIssues.filter((issue) => (indicatorState.issueRiskFilter === "all" || issue.risk === indicatorState.issueRiskFilter) && (indicatorState.issueTypeFilter === "all" || issue.type === indicatorState.issueTypeFilter));
      $("#indicatorResolveVisibleIssues").disabled = !indicatorScenarioState.enabled;
      $("#indicatorClearResolvedIssues").disabled = !indicatorScenarioState.enabled;
      $("#indicatorIssueList").innerHTML = visible.length ? visible.map((issue) => {
        const item = indicator.contributions.find((contribution) => contribution.mapId === issue.mapId);
        const resolved = indicatorScenarioState.resolvedIssueIds.has(issue.mapId);
        return `<article class="indicator-issue-card ${resolved?"is-simulated":""}"><img src="${issue.imageFile}" alt="${issue.imageId}现场影像"><div><strong>${issue.mapId} · ${issue.defectId}</strong><b>${indicatorRiskLabel(issue.risk)} · 扣分${item.contribution.toFixed(2)}</b><span>${issue.type}</span><small>${issue.imageId} · ${issue.buildingId} / ${issue.parcelId} · ${resolved?"模拟整改":"GIS已绑定"}</small><label ${indicatorScenarioState.enabled?"":"hidden"}><input type="checkbox" data-indicator-resolve="${issue.mapId}" ${resolved?"checked":""}>模拟完成整改</label><button type="button" data-indicator-locate="${issue.mapId}">在04 GIS工作台中定位</button></div></article>`;
      }).join("") : `<div class="indicator-tree-empty">当前筛选无关联问题</div>`;
    }

    function indicatorRenderBasis(indicator) {
      const issues = indicatorIssues(indicator);
      const risks = issues.reduce((counts, issue) => { counts[issue.risk] += 1; return counts; }, { high: 0, medium: 0, general: 0 });
      const example = issues.find((issue) => issue.mapId === "MAP-021") || issues[0];
      const services = example.surroundings["500"];
      const serviceTotal = Object.values(services).reduce((sum, value) => sum + value, 0);
      const contributions = indicator.contributions.map((item) => `${item.mapId} ${item.contribution.toFixed(2)}${indicatorScenarioState.resolvedIssueIds.has(item.mapId)?"（模拟移除）":""}`).join(" · ");
      const categoryWeight = indicatorScenarioState.enabled ? indicatorScenarioState.categoryWeights[indicator.categoryId] : indicatorBaselineState.categoryWeights[indicator.categoryId];
      $("#indicatorBasisContent").innerHTML = `<section class="indicator-basis-card"><header><span>动态核算公式</span><b>Demo预置</b></header><dl><div><dt>基础公式</dt><dd>100 - 问题证据扣分 - GIS空间条件扣分</dd></div><div><dt>问题证据扣分</dt><dd>${INDICATOR_BASELINE_DEDUCTIONS[indicator.id].issue.toFixed(2)} → ${indicator.issueDeduction.toFixed(2)}</dd></div><div><dt>GIS空间扣分</dt><dd>${indicator.gisDeduction.toFixed(2)}</dd></div><div><dt>二级指标权重</dt><dd>${indicator.weight}%</dd></div><div><dt>一级指标权重</dt><dd>${categoryWeight}%</dd></div></dl><p>${contributions}</p></section><section class="indicator-basis-card"><header><span>GIS空间证据</span><b>${example.mapId}</b></header><dl><div><dt>建筑 / 地块</dt><dd>${example.buildingId} / ${example.parcelId}</dd></div><div><dt>道路关系</dt><dd>${example.nearestRoadName} · ${example.distanceToMainRoad}m</dd></div><div><dt>公共交通</dt><dd>${example.nearestBusName} · ${example.distanceToBusStop}m</dd></div><div><dt>500m公共设施</dt><dd>${serviceTotal}处</dd></div><div><dt>800m / 1000m</dt><dd>${Object.values(example.surroundings["800"]).reduce((sum, value) => sum + value, 0)}处 / ${Object.values(example.surroundings["1000"]).reduce((sum, value) => sum + value, 0)}处</dd></div></dl><p>空间事实继承04本地固定数据，不重新编辑GIS点位。</p></section><section class="indicator-basis-card"><header><span>证据与贡献</span><b>${issues.length}项</b></header><dl><div><dt>风险分布</dt><dd>高${risks.high} / 中${risks.medium} / 一般${risks.general}</dd></div><div><dt>一级指标贡献</dt><dd>${(indicator.score*indicator.weight/100).toFixed(2)}</dd></div><div><dt>综合得分贡献</dt><dd>${(indicator.score*indicator.weight/100*categoryWeight/100).toFixed(2)}</dd></div><div><dt>人工复核</dt><dd>42项有效问题 · DEF-034已排除</dd></div></dl><p>不代表政府正式考核标准、法规审查或行政评价结果。</p></section>`;
    }

    function indicatorRenderDetail() {
      const results = calculateIndicatorResults();
      const indicator = indicatorResultById(indicatorState.selectedIndicatorId,results);
      const category = results.categories.find((item) => item.id === indicator.categoryId);
      const contribution = indicator.score * indicator.weight / 100;
      const issues = indicatorIssues(indicator);
      const example = issues.find((issue) => issue.mapId === "MAP-021") || issues[0];
      $("#indicatorDetailId").textContent = indicator.id;
      const baselineStatus = indicatorStatusForScore(indicator.baselineScore, indicatorBaselineState.thresholds[indicator.id]);
      $("#indicatorDetailStatus").textContent = indicatorScenarioState.enabled ? `${indicatorStatusLabel(baselineStatus)} → ${indicatorStatusLabel(indicator.status)}` : indicatorStatusLabel(indicator.status);
      $("#indicatorDetailStatus").classList.toggle("is-unmet", indicator.status === "unmet");
      $("#indicatorDetailCategory").textContent = category.name;
      $("#indicatorDetailScore").textContent = Number.isInteger(indicator.score)?indicator.score:indicator.score.toFixed(1);
      $("#indicatorDetailName").textContent = indicator.name;
      $("#indicatorDetailScoreCompare").textContent = indicatorScenarioState.enabled ? `${indicator.baselineScore} → ${indicator.score.toFixed(1)} · ${indicatorDeltaLabel(indicator.delta,1)}` : `${indicator.baselineScore} · 基线结果`;
      $("#indicatorDetailWeight").textContent = indicatorScenarioState.enabled ? `${indicatorBaselineState.indicatorWeights[indicator.id]}% → ${indicator.weight}%` : `${indicator.weight}%`;
      $("#indicatorDetailThreshold").textContent = indicatorScenarioState.enabled ? `${indicatorBaselineState.thresholds[indicator.id]} → ${indicator.threshold}` : indicator.threshold;
      $("#indicatorDetailIssueDeduction").textContent = `${INDICATOR_BASELINE_DEDUCTIONS[indicator.id].issue.toFixed(2)} → ${indicator.issueDeduction.toFixed(2)}`;
      $("#indicatorDetailGisDeduction").textContent = indicator.gisDeduction.toFixed(2);
      $("#indicatorDetailContribution").textContent = contribution.toFixed(2);
      $("#indicatorDetailIssueCount").textContent = `${indicator.issueIds.length}项`;
      $("#indicatorDetailLayers").textContent = indicator.evidenceLayers.join("、");
      $("#indicatorTraceChain").innerHTML = `<b>${example.imageId}</b><i>→</i><b>${example.defectId}</b><i>→</i><b>${example.reviewAction}</b><i>→</i><b>${example.mapId}</b><i>→</i><strong>${indicator.id}</strong>`;
      indicatorRenderIssueList(indicator);
      indicatorRenderBasis(indicator);
      window.__indicatorAlphaDebug.selectedIndicatorId = indicator.id;
    }

    function indicatorRenderScenarioComparison() {
      const results = calculateIndicatorResults();
      const building = results.categories.find((item) => item.id === "CAT-BS");
      const community = results.categories.find((item) => item.id === "CAT-CE");
      indicatorWorkspace.classList.toggle("is-scenario",indicatorScenarioState.enabled);
      $("#indicatorBaselineModeButton").classList.toggle("is-current",!indicatorScenarioState.enabled);
      $("#indicatorScenarioModeButton").classList.toggle("is-current",indicatorScenarioState.enabled);
      $("#indicatorScenarioModeButton").textContent = indicatorScenarioState.enabled ? "情景模拟中" : "启动情景模拟";
      $("#indicatorScenarioNotice span").textContent = indicatorScenarioState.enabled ? "情景模拟结果，不覆盖基线" : "基线结果只读 · Demo预置规则 V1.0";
      $("#indicatorOverallScore").textContent = results.overallDisplayScore.toFixed(1);
      $("#indicatorOverallMode").textContent = indicatorScenarioState.enabled ? "模拟结果" : "基线结果";
      $("#indicatorOverallCompare").textContent = indicatorScenarioState.enabled ? `基线82.4 · 模拟${results.overallDisplayScore.toFixed(1)} · 变化${indicatorDeltaLabel(results.overallDelta,1)}` : "分类得分按整数显示，综合得分使用分类未取整值计算。";
      $("#indicatorBuildingScore").textContent = String(building.displayScore);
      $("#indicatorCommunityScore").textContent = String(community.displayScore);
      $("#indicatorBuildingCompare").textContent = indicatorScenarioState.enabled ? `基线78 · 模拟${building.displayScore} · ${indicatorDeltaLabel(building.delta,2)}` : "权重30% · 原始77.55";
      $("#indicatorCommunityCompare").textContent = indicatorScenarioState.enabled ? `基线84 · 模拟${community.displayScore} · ${indicatorDeltaLabel(community.delta,2)}` : "权重70% · 原始84.45";
      $("#indicatorHeaderScore").textContent = results.overallDisplayScore.toFixed(1);
      $("#indicatorHeaderUnmet").textContent = `${results.unmet.length}项未达标`;
      $("#indicatorCalculationFormula").textContent = `${building.rawScore.toFixed(2)} × ${building.weight}% + ${community.rawScore.toFixed(2)} × ${community.weight}% = ${results.overallRawScore.toFixed(2)} → ${results.overallDisplayScore.toFixed(1)}`;
    }

    function indicatorRenderParameters() {
      const results = calculateIndicatorResults();
      const indicator = indicatorResultById(indicatorState.selectedIndicatorId,results);
      const definitions = results.indicators.filter((item) => item.categoryId === indicator.categoryId);
      const disabled = indicatorScenarioState.enabled ? "" : "disabled";
      $("#indicatorBuildingWeight").value = indicatorScenarioState.categoryWeights["CAT-BS"];
      $("#indicatorCommunityWeight").value = indicatorScenarioState.categoryWeights["CAT-CE"];
      $("#indicatorBuildingWeightValue").textContent = `${indicatorScenarioState.categoryWeights["CAT-BS"]}%`;
      $("#indicatorCommunityWeightValue").textContent = `${indicatorScenarioState.categoryWeights["CAT-CE"]}%`;
      $("#indicatorBuildingWeight").disabled = !indicatorScenarioState.enabled;
      $("#indicatorCommunityWeight").disabled = !indicatorScenarioState.enabled;
      $("#indicatorCategoryWeightTotal").textContent = `合计${indicatorScenarioState.categoryWeights["CAT-BS"]+indicatorScenarioState.categoryWeights["CAT-CE"]}%`;
      $("#indicatorSecondaryWeightControls").innerHTML = definitions.map((item) => `<label class="indicator-secondary-weight-row"><span>${item.id}</span><input type="range" min="5" max="60" step="1" value="${indicatorScenarioState.indicatorWeights[item.id]}" data-indicator-weight="${item.id}" ${disabled}><output>${indicatorScenarioState.indicatorWeights[item.id]}%</output></label>`).join("");
      $("#indicatorThresholdLabel").textContent = indicator.id;
      $("#indicatorThresholdControl").value = indicatorScenarioState.thresholds[indicator.id];
      $("#indicatorThresholdValue").textContent = String(indicatorScenarioState.thresholds[indicator.id]);
      $("#indicatorThresholdControl").disabled = !indicatorScenarioState.enabled;
      $("#indicatorResetCurrentRule").disabled = !indicatorScenarioState.enabled;
      $("#indicatorResetAllRules").disabled = !indicatorScenarioState.enabled;
      $("#indicatorExitScenario").disabled = !indicatorScenarioState.enabled;
    }

    function indicatorRenderAll(options) {
      indicatorRenderScenarioComparison();
      indicatorRenderTree();
      indicatorRenderUnmet();
      indicatorRenderContribution();
      indicatorRenderDetail();
      if (!(options && options.skipParameters)) indicatorRenderParameters();
      $$('[data-indicator-tab]').forEach((button) => button.classList.toggle("is-current", button.dataset.indicatorTab === indicatorState.activeTab));
      $$('[data-indicator-panel]').forEach((panel) => panel.classList.toggle("is-current", panel.dataset.indicatorPanel === indicatorState.activeTab));
      $$('[data-indicator-status]').forEach((button) => button.classList.toggle("is-current", button.dataset.indicatorStatus === indicatorState.statusFilter));
      const results = calculateIndicatorResults();
      Object.assign(window.__indicatorAlphaDebug,{ scenarioEnabled:indicatorScenarioState.enabled,resolvedIssues:indicatorScenarioState.resolvedIssueIds.size,overallScore:results.overallDisplayScore,buildingSafety:results.categories.find((item)=>item.id==="CAT-BS").displayScore,communityEnvironment:results.categories.find((item)=>item.id==="CAT-CE").displayScore,unmetCount:results.unmet.length,categoryWeightTotal:Object.values(indicatorScenarioState.categoryWeights).reduce((sum,value)=>sum+value,0) });
    }

    function indicatorSelect(indicatorId, options) {
      const indicator = indicatorById(indicatorId);
      indicatorState.selectedIndicatorId = indicator.id;
      if (options && options.showDetail) indicatorState.activeTab = "detail";
      indicatorRenderAll();
    }

    function indicatorSetTab(tab) {
      if (!["detail", "issues", "basis", "parameters"].includes(tab)) return;
      indicatorState.activeTab = tab;
      indicatorRenderAll();
    }

    function enterIndicatorScenarioMode() {
      if (indicatorScenarioState.enabled) return;
      indicatorScenarioState = createIndicatorScenarioState(true);
      indicatorState.activeTab = "parameters";
      indicatorRenderAll();
      showToast("已启动情景模拟；模拟结果不会覆盖基线", "success", 2600);
    }

    function resetIndicatorScenario(options) {
      indicatorScenarioState = createIndicatorScenarioState(Boolean(options && options.keepEnabled));
      const confirm = $("#indicatorExitConfirm");
      if (confirm) confirm.hidden = true;
      if (!(options && options.render === false) && indicatorInitialized) indicatorRenderAll();
    }

    function exitIndicatorScenarioMode(force) {
      if (!indicatorScenarioState.enabled) return;
      if (!force && indicatorScenarioState.modified) {
        $("#indicatorExitConfirm").hidden = false;
        return;
      }
      resetIndicatorScenario({ keepEnabled:false });
      indicatorState.activeTab = "detail";
      indicatorRenderAll();
      showToast("已退出情景模拟并恢复锁定基线", "success", 2400);
    }

    function updateCategoryWeight(categoryId,value) {
      if (!indicatorScenarioState.enabled) return;
      const next = clamp(Math.round(Number(value)),20,80);
      const other = categoryId === "CAT-BS" ? "CAT-CE" : "CAT-BS";
      indicatorScenarioState.categoryWeights[categoryId] = next;
      indicatorScenarioState.categoryWeights[other] = 100-next;
      indicatorScenarioState.modified = true;
      indicatorRenderAll();
    }

    function balancedIndicatorWeights(categoryId,indicatorId,value) {
      const ids = indicatorData.indicators.filter((item) => item.categoryId === categoryId).map((item) => item.id);
      const target = clamp(Math.round(Number(value)),5,60);
      const others = ids.filter((id) => id !== indicatorId);
      const remaining = 100-target;
      const baselineTotal = others.reduce((sum,id) => sum + indicatorBaselineState.indicatorWeights[id],0);
      const raw = others.map((id) => ({ id,value:remaining*indicatorBaselineState.indicatorWeights[id]/baselineTotal }));
      const assigned = {};
      raw.forEach((item) => { assigned[item.id] = clamp(Math.floor(item.value),5,60); });
      let residual = remaining-Object.values(assigned).reduce((sum,item)=>sum+item,0);
      const order = others.slice().reverse().map((id) => raw.find((item) => item.id === id));
      while (residual !== 0) {
        let changed = false;
        for (const item of order) {
          if (residual > 0 && assigned[item.id] < 60) { assigned[item.id] += 1; residual -= 1; changed = true; }
          else if (residual < 0 && assigned[item.id] > 5) { assigned[item.id] -= 1; residual += 1; changed = true; }
          if (residual === 0) break;
        }
        if (!changed) break;
      }
      assigned[indicatorId] = target;
      return assigned;
    }

    function updateIndicatorWeight(indicatorId,value) {
      if (!indicatorScenarioState.enabled) return;
      const indicator = indicatorById(indicatorId);
      Object.assign(indicatorScenarioState.indicatorWeights,balancedIndicatorWeights(indicator.categoryId,indicatorId,value));
      indicatorScenarioState.modified = true;
      indicatorRenderAll({ skipParameters:true });
      $$('[data-indicator-weight]',$("#indicatorSecondaryWeightControls")).forEach((input) => { input.value=indicatorScenarioState.indicatorWeights[input.dataset.indicatorWeight]; $("output",input.closest("label")).textContent=`${input.value}%`; });
    }

    function updateIndicatorThreshold(indicatorId,value) {
      if (!indicatorScenarioState.enabled) return;
      indicatorScenarioState.thresholds[indicatorId] = clamp(Math.round(Number(value)),60,95);
      indicatorScenarioState.modified = true;
      indicatorRenderAll();
    }

    function toggleScenarioIssue(issueId,resolved) {
      if (!indicatorScenarioState.enabled) return;
      if (resolved) indicatorScenarioState.resolvedIssueIds.add(issueId);
      else indicatorScenarioState.resolvedIssueIds.delete(issueId);
      indicatorScenarioState.modified = true;
      indicatorRenderAll();
    }

    function resetCurrentIndicatorRule() {
      if (!indicatorScenarioState.enabled) return;
      const indicator = indicatorById(indicatorState.selectedIndicatorId);
      Object.assign(indicatorScenarioState.indicatorWeights,balancedIndicatorWeights(indicator.categoryId,indicator.id,indicatorBaselineState.indicatorWeights[indicator.id]));
      indicatorScenarioState.thresholds[indicator.id] = indicatorBaselineState.thresholds[indicator.id];
      indicator.issueIds.forEach((mapId) => indicatorScenarioState.resolvedIssueIds.delete(mapId));
      indicatorScenarioState.modified = true;
      indicatorRenderAll();
    }

    function resetAllIndicatorRules() {
      resetIndicatorScenario({ keepEnabled:true });
      showToast("已恢复默认规则、82.4基线和3项未达标", "success", 2600);
    }

    function indicatorLocateInGIS(mapId) {
      const issue = gisIssueData.find((item) => item.mapId === mapId);
      if (!issue) return;
      indicatorState.lastLocatedMapId = mapId;
      closeIndicatorWorkspace().then(openGISWorkspace).then((opened) => {
        if (opened === false) return;
        appState.activeViewStage = 3;
        gisState.activeTab = "detail";
        gisSelectIssue(mapId, { center: true, scroll: true });
        gisRenderAll();
        renderStageNavigation();
        showToast(`${mapId}已在04 GIS工作台中定位；05指标选择已保留`, "success", 2800);
      });
    }

    function bindIndicatorEvents() {
      if (indicatorWorkspace.dataset.eventsBound === "true") return;
      indicatorWorkspace.dataset.eventsBound = "true";
      $("#indicatorTree").addEventListener("click", (event) => {
        const item = event.target.closest("[data-indicator-id]");
        const category = event.target.closest("[data-indicator-category]");
        if (item) indicatorSelect(item.dataset.indicatorId, { showDetail: true });
        else if (category) { indicatorState.categoryFocus = indicatorState.categoryFocus === category.dataset.indicatorCategory ? "all" : category.dataset.indicatorCategory; indicatorRenderAll(); }
      });
      $("#indicatorUnmetList").addEventListener("click", (event) => { const item = event.target.closest("[data-indicator-id]"); if (item) indicatorSelect(item.dataset.indicatorId, { showDetail: true }); });
      $$(".indicator-category-scores button").forEach((button) => button.addEventListener("click", () => { indicatorState.categoryFocus = button.dataset.indicatorCategory; const first = indicatorData.indicators.find((item) => item.categoryId === indicatorState.categoryFocus); if (first) indicatorState.selectedIndicatorId = first.id; indicatorRenderAll(); }));
      $$("[data-indicator-tab]").forEach((button) => button.addEventListener("click", () => indicatorSetTab(button.dataset.indicatorTab)));
      $("#indicatorSearchInput").addEventListener("input", (event) => { indicatorState.search = event.target.value; indicatorRenderTree(); });
      $$("[data-indicator-status]").forEach((button) => button.addEventListener("click", () => { indicatorState.statusFilter = button.dataset.indicatorStatus; indicatorRenderAll(); }));
      $("#indicatorIssueRiskFilter").addEventListener("change", (event) => { indicatorState.issueRiskFilter = event.target.value; indicatorRenderDetail(); });
      $("#indicatorIssueTypeFilter").addEventListener("change", (event) => { indicatorState.issueTypeFilter = event.target.value; indicatorRenderDetail(); });
      $("#indicatorIssueList").addEventListener("click", (event) => { const locate = event.target.closest("[data-indicator-locate]"); if (locate) indicatorLocateInGIS(locate.dataset.indicatorLocate); });
      $("#indicatorIssueList").addEventListener("change", (event) => { const checkbox=event.target.closest("[data-indicator-resolve]"); if (checkbox) toggleScenarioIssue(checkbox.dataset.indicatorResolve,checkbox.checked); });
      $("#indicatorBaselineModeButton").addEventListener("click", () => exitIndicatorScenarioMode(false));
      $("#indicatorScenarioModeButton").addEventListener("click", enterIndicatorScenarioMode);
      $("#indicatorBuildingWeight").addEventListener("input", (event) => updateCategoryWeight("CAT-BS",event.target.value));
      $("#indicatorCommunityWeight").addEventListener("input", (event) => updateCategoryWeight("CAT-CE",event.target.value));
      $("#indicatorSecondaryWeightControls").addEventListener("input", (event) => { const input=event.target.closest("[data-indicator-weight]"); if(input) updateIndicatorWeight(input.dataset.indicatorWeight,input.value); });
      $("#indicatorThresholdControl").addEventListener("input", (event) => updateIndicatorThreshold(indicatorState.selectedIndicatorId,event.target.value));
      $("#indicatorResolveVisibleIssues").addEventListener("click", () => { const indicator=indicatorById(indicatorState.selectedIndicatorId); indicator.issueIds.forEach((mapId)=>indicatorScenarioState.resolvedIssueIds.add(mapId)); indicatorScenarioState.modified=true; indicatorRenderAll(); });
      $("#indicatorClearResolvedIssues").addEventListener("click", () => { const indicator=indicatorById(indicatorState.selectedIndicatorId); indicator.issueIds.forEach((mapId)=>indicatorScenarioState.resolvedIssueIds.delete(mapId)); indicatorScenarioState.modified=true; indicatorRenderAll(); });
      $("#indicatorResetCurrentRule").addEventListener("click", resetCurrentIndicatorRule);
      $("#indicatorResetAllRules").addEventListener("click", resetAllIndicatorRules);
      $("#indicatorExitScenario").addEventListener("click", () => exitIndicatorScenarioMode(false));
      $("#indicatorExitCancel").addEventListener("click", () => { $("#indicatorExitConfirm").hidden=true; });
      $("#indicatorExitConfirmButton").addEventListener("click", () => exitIndicatorScenarioMode(true));
      $("#indicatorBackButton").addEventListener("click", () => { manualAction(); resetIndicatorScenario({ render:false }); closeIndicatorWorkspace().then(() => completeReturnToMap("已返回西安市城市项目总览")); });
      $("#indicatorCloseButton").addEventListener("click", () => { manualAction(); resetIndicatorScenario({ render:false }); closeIndicatorWorkspace().then(() => completeReturnToMap("指标核算工作台已关闭")); });
    }

    function initializeIndicatorWorkspace() {
      if (indicatorInitialized) return true;
      const requiredIds = ["indicatorWorkspace", "indicatorBackButton", "indicatorCloseButton", "indicatorTree", "indicatorUnmetList", "indicatorContributionList", "indicatorIssueList", "indicatorBasisContent", "indicatorScenarioModeButton", "indicatorSecondaryWeightControls", "indicatorThresholdControl", "indicatorExitConfirm", "indicatorDemoCompletion"];
      const missing = requiredIds.filter((id) => !document.getElementById(id));
      if (missing.length) {
        runtimeDiagnosticError(new Error("05工作台DOM缺失: " + missing.join(", ")), "05惰性初始化");
        return false;
      }
      try {
        validateIndicatorData();
        bindIndicatorEvents();
        indicatorRenderAll();
        indicatorInitialized = true;
        window.__indicatorAlphaDebug.initialized = true;
        runtimeDiagnosticStep("05模块惰性初始化完成", "2类一级指标、10项二级指标及42项问题映射已就绪");
        return true;
      } catch (error) {
        runtimeDiagnosticError(error, "05惰性初始化");
        return false;
      }
    }

    function openIndicatorWorkspace() {
      if (!initializeIndicatorWorkspace()) {
        showToast("05模块初始化失败，01—04及全局导航仍可继续使用", "warning", 3200);
        return Promise.resolve(false);
      }
      if (motion.indicator.state === "open" || motion.indicator.state === "opening") return motion.indicator.promise;
      if (motion.indicator.state === "closing") return motion.indicator.promise.then(openIndicatorWorkspace);
      if (!appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      const token = ++motion.indicator.token;
      motion.indicator.state = "opening";
      syncMotionDebug();
      motion.indicator.promise = (async () => {
        if (appState.workspaceOpen) await closeWorkspace();
        if (appState.aiRecognitionWorkspaceOpen) await closeAIRecognitionWorkspace();
        if (appState.humanReviewWorkspaceOpen) await closeHumanReviewWorkspace();
        if (appState.gisWorkspaceOpen) await closeGISWorkspace();
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.indicator.token) return;
        setBackdrop("closed");
        appState.indicatorWorkspaceOpen = true;
        appState.activeModuleIndex = 4;
        appState.activeViewStage = 4;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = 4;
        appState.rightDrawerOpen = false;
        const project = cityProjects.find((item) => item.id === appState.activeProjectId) || cityProjects[0];
        $("#indicatorProjectName").textContent = project.name;
        indicatorWorkspace.classList.remove("is-closing", "is-settled");
        indicatorWorkspace.classList.add("is-opening");
        indicatorWorkspace.setAttribute("aria-hidden", "false");
        indicatorRenderAll();
        await nextPaint();
        if (token !== motion.indicator.token) return;
        appStage.classList.add("indicator-workspace-active");
        indicatorWorkspace.classList.add("is-open");
        await waitForVisualEnd(indicatorWorkspace, { property: "transform" });
        if (token !== motion.indicator.token) return;
        indicatorWorkspace.classList.remove("is-opening");
        indicatorWorkspace.classList.add("is-settled");
        motion.indicator.state = "open";
        syncMotionDebug("indicator-open-complete");
        syncDebug();
      })();
      return motion.indicator.promise;
    }

    function closeIndicatorWorkspace() {
      if (!indicatorWorkspace || motion.indicator.state === "closed") return Promise.resolve();
      if (motion.indicator.state === "closing") return motion.indicator.promise;
      if (motion.indicator.state === "opening") return motion.indicator.promise.then(closeIndicatorWorkspace);
      const token = ++motion.indicator.token;
      motion.indicator.state = "closing";
      syncMotionDebug();
      motion.indicator.promise = (async () => {
        indicatorWorkspace.classList.remove("is-settled", "is-opening");
        indicatorWorkspace.classList.add("is-closing");
        appStage.classList.remove("indicator-workspace-active");
        await nextPaint();
        indicatorWorkspace.classList.remove("is-open");
        await waitForVisualEnd(indicatorWorkspace, { property: "transform" });
        if (token !== motion.indicator.token) return;
        indicatorWorkspace.classList.remove("is-closing");
        indicatorWorkspace.setAttribute("aria-hidden", "true");
        appState.indicatorWorkspaceOpen = false;
        if (appState.activeWorkspaceStage === 4) appState.activeWorkspaceStage = null;
        motion.indicator.state = "closed";
        syncMotionDebug("indicator-close-complete");
        syncDebug();
      })();
      return motion.indicator.promise;
    }

    function reportEscape(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }

    function reportClone(value) { return JSON.parse(JSON.stringify(value)); }

    function reportDraftKey(type = reportWorkbenchState.reportType, topic = reportWorkbenchState.specialTopic) {
      return type === "special" ? `special:${topic}` : type;
    }

    function reportCurrentTemplate() {
      return reportBaselineState.templates[reportWorkbenchState.reportType] || reportBaselineState.templates.comprehensive;
    }

    function reportSpecialBlocks(page, topic = reportWorkbenchState.specialTopic, type = reportWorkbenchState.reportType) {
      if (type !== "special" || topic !== "community") return reportClone(page.blocks);
      return page.blocks.map(([label, value]) => {
        if (label === "专项主题") return [label, "社区环境"];
        if (label === "建筑安全") return ["社区环境", "84"];
        if (label === "关联问题") return [label, "19项"];
        if (label === "未达标指标") return [label, "1项"];
        if (label === "IND-BS-02") return ["IND-CE-01", "76"];
        if (label === "IND-BS-03") return ["重点方向", "公共空间与环境品质"];
        if (label === "高风险问题") return ["专项问题", "社区环境问题19项"];
        return [label, value];
      });
    }

    function reportDefaultComponents(pageId) {
      const all = Object.fromEntries(REPORT_COMPONENTS.map(([key]) => [key, false]));
      all.coreMetrics = true;
      all.sourceNote = true;
      all.disclaimer = true;
      if (["RPT-03", "RPT-05", "RPT-SPATIAL-02"].includes(pageId)) all.riskChart = true;
      if (["RPT-03", "RPT-04", "RPT-SPEC-02", "RPT-SPEC-03"].includes(pageId)) all.indicatorBars = true;
      if (["RPT-05", "RPT-SPEC-03", "RPT-SPATIAL-02"].includes(pageId)) all.issueDistribution = true;
      if (["RPT-06", "RPT-SPEC-04", "RPT-SPATIAL-02", "RPT-SPATIAL-03", "RPT-SPATIAL-04", "RPT-SPATIAL-05"].includes(pageId)) all.gisMap = true;
      if (["RPT-02", "RPT-05", "RPT-SPEC-03"].includes(pageId)) all.fieldImage = true;
      if (["RPT-04", "RPT-SPEC-03"].includes(pageId)) all.unmetTable = true;
      if (["RPT-08", "RPT-SPEC-05", "RPT-SPATIAL-06"].includes(pageId)) all.evidenceChain = true;
      return all;
    }

    function reportDefaultText(page) {
      return {
        title: page.title,
        subtitle: page.kicker,
        summary: `本页汇集“${page.title}”相关的本地演示数据与阶段成果，展示当前报告草稿的结构化表达。`,
        conclusion: page.pageId.includes("07") ? "Demo预置建议方向，不代表正式整改批复。" : "本页结论仅用于Demo报告草稿展示，不构成正式行政结论。"
      };
    }

    function reportMakeDraft(type = reportWorkbenchState.reportType, topic = reportWorkbenchState.specialTopic) {
      const template = reportBaselineState.templates[type] || reportBaselineState.templates.comprehensive;
      const project = projectById(appState.activeProjectId) || cityProjects[0];
      const topicLabel = type === "special" ? (topic === "building" ? "建筑安全" : "社区环境") : "";
      const draft = {
        type, topic,
        metadata: {
          title: type === "comprehensive" ? `${project.name}城市数智体检综合报告` : `${project.name}${topicLabel || "空间问题"}分析报告`,
          subtitle: template.subtitle,
          date: "2026-07-16",
          version: "Demo Draft V1.0",
          note: "基于01—05阶段锁定成果形成的Demo报告草稿，不代表正式行政成果。",
          footer: "城市数智体检Demo"
        },
        pageOrder: template.pages.map((page) => page.pageId),
        pageEnabled: Object.fromEntries(template.pages.map((page) => [page.pageId, true])),
        pageContent: {},
        pageBlocks: {},
        pageLayouts: {},
        overflow: {}
      };
      template.pages.forEach((page) => {
        draft.pageContent[page.pageId] = reportDefaultText(page);
        draft.pageBlocks[page.pageId] = reportDefaultComponents(page.pageId);
        draft.pageLayouts[page.pageId] = (REPORT_PAGE_LAYOUTS[page.pageId] || REPORT_PAGE_LAYOUTS.default)[0][0];
        draft.overflow[page.pageId] = false;
      });
      return draft;
    }

    function reportCurrentDraft(create = true) {
      const key = reportDraftKey();
      if (!reportDraftState.drafts[key] && create) reportDraftState.drafts[key] = reportMakeDraft();
      return reportDraftState.drafts[key] || null;
    }

    function reportBaselinePageById(pageId) { return reportCurrentTemplate().pages.find((page) => page.pageId === pageId) || null; }

    function reportVisiblePages() {
      const template = reportCurrentTemplate();
      if (reportWorkbenchState.mode !== "draft") return template.pages.map((page) => ({ ...page, blocks: reportSpecialBlocks(page) }));
      const draft = reportCurrentDraft();
      return draft.pageOrder.filter((pageId) => draft.pageEnabled[pageId]).map((pageId) => {
        const baseline = template.pages.find((page) => page.pageId === pageId);
        return { ...baseline, ...draft.pageContent[pageId], blocks: reportSpecialBlocks(baseline), components: draft.pageBlocks[pageId], layout: draft.pageLayouts[pageId] };
      });
    }

    function reportCurrentPage() {
      const pages = reportVisiblePages();
      reportWorkbenchState.pageIndex = clamp(reportWorkbenchState.pageIndex, 0, Math.max(0, pages.length - 1));
      return pages[reportWorkbenchState.pageIndex] || pages[0];
    }

    function reportPageModified(pageId, draft = reportCurrentDraft(false)) {
      if (!draft) return false;
      const defaults = reportMakeDraft(draft.type, draft.topic);
      return JSON.stringify(draft.pageContent[pageId]) !== JSON.stringify(defaults.pageContent[pageId])
        || JSON.stringify(draft.pageBlocks[pageId]) !== JSON.stringify(defaults.pageBlocks[pageId])
        || draft.pageLayouts[pageId] !== defaults.pageLayouts[pageId]
        || draft.pageEnabled[pageId] !== defaults.pageEnabled[pageId]
        || draft.pageOrder.indexOf(pageId) !== defaults.pageOrder.indexOf(pageId);
    }

    function reportChangeSummary(draft = reportCurrentDraft(false)) {
      if (!draft) return { count: 0, items: [], pages: new Set() };
      const defaults = reportMakeDraft(draft.type, draft.topic);
      let count = 0;
      const items = [];
      const pages = new Set();
      const metaChanges = Object.keys(draft.metadata).filter((key) => draft.metadata[key] !== defaults.metadata[key]);
      count += metaChanges.length;
      if (metaChanges.length) items.push(`${metaChanges.length}项元信息已修改`);
      const disabled = draft.pageOrder.filter((id) => !draft.pageEnabled[id]);
      count += disabled.length;
      if (disabled.length) items.push(`${disabled.length}个章节未纳入`);
      if (draft.pageOrder.join("|") !== defaults.pageOrder.join("|")) { count += 1; items.push("章节顺序已调整"); }
      let contentCount = 0, blockCount = 0, layoutCount = 0;
      draft.pageOrder.forEach((id) => {
        const fields = Object.keys(draft.pageContent[id]).filter((key) => draft.pageContent[id][key] !== defaults.pageContent[id][key]);
        const blocks = Object.keys(draft.pageBlocks[id]).filter((key) => draft.pageBlocks[id][key] !== defaults.pageBlocks[id][key]);
        if (fields.length || blocks.length || draft.pageLayouts[id] !== defaults.pageLayouts[id] || draft.pageEnabled[id] !== defaults.pageEnabled[id]) pages.add(id);
        contentCount += fields.length;
        blockCount += blocks.length;
        if (draft.pageLayouts[id] !== defaults.pageLayouts[id]) layoutCount += 1;
      });
      count += contentCount + blockCount + layoutCount;
      if (contentCount) items.push(`${contentCount}项章节文案已修改`);
      if (blockCount) items.push(`${blockCount}个页面组件已变更`);
      if (layoutCount) items.push(`${layoutCount}页布局已调整`);
      return { count, items, pages };
    }

    function reportRenderCatalog() {
      const order = ["comprehensive", "special", "spatial"];
      $("#reportTypeList").innerHTML = order.map((key) => {
        const item = reportTemplateData[key];
        const related = Object.entries(reportDraftState.drafts).filter(([draftKey]) => draftKey === key || draftKey.startsWith(`${key}:`));
        const changes = related.reduce((sum, [, draft]) => sum + reportChangeSummary(draft).count, 0);
        return `<button type="button" class="${key === reportWorkbenchState.reportType ? "is-current" : ""}" data-report-type="${key}"><span>${item.reportId}</span><b>${item.title}</b><i>${item.pageCount}页${changes ? ` · 已修改${changes}项` : " · 标准样张"}</i></button>`;
      }).join("");
      $("#reportSpecialTopic").hidden = reportWorkbenchState.reportType !== "special";
      $$('[data-report-topic]').forEach((button) => button.classList.toggle("is-current", button.dataset.reportTopic === reportWorkbenchState.specialTopic));
      const template = reportCurrentTemplate();
      const visible = reportVisiblePages();
      const current = reportCurrentPage();
      if (reportWorkbenchState.mode !== "draft") {
        $("#reportPageList").innerHTML = visible.map((page, index) => `<button type="button" class="${index === reportWorkbenchState.pageIndex ? "is-current" : ""}" data-report-page="${index}"><b>${String(index + 1).padStart(2, "0")}</b><span>${reportEscape(page.title)}</span><i>${page.pageId}</i></button>`).join("");
        return;
      }
      const draft = reportCurrentDraft();
      const required = REPORT_REQUIRED_PAGES[reportWorkbenchState.reportType];
      $("#reportPageList").innerHTML = draft.pageOrder.map((pageId, orderIndex) => {
        const baseline = template.pages.find((page) => page.pageId === pageId);
        const enabled = draft.pageEnabled[pageId];
        const pageNumber = enabled ? visible.findIndex((page) => page.pageId === pageId) + 1 : 0;
        const isCurrent = current && current.pageId === pageId;
        const modified = reportPageModified(pageId, draft);
        const isRequired = required.has(pageId);
        const moveLocked = orderIndex === 0 || orderIndex === draft.pageOrder.length - 1;
        return `<article class="report-page-row ${isCurrent ? "is-current" : ""} ${enabled ? "" : "is-disabled"} ${modified ? "is-modified" : ""}">
          <button type="button" class="report-page-select" data-report-page-id="${pageId}" ${enabled ? "" : "disabled"}><b>${enabled ? String(pageNumber).padStart(2, "0") : "--"}</b><span>${reportEscape(draft.pageContent[pageId].title)}</span><i>${pageId}</i></button>
          <div class="report-page-actions"><button type="button" data-report-page-toggle="${pageId}" ${isRequired ? "disabled title=\"必选章节不可停用\"" : ""}>${enabled ? "停用" : "纳入"}</button><button type="button" data-report-page-move="up" data-page-id="${pageId}" ${moveLocked || orderIndex <= 1 ? "disabled" : ""}>上移</button><button type="button" data-report-page-move="down" data-page-id="${pageId}" ${moveLocked || orderIndex >= draft.pageOrder.length - 2 ? "disabled" : ""}>下移</button><span class="${isRequired ? "report-required-badge" : enabled ? "" : "report-disabled-badge"}">${isRequired ? "必选" : enabled ? "" : "未纳入草稿"}</span></div>
        </article>`;
      }).join("");
    }

    function reportComponentMarkup(page, component, enabled) {
      if (!enabled) return "";
      if (component === "coreMetrics") return `<div class="report-page-metrics">${page.blocks.map(([label, value]) => `<article><span>${reportEscape(label)}</span><b>${reportEscape(value)}</b></article>`).join("")}</div>`;
      if (["riskChart", "indicatorBars", "issueDistribution"].includes(component)) return `<div class="report-page-chart" aria-label="${component}"><i style="height:64%"></i><i style="height:88%"></i><i style="height:76%"></i></div>`;
      if (component === "gisMap") return `<div class="report-page-map">项目边界 · 42项空间绑定 · 8类GIS图层</div>`;
      if (component === "fieldImage") return `<div class="report-page-photo" role="img" aria-label="典型现场影像"></div>`;
      if (component === "unmetTable") return `<div class="report-page-metrics"><article><span>IND-BS-02</span><b>79 · 未达标</b></article><article><span>IND-BS-03</span><b>72 · 未达标</b></article><article><span>IND-CE-01</span><b>76 · 未达标</b></article></div>`;
      if (component === "evidenceChain") return `<div class="report-page-evidence ${reportWorkbenchState.evidenceVisible ? "" : "is-hidden"}"><span>证据链</span><b>IMG-XA-001 → DEF-021 → MAP-021 → IND-BS-03 → ${page.pageId}</b></div>`;
      if (component === "sourceNote") return `<p class="report-page-source">数据来源：01—05阶段本地固定演示数据与Demo预置规则 V1.0。</p>`;
      if (component === "disclaimer") return `<p class="report-page-disclaimer">Demo预置报告草稿，不代表正式整改批复或行政结论。</p>`;
      return "";
    }

    function reportRenderPage() {
      const template = reportCurrentTemplate();
      const page = reportCurrentPage();
      if (!page) return;
      const project = projectById(appState.activeProjectId) || cityProjects[0];
      const pages = reportVisiblePages();
      const pageNumber = reportWorkbenchState.pageIndex + 1;
      const topicLabel = reportWorkbenchState.reportType === "special" ? (reportWorkbenchState.specialTopic === "building" ? " · 建筑安全" : " · 社区环境") : "";
      const a4 = $("#reportA4Page");
      if (reportWorkbenchState.mode === "baseline") {
        a4.className = "report-a4-page is-layout-split";
        a4.innerHTML = `<header><div><span>${template.reportId}${topicLabel}</span><b>城市数智体检 · ${template.title}</b></div><i>V0.1 / DRAFT</i></header><section class="report-page-title"><span>${page.kicker}</span><h2>${page.title}</h2><p>${project.name}</p></section><div class="report-page-visual"><div></div><span>${page.pageId}</span><b>${page.title}</b></div><div class="report-page-metrics">${page.blocks.map(([label, value]) => `<article><span>${label}</span><b>${value}</b></article>`).join("")}</div><section class="report-page-narrative"><h3>章节说明</h3><p>本页基于01—05阶段已锁定的本地演示数据编排，保留问题、空间、指标与报告节点的追溯关系；不连接在线数据源，也不生成正式行政结论。</p></section><div class="report-page-evidence ${reportWorkbenchState.evidenceVisible ? "" : "is-hidden"}"><span>证据链</span><b>IMG-XA-001 → DEF-021 → MAP-021 → IND-BS-03 → ${page.pageId}</b></div><footer><span>Demo预置报告样张｜非正式成果</span><b>${String(pageNumber).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}</b></footer>`;
      } else {
        const draft = reportCurrentDraft();
        const components = draft.pageBlocks[page.pageId];
        const componentHtml = REPORT_COMPONENTS.map(([key]) => reportComponentMarkup(page, key, components[key])).join("");
        a4.className = `report-a4-page is-layout-${draft.pageLayouts[page.pageId]} ${reportWorkbenchState.printPreview ? "report-print-preview" : ""}`;
        a4.innerHTML = `<header><div><span>${template.reportId}${topicLabel}</span><b>${reportEscape(draft.metadata.footer)}</b></div><i>${reportEscape(draft.metadata.version)} / 非正式成果</i></header><section class="report-page-title"><span>${reportEscape(page.subtitle)}</span><h2>${page.pageId.endsWith("01") ? reportEscape(draft.metadata.title || "（报告标题待填写）") : reportEscape(page.title)}</h2><p>${reportEscape(draft.metadata.subtitle || project.name)} · ${reportEscape(draft.metadata.date)}</p></section><section class="report-page-summary"><h3>章节摘要</h3><p>${reportEscape(page.summary)}</p></section>${componentHtml}<section class="report-page-conclusion"><h3>本页结论</h3><p>${reportEscape(page.conclusion)}</p></section><footer><span>${reportEscape(draft.metadata.footer)}｜Demo草稿｜非正式成果</span><b>${String(pageNumber).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}</b></footer>`;
      }
      a4.style.setProperty("--report-zoom", String(reportWorkbenchState.zoom / 100));
      $("#reportHeaderType").textContent = template.title + topicLabel;
      $("#reportHeaderPage").textContent = `${String(pageNumber).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`;
      $("#reportHeaderMode").textContent = reportWorkbenchState.mode === "draft" ? "草稿编辑" : "标准样张";
      $("#reportPageIndicator").textContent = `${pageNumber} / ${pages.length}`;
      $("#reportZoomValue").textContent = `${reportWorkbenchState.zoom}%`;
      $("#reportDetailId").textContent = page.pageId;
      $("#reportPreviousPage").disabled = pageNumber === 1;
      $("#reportNextPage").disabled = pageNumber === pages.length;
      $("#reportEvidenceToggle").classList.toggle("is-current", reportWorkbenchState.evidenceVisible);
      $("#reportBaselineMode").classList.toggle("is-current", reportWorkbenchState.mode === "baseline");
      $("#reportDraftMode").classList.toggle("is-current", reportWorkbenchState.mode === "draft");
      $("#reportPrintPreview").classList.toggle("is-current", reportWorkbenchState.printPreview);
      $("#reportDraftStatus").textContent = reportWorkbenchState.mode === "draft" ? `当前为Demo报告草稿 · 已修改 ${reportChangeSummary().count} 项` : "标准样张 · 只读";
      reportWorkspace.classList.toggle("is-print-preview", reportWorkbenchState.printPreview);
      requestAnimationFrame(() => reportCheckOverflow(page.pageId));
    }

    function reportRenderSources() {
      const sources = [
        ["项目基础资料", "01资料上传与治理", "项目资料 · 已本地化"], ["AI问题识别", "02 AI智能识别", "Demo预置 · 2026-07"],
        ["人工复核记录", "03人工复核", "项目资料 · 已完成"], ["GIS空间事实", "04 GIS落图与问题清单", "Demo预置空间数据"],
        ["指标核算结果", "05指标核算", "Demo预置规则 V1.0"], ["报告模板", "06报告生成", "本地固定HTML/CSS样张"]
      ];
      $("#reportSourceList").innerHTML = sources.map(([name, stage, type]) => `<article><span>${stage}</span><b>${name}</b><p>${type}</p><i>用于Demo展示，不代表实时政务数据</i></article>`).join("");
    }

    function reportCheckOverflow(pageId = reportCurrentPage().pageId) {
      const a4 = $("#reportA4Page");
      const draft = reportCurrentDraft(false);
      if (!a4 || reportWorkbenchState.mode !== "draft" || !draft) { if (a4) a4.classList.remove("is-overflowing"); return false; }
      const content = draft.pageContent[pageId];
      const textLoad = Object.values(content || {}).join("").length;
      const overflow = a4.scrollHeight > a4.clientHeight + 4 || textLoad > 620;
      draft.overflow[pageId] = overflow;
      a4.classList.toggle("is-overflowing", overflow);
      return overflow;
    }

    function reportValidateDraft(draft = reportCurrentDraft()) {
      const template = reportTemplateData[draft.type];
      const required = REPORT_REQUIRED_PAGES[draft.type];
      const visibleIds = draft.pageOrder.filter((id) => draft.pageEnabled[id]);
      const checks = [];
      const add = (name, status, message) => checks.push({ name, status, message });
      add("报告标题", draft.metadata.title.trim() ? "passed" : "blocking", draft.metadata.title.trim() ? "报告标题完整" : "报告标题不得为空");
      add("必选章节", [...required].every((id) => draft.pageEnabled[id]) ? "passed" : "blocking", "封面、核心结论和附录必须纳入草稿");
      add("页码连续", visibleIds.length > 0 ? "passed" : "blocking", `当前草稿共${visibleIds.length}页，显示页码按顺序重排`);
      add("报告ID唯一", new Set(Object.values(reportTemplateData).map((item) => item.reportId)).size === 3 ? "passed" : "blocking", "三类报告ID保持唯一");
      add("页面ID唯一", new Set(template.pages.map((page) => page.pageId)).size === template.pages.length ? "passed" : "blocking", "RPT页面业务编号保持唯一");
      const lockedText = template.pages.flatMap((page) => reportSpecialBlocks(page, draft.topic)).flat().join("|");
      add("关键数值", ["42", "82.4"].some((value) => lockedText.includes(value)) || draft.type !== "comprehensive" ? "passed" : "blocking", "锁定结果仍保存在只读数据对象中");
      add("未达标指标", draft.type !== "comprehensive" || ["IND-BS-02", "IND-BS-03", "IND-CE-01"].every((id) => lockedText.includes(id)) ? "passed" : "blocking", "3项未达标指标及分值完整");
      add("数据来源", $("#reportSourceList").children.length >= 6 ? "passed" : "blocking", "01—06来源登记完整");
      add("证据链", required.size >= 3 ? "passed" : "blocking", "IMG→DEF→MAP→IND→RPT链路闭合");
      const overflowCount = Object.values(draft.overflow).filter(Boolean).length;
      add("页面溢出", overflowCount ? "warning" : "passed", overflowCount ? `${overflowCount}页存在内容溢出，请缩短文字或关闭可选组件` : "当前未检测到严重内容溢出");
      add("非正式标记", "passed", "页眉与页脚固定保留非正式成果标记");
      const disabledCount = visibleIds.length < template.pages.length ? template.pages.length - visibleIds.length : 0;
      if (disabledCount) add("可选章节", "warning", `${disabledCount}个可选章节未纳入草稿`);
      const emptyNotes = Object.values(draft.pageContent).filter((page) => !page.summary.trim() || !page.conclusion.trim()).length;
      if (emptyNotes) add("章节文案", "warning", `${emptyNotes}页存在空白摘要或结论`);
      const counts = { passed: checks.filter((item) => item.status === "passed").length, warning: checks.filter((item) => item.status === "warning").length, blocking: checks.filter((item) => item.status === "blocking").length };
      const result = { checks, counts, valid: counts.blocking === 0 };
      reportDraftState.lastValidation = result;
      return result;
    }

    function reportRenderContentEditor() {
      const host = $("#reportContentEditor");
      if (reportWorkbenchState.mode !== "draft") {
        host.innerHTML = `<section class="report-editor-readonly"><b>标准样张 · 只读</b><p>当前内容与Alpha1 Hotfix1固定样张一致。进入“编辑报告草稿”后，可调整元信息、章节文案、页面组件与布局；草稿不会覆盖标准样张。</p></section>`;
        return;
      }
      const draft = reportCurrentDraft();
      const page = reportCurrentPage();
      const content = draft.pageContent[page.pageId];
      const components = draft.pageBlocks[page.pageId];
      const layouts = REPORT_PAGE_LAYOUTS[page.pageId] || REPORT_PAGE_LAYOUTS.default;
      const requiredComponents = REPORT_REQUIRED_COMPONENTS[page.pageId] || new Set();
      const meta = draft.metadata;
      host.innerHTML = `<section class="report-editor-section"><header><span>REPORT METADATA</span><b>报告元信息</b></header>
        <label>报告标题<input data-report-meta="title" maxlength="40" value="${reportEscape(meta.title)}"><small>${meta.title.length} / 40 · 不得为空</small></label>
        <label>报告副标题<input data-report-meta="subtitle" maxlength="60" value="${reportEscape(meta.subtitle)}"><small>${meta.subtitle.length} / 60</small></label>
        <div class="report-editor-grid"><label>报告日期<input type="date" data-report-meta="date" value="${reportEscape(meta.date)}"></label><label>报告版本<input data-report-meta="version" maxlength="28" value="${reportEscape(meta.version)}"></label></div>
        <label>编制说明<textarea data-report-meta="note" maxlength="120">${reportEscape(meta.note)}</textarea><small>${meta.note.length} / 120 · 始终标记非正式成果</small></label>
        <label>页脚短名称<input data-report-meta="footer" maxlength="24" value="${reportEscape(meta.footer)}"></label></section>
        <section class="report-editor-section"><header><span>PAGE CONTENT</span><b>${page.pageId} · 章节文案</b></header>
        <label>页面标题<input data-report-content="title" maxlength="40" value="${reportEscape(content.title)}"></label>
        <label>页面副标题<input data-report-content="subtitle" maxlength="60" value="${reportEscape(content.subtitle)}"></label>
        <label>页面摘要<textarea data-report-content="summary" maxlength="320">${reportEscape(content.summary)}</textarea></label>
        <label>本页结论<textarea data-report-content="conclusion" maxlength="320">${reportEscape(content.conclusion)}</textarea></label>
        <small>锁定数据：${REPORT_LOCKED_VALUES.join(" · ")}；MAP / DEF / IMG / IND / RPT编号不可编辑。</small></section>
        <section class="report-editor-section"><header><span>PAGE BLOCKS</span><b>页面组件</b></header><div class="report-block-list">${REPORT_COMPONENTS.map(([key, label]) => `<label class="${requiredComponents.has(key) ? "is-locked" : ""}"><input type="checkbox" data-report-block="${key}" ${components[key] ? "checked" : ""} ${requiredComponents.has(key) ? "disabled" : ""}><span>${label}${requiredComponents.has(key) ? " · 当前页面必需" : ""}</span></label>`).join("")}</div>
        <label>页面布局<select data-report-layout>${layouts.map(([value, label]) => `<option value="${value}" ${draft.pageLayouts[page.pageId] === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <div class="report-editor-actions"><button type="button" id="reportApplyPage">应用更新</button><button type="button" id="reportResetPage">恢复当前页默认值</button></div><p class="report-overflow-status">${draft.overflow[page.pageId] ? "检测到内容溢出：请缩短文字或关闭可选组件。" : "A4安全区：当前未检测到严重溢出。"}</p></section>`;
    }

    function reportRenderConfig() {
      const host = $("#reportConfigContent");
      if (reportWorkbenchState.mode !== "draft") {
        host.innerHTML = `<section class="report-config-card"><span>报告模式</span><b>标准样张 · 只读</b><p>固定3类报告、8 / 5 / 6页结构。进入编辑草稿后可编排章节；所有锁定业务数据保持不变。</p></section><dl class="report-config-list"><div><dt>报告类型</dt><dd>3类</dd></div><div><dt>当前报告</dt><dd>${reportEscape(reportCurrentTemplate().title)}</dd></div><div><dt>页数</dt><dd>${reportCurrentTemplate().pages.length}页</dd></div><div><dt>数据引用</dt><dd>01—05</dd></div><div><dt>草稿校验</dt><dd>阻断0项</dd></div><div><dt>有效问题</dt><dd>42项</dd></div><div><dt>GIS绑定</dt><dd>42 / 42</dd></div><div><dt>综合得分</dt><dd>82.4</dd></div></dl>${reportGenerationMarkup()}`;
        return;
      }
      const draft = reportCurrentDraft();
      const summary = reportChangeSummary(draft);
      const validation = reportValidateDraft(draft);
      const visible = draft.pageOrder.filter((id) => draft.pageEnabled[id]).length;
      host.innerHTML = `<section class="report-config-card"><span>当前为Demo报告草稿</span><b>不会覆盖标准样张</b><p>当前会话内保存；不连接服务器、不进入审批流程。</p></section><div class="report-config-summary"><article><span>当前页数</span><b>${visible}</b></article><article><span>已修改</span><b>${summary.count}</b></article><article><span>阻断项</span><b>${validation.counts.blocking}</b></article></div><div class="report-difference-list">${summary.items.length ? summary.items.map((item) => `<p>${reportEscape(item)}</p>`).join("") : "<p>当前草稿与标准样张一致</p>"}</div><section class="report-validation"><header><b>草稿校验</b><button type="button" id="reportRunValidation">重新校验</button></header><div class="report-validation-counts"><span>通过<b>${validation.counts.passed}</b></span><span class="is-warning">警告<b>${validation.counts.warning}</b></span><span class="is-blocking">阻断<b>${validation.counts.blocking}</b></span></div><div class="report-validation-list">${validation.checks.map((item) => `<p class="is-${item.status}">${reportEscape(item.name)}：${reportEscape(item.message)}</p>`).join("")}</div><small>Demo草稿结构校验，不代表正式合规审查。</small></section><div class="report-config-actions"><button type="button" id="reportResetCurrentDraft">恢复整份标准样张</button><button type="button" id="reportClearAllDrafts">清除全部报告草稿</button><button type="button" id="reportConfigPrintPreview">${reportWorkbenchState.printPreview ? "退出打印预览" : "打印预览样式"}</button><button type="button" disabled>保存为正式版本 · 后续版本</button></div>${reportGenerationMarkup()}`;
    }

    function reportRenderTraceNotice() {
      const notice = $("#reportTraceReinclude");
      notice.hidden = !reportWorkbenchState.pendingTracePageId;
      if (!notice.hidden) notice.querySelector("span").textContent = `${reportWorkbenchState.pendingTracePageId} 该页面当前未纳入草稿`;
    }

    function reportGenerationStatusText(status) {
      return ({ idle: "报告草稿预览", validating: "正在校验报告草稿", generating: "正在生成Demo报告包", completed: "Demo报告包已生成", stale: "草稿已变更，请重新生成", failed: "生成失败，请检查草稿" })[status] || "报告草稿预览";
    }

    function reportCurrentRevisionToken() {
      const key = reportDraftKey();
      const value = reportWorkbenchState.mode === "draft" ? reportCurrentDraft() : reportMakeDraft();
      return JSON.stringify({ key, mode: reportWorkbenchState.mode, value });
    }

    function createGeneratedReportSnapshot(options = {}) {
      const type = options.reportType || reportWorkbenchState.reportType;
      const topic = options.specialTopic || reportWorkbenchState.specialTopic;
      const sourceMode = options.sourceMode || reportWorkbenchState.mode;
      const template = reportTemplateData[type];
      const sourceDraft = sourceMode === "draft" && !options.demo ? reportCurrentDraft() : reportMakeDraft(type, topic);
      const visibleIds = sourceDraft.pageOrder.filter((pageId) => sourceDraft.pageEnabled[pageId]);
      const createdAt = options.demo ? "2026-07-16T10:00:00.000Z" : new Date().toISOString();
      const snapshotId = options.demo ? "SNAP-DEMO-RPT-COMP-01" : `SNAP-${template.reportId}-${Date.now().toString(36).toUpperCase()}`;
      const pages = visibleIds.map((pageId, index) => {
        const baseline = template.pages.find((page) => page.pageId === pageId);
        const content = reportClone(sourceDraft.pageContent[pageId]);
        return {
          pageId, displayPage: index + 1, title: content.title, subtitle: content.subtitle,
          summary: content.summary, conclusion: content.conclusion,
          dataBlocks: reportSpecialBlocks(baseline, topic, type), components: reportClone(sourceDraft.pageBlocks[pageId]),
          layout: sourceDraft.pageLayouts[pageId], evidence: ["IMG-XA-001", "DEF-021", "MAP-021", "IND-BS-03", pageId]
        };
      });
      return reportClone({
        snapshotId, createdAt, sourceMode, reportType: type, specialTopic: topic,
        reportId: template.reportId, reportTitle: template.title, metadata: sourceDraft.metadata,
        pages, pageCount: pages.length, draftRevision: options.demo ? "DEMO-STANDARD" : reportCurrentRevisionToken(),
        businessData: { completeness: "96%", aiCandidates: 43, reviewed: "43 / 43", validIssues: 42, excluded: 1, risk: "6 / 18 / 18", gisBinding: "42 / 42", gisLayers: 8, buildingSafety: 78, communityEnvironment: 84, overallScore: 82.4, unmetCount: 3, unmet: [{ id: "IND-BS-02", score: 79 }, { id: "IND-BS-03", score: 72 }, { id: "IND-CE-01", score: 76 }] },
        sources: ["01资料上传与治理", "02 AI智能识别", "03人工复核", "04 GIS落图与问题清单", "05指标核算"],
        evidenceIds: ["IMG-XA-001", "DEF-021", "MAP-021", "IND-BS-03", ...pages.map((page) => page.pageId)],
        fileTypes: ["self-contained-html", "word-compatible-doc", "browser-print-pdf", "report-manifest-json"],
        declaration: "Demo预置报告｜非正式成果",
        imageSource: aiRecognitionData.images[0].file
      });
    }

    function reportMarkGenerationStale() {
      if (!["completed", "stale", "generating"].includes(reportGenerationState.status) || !reportGenerationState.generatedSnapshot) return;
      const sameReport = reportGenerationState.reportType === reportWorkbenchState.reportType && reportGenerationState.specialTopic === reportWorkbenchState.specialTopic;
      if (!sameReport) return;
      reportGenerationState.draftChangedAfterGeneration = true;
      if (reportGenerationState.status !== "generating") reportGenerationState.status = "stale";
      if (reportWorkspaceInitialized) { reportRenderConfig(); reportRenderGenerationFooter(); }
    }

    function clearReportGenerationTimers() {
      reportGenerationState.timerIds.forEach((timerId) => window.clearTimeout(timerId));
      reportGenerationState.timerIds.length = 0;
    }

    function resetReportGenerationState(options = {}) {
      clearReportGenerationTimers();
      Object.assign(reportGenerationState, { status: "idle", sourceMode: "baseline", reportType: "comprehensive", specialTopic: "building", snapshotId: null, snapshotCreatedAt: null, progress: 0, currentStep: null, generatedPages: 0, generatedFiles: [], generatedSnapshot: null, draftRevisionAtGeneration: null, draftChangedAfterGeneration: false, validation: { passed: 0, warnings: 0, blocking: 0 }, viewingSnapshot: false, completionVisible: false });
      const viewer = $("#reportGeneratedViewer");
      if (viewer) viewer.hidden = true;
      const printSurface = $("#reportPrintSurface");
      if (printSurface) printSurface.innerHTML = "";
      if (options.render !== false && reportWorkspaceInitialized) reportRenderAll();
    }

    function resetDemoReportGenerationState(options = {}) {
      Object.assign(demoReportGenerationState, { active: false, status: "idle", progress: 0, currentStep: null, generatedSnapshot: null, outputReady: false, completionVisible: false, lastRenderedProgress: -1, validation: { passed: 11, warnings: 0, blocking: 0 } });
      const summary = $("#reportSixStageSummary");
      if (summary) summary.hidden = true;
      if (options.render && reportWorkspaceInitialized) { reportRenderConfig(); reportRenderGenerationFooter(); }
    }

    function reportActiveGenerationState() {
      return demoReportGenerationState.active ? demoReportGenerationState : reportGenerationState;
    }

    function reportGenerationMarkup() {
      const state = reportActiveGenerationState();
      const snapshot = state.generatedSnapshot;
      const outputReady = state === demoReportGenerationState ? state.outputReady : state.status === "completed" || state.status === "stale";
      const progress = Math.round(state.progress || 0);
      const currentIndex = REPORT_GENERATION_STEPS.findIndex(([threshold]) => progress <= threshold);
      const stepMarkup = REPORT_GENERATION_STEPS.map(([threshold, label], index) => `<p class="${progress >= threshold ? "is-complete" : index === currentIndex && state.status === "generating" ? "is-active" : ""}"><b>0${index + 1}</b><span>${label}</span><i>${progress >= threshold ? "完成" : index === currentIndex && state.status === "generating" ? "进行中" : "待执行"}</i></p>`).join("");
      const result = snapshot ? `<div class="report-generation-result"><div><span>报告类型</span><b>${reportEscape(snapshot.reportTitle)}</b></div><div><span>报告ID</span><b>${snapshot.reportId}</b></div><div><span>报告页数</span><b>${snapshot.pageCount}页</b></div><div><span>引用阶段</span><b>01—05</b></div><div><span>有效问题</span><b>42项</b></div><div><span>指标结果</span><b>10项 · 82.4</b></div><div><span>证据节点</span><b>${snapshot.evidenceIds.length}个</b></div><div><span>快照版本</span><b>${snapshot.snapshotId}</b></div></div>` : "";
      const validation = state.validation || { passed: 0, warnings: 0, blocking: 0 };
      const primaryLabel = state.status === "stale" || outputReady ? "重新生成Demo报告包" : "生成Demo报告包";
      return `<section class="report-generation-card"><header><div><span>REPORT PACKAGE</span><b>${reportGenerationStatusText(state.status)}</b></div><i>${progress}%</i></header><div class="report-generation-progress" style="--generation-progress:${progress}%"><i></i></div>${state.status === "generating" || state.status === "completed" || state.status === "stale" ? `<div class="report-generation-steps">${stepMarkup}</div>` : ""}${result}${state.completionVisible ? `<section class="report-config-card"><span>06 REPORT GENERATION COMPLETE</span><b>06 报告生成已完成 · 六阶段体检完成</b><p>报告快照与离线输出已经就绪。</p></section>` : ""}<p class="report-generation-note ${state.status === "stale" ? "is-stale" : ""}">${state.status === "stale" ? "当前输出来自上一生成快照；草稿已变更，请重新生成。" : "Demo预置报告｜非正式成果 · 草稿校验：通过" + validation.passed + " / 警告" + validation.warnings + " / 阻断" + validation.blocking}</p><button class="report-generate-primary" id="reportGeneratePackage" type="button" ${state.status === "generating" || demoReportGenerationState.active ? "disabled" : ""}>${primaryLabel}</button><div class="report-output-actions"><button id="reportDownloadHtml" type="button" ${outputReady ? "" : "disabled"}>下载HTML报告</button><button id="reportDownloadWord" type="button" ${outputReady ? "" : "disabled"}>导出Word兼容稿</button><button id="reportPrintPdf" type="button" ${outputReady ? "" : "disabled"}>打印／另存为PDF</button><button id="reportDownloadManifest" type="button" ${outputReady ? "" : "disabled"}>下载报告清单</button></div><div class="report-disabled-actions"><button type="button" disabled>批量生成 · 后续版本</button><button type="button" disabled>原生DOCX · 后续版本</button></div></section>`;
    }

    function reportRenderGenerationFooter() {
      const state = reportActiveGenerationState();
      const snapshotReady = Boolean(state.generatedSnapshot && (["completed", "stale"].includes(state.status) || state.outputReady));
      $("#reportGenerationFooterStatus").textContent = state.status === "stale" ? "草稿已变更 · 当前输出来自上一生成快照" : `${reportGenerationStatusText(state.status)}${state.currentStep ? ` · ${state.currentStep}` : ""}`;
      $("#reportViewGenerated").disabled = !snapshotReady;
      $("#reportRegeneratePackage").disabled = state.status === "generating" || demoReportGenerationState.active;
      $("#reportRegeneratePackage").textContent = snapshotReady ? "重新生成报告包" : "生成Demo报告包";
    }

    function reportCompleteManualGeneration() {
      reportGenerationState.progress = 100;
      reportGenerationState.currentStep = REPORT_GENERATION_STEPS[4][1];
      reportGenerationState.generatedPages = reportGenerationState.generatedSnapshot.pageCount;
      reportGenerationState.generatedFiles = ["html", "doc", "print-pdf", "manifest-json"];
      reportGenerationState.status = reportGenerationState.draftChangedAfterGeneration ? "stale" : "completed";
      reportGenerationState.completionVisible = appState.workflowCompletedThrough >= 4;
      if (appState.workflowCompletedThrough >= 4) setWorkflowStage(null, 5, false);
      else { appState.workflowCurrentStage = 5; renderStageNavigation(); }
      reportRenderAll();
      showToast("Demo报告包已生成，离线输出已就绪", "success", 2600);
    }

    function startManualReportGeneration(validation) {
      clearReportGenerationTimers();
      reportGenerationState.status = "generating";
      reportGenerationState.sourceMode = reportWorkbenchState.mode;
      reportGenerationState.reportType = reportWorkbenchState.reportType;
      reportGenerationState.specialTopic = reportWorkbenchState.specialTopic;
      reportGenerationState.progress = 0;
      reportGenerationState.currentStep = "准备";
      reportGenerationState.generatedSnapshot = createGeneratedReportSnapshot();
      reportGenerationState.snapshotId = reportGenerationState.generatedSnapshot.snapshotId;
      reportGenerationState.snapshotCreatedAt = reportGenerationState.generatedSnapshot.createdAt;
      reportGenerationState.draftRevisionAtGeneration = reportGenerationState.generatedSnapshot.draftRevision;
      reportGenerationState.draftChangedAfterGeneration = false;
      reportGenerationState.completionVisible = false;
      reportGenerationState.validation = { passed: validation.counts.passed, warnings: validation.counts.warning, blocking: validation.counts.blocking };
      reportRenderAll();
      const schedule = [[360,20,0],[900,40,1],[1500,65,2],[2200,85,3],[2950,100,4]];
      schedule.forEach(([delay, progress, index]) => reportGenerationState.timerIds.push(window.setTimeout(() => {
        if (reportGenerationState.status !== "generating") return;
        reportGenerationState.progress = progress;
        reportGenerationState.currentStep = REPORT_GENERATION_STEPS[index][1];
        if (progress === 100) reportCompleteManualGeneration();
        else { reportRenderConfig(); reportRenderGenerationFooter(); }
      }, delay)));
    }

    function requestGenerateReportPackage() {
      if (reportGenerationState.status === "generating" || demoReportGenerationState.active) return;
      const validationDraft = reportWorkbenchState.mode === "draft" ? reportCurrentDraft() : reportMakeDraft();
      const validation = reportValidateDraft(validationDraft);
      reportGenerationState.status = "validating";
      reportGenerationState.validation = { passed: validation.counts.passed, warnings: validation.counts.warning, blocking: validation.counts.blocking };
      reportWorkbenchState.activeTab = "config";
      reportRenderAll();
      if (validation.counts.blocking > 0) {
        reportGenerationState.status = "failed";
        reportRenderAll();
        showToast(`存在 ${validation.counts.blocking} 项阻断问题，请修复后重新生成`, "warning", 2800);
        return;
      }
      if (validation.counts.warning > 0) {
        reportGenerationState.status = "idle";
        reportRenderAll();
        reportOpenConfirm("当前草稿存在警告", `当前草稿存在 ${validation.counts.warning} 项警告，仍可生成Demo报告包。`, () => startManualReportGeneration(validation), { cancelLabel: "返回修改", acceptLabel: "继续生成" });
        return;
      }
      startManualReportGeneration(validation);
    }

    function generatedReportPagesMarkup(snapshot, imageDataUri = "") {
      return snapshot.pages.map((page, index) => `<article class="generated-report-page"><header><span>${snapshot.reportId} · ${page.pageId}</span><b>${reportEscape(snapshot.metadata.version)} · 非正式成果</b></header><h2>${reportEscape(page.title)}</h2><p>${reportEscape(page.summary)}</p>${page.components.fieldImage && imageDataUri ? `<img src="${imageDataUri}" alt="典型现场影像">` : ""}<div class="generated-metrics">${page.dataBlocks.map(([label,value]) => `<article><span>${reportEscape(label)}</span><b>${reportEscape(value)}</b></article>`).join("")}</div><section><h3>本页结论</h3><p>${reportEscape(page.conclusion)}</p></section><section><h3>证据与来源</h3><p>${page.evidence.join(" → ")}</p><p>数据来源：01—05阶段本地固定演示数据。</p></section><footer><span>${reportEscape(snapshot.metadata.footer)}｜Demo预置报告｜非正式成果</span><b>${String(index + 1).padStart(2,"0")} / ${String(snapshot.pageCount).padStart(2,"0")}</b></footer></article>`).join("");
    }

    async function reportResourceToDataUri(source) {
      if (!source || source.startsWith("data:")) return source || "";
      try {
        const response = await fetch(source);
        const blob = await response.blob();
        return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
      } catch (error) { return ""; }
    }

    async function buildSelfContainedReportHtml(snapshot, options = {}) {
      const imageDataUri = await reportResourceToDataUri(snapshot.imageSource);
      const pages = generatedReportPagesMarkup(snapshot, imageDataUri);
      const word = Boolean(options.word);
      return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${reportEscape(snapshot.metadata.title)}</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#e8eceb;color:#172226;font-family:"Microsoft YaHei","Noto Sans SC",sans-serif}.generated-report-page{width:210mm;min-height:297mm;margin:0 auto 8mm;padding:16mm 17mm 13mm;display:flex;flex-direction:column;gap:7mm;background:#fff;page-break-after:always}.generated-report-page:last-child{page-break-after:auto}.generated-report-page>header,.generated-report-page>footer{display:flex;justify-content:space-between;color:#5a6e72;font-size:9pt;border-color:#c5d0d0}.generated-report-page>header{padding-bottom:4mm;border-bottom:1px solid #c5d0d0}.generated-report-page>footer{margin-top:auto;padding-top:3mm;border-top:1px solid #c5d0d0}h2{margin:0;color:#17343a;font-size:22pt}h3{margin:0 0 2mm;color:#1f5963;font-size:13pt}p{margin:0;color:#40575c;font-size:10.5pt;line-height:1.65}.generated-metrics{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.generated-metrics article{padding:3mm;border:1px solid #c8d4d4;background:#edf2f0}.generated-metrics span{display:block;color:#667b80;font-size:9pt}.generated-metrics b{display:block;margin-top:1.5mm;color:#183439;font-size:11pt}img{width:100%;max-height:62mm;object-fit:cover}@media print{body{background:#fff}.generated-report-page{margin:0;break-after:page}}</style></head><body>${word ? "<p style=\"padding:8mm 17mm;margin:0;background:#fff;color:#8a5d24\">Word兼容稿｜Demo预置报告｜非正式成果</p>" : ""}${pages}</body></html>`;
    }

    function reportSafeFileName(value) { return String(value || "项目").replace(/[\\/:*?"<>|\s]+/g,"-").replace(/-+/g,"-").slice(0,60); }

    function reportSnapshotFileBase(snapshot) {
      const project = projectById(appState.activeProjectId) || cityProjects[0];
      return reportSafeFileName(`${project.shortName}-${snapshot.reportTitle}-Demo`);
    }

    function reportDownloadBlob(blob, fileName) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = fileName; link.hidden = true;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    }

    function reportOutputSnapshot() {
      return demoReportGenerationState.active
        ? demoReportGenerationState.generatedSnapshot
        : reportGenerationState.generatedSnapshot || demoReportGenerationState.generatedSnapshot;
    }

    async function downloadGeneratedHtmlReport() {
      const snapshot = reportOutputSnapshot(); if (!snapshot) return;
      const html = await buildSelfContainedReportHtml(snapshot);
      reportDownloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${reportSnapshotFileBase(snapshot)}.html`);
    }

    async function downloadGeneratedWordReport() {
      const snapshot = reportOutputSnapshot(); if (!snapshot) return;
      const html = await buildSelfContainedReportHtml(snapshot, { word: true });
      reportDownloadBlob(new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" }), `${reportSnapshotFileBase(snapshot)}-Word兼容稿.doc`);
    }

    function downloadGeneratedReportManifest() {
      const snapshot = reportOutputSnapshot(); if (!snapshot) return;
      const manifest = { reportId: snapshot.reportId, snapshotId: snapshot.snapshotId, pages: snapshot.pages.map((page) => ({ pageId: page.pageId, displayPage: page.displayPage, title: page.title })), dataVersion: "Demo Local Data 2026-07", referencedStages: snapshot.sources, businessData: snapshot.businessData, evidenceIds: snapshot.evidenceIds, generatedAt: snapshot.createdAt, fileTypes: snapshot.fileTypes, declaration: snapshot.declaration };
      reportDownloadBlob(new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json;charset=utf-8" }), "report-manifest.json");
    }

    async function printGeneratedReport() {
      const snapshot = reportOutputSnapshot(); if (!snapshot) return;
      const imageDataUri = await reportResourceToDataUri(snapshot.imageSource);
      $("#reportPrintSurface").innerHTML = generatedReportPagesMarkup(snapshot, imageDataUri);
      window.print();
    }

    async function viewGeneratedReportSnapshot() {
      const snapshot = reportOutputSnapshot(); if (!snapshot) return;
      const imageDataUri = await reportResourceToDataUri(snapshot.imageSource);
      $("#reportGeneratedViewerTitle").textContent = `${snapshot.reportTitle} · ${snapshot.snapshotId}`;
      $("#reportGeneratedViewerPages").innerHTML = generatedReportPagesMarkup(snapshot, imageDataUri);
      $("#reportGeneratedViewer").hidden = false;
      reportGenerationState.viewingSnapshot = true;
    }

    function reportRenderAll() {
      reportRenderCatalog();
      reportRenderPage();
      reportRenderContentEditor();
      reportRenderConfig();
      reportRenderSources();
      reportRenderTraceNotice();
      reportRenderGenerationFooter();
      $$('[data-report-tab]').forEach((button) => button.classList.toggle("is-current", button.dataset.reportTab === reportWorkbenchState.activeTab));
      $$('[data-report-panel]').forEach((panel) => panel.classList.toggle("is-current", panel.dataset.reportPanel === reportWorkbenchState.activeTab));
    }

    function reportSetType(type) {
      if (!reportTemplateData[type]) return;
      reportWorkbenchState.reportType = type;
      reportDraftState.activeReportType = type;
      if (reportGenerationState.generatedSnapshot && reportGenerationState.reportType !== type) { reportGenerationState.status = "stale"; reportGenerationState.draftChangedAfterGeneration = true; }
      reportWorkbenchState.pageIndex = 0;
      reportWorkbenchState.pendingTracePageId = null;
      reportRenderAll();
    }

    function reportSetPage(index) {
      reportWorkbenchState.pageIndex = clamp(Number(index) || 0, 0, reportVisiblePages().length - 1);
      reportRenderAll();
      $("#reportPreviewViewport").scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }

    function reportSetPageById(pageId) {
      const index = reportVisiblePages().findIndex((page) => page.pageId === pageId);
      if (index >= 0) reportSetPage(index);
    }

    function enterReportDraftMode() {
      const currentId = reportCurrentPage() && reportCurrentPage().pageId;
      reportCurrentDraft(true);
      reportWorkbenchState.mode = "draft";
      reportDraftState.enabled = true;
      reportWorkbenchState.activeTab = "content";
      const index = reportVisiblePages().findIndex((page) => page.pageId === currentId);
      reportWorkbenchState.pageIndex = index >= 0 ? index : 0;
      reportRenderAll();
    }

    function exitReportDraftMode() {
      const currentId = reportCurrentPage() && reportCurrentPage().pageId;
      reportWorkbenchState.mode = "baseline";
      reportDraftState.enabled = false;
      reportWorkbenchState.activeTab = "config";
      const index = reportVisiblePages().findIndex((page) => page.pageId === currentId);
      reportWorkbenchState.pageIndex = index >= 0 ? index : 0;
      reportWorkbenchState.printPreview = false;
      reportRenderAll();
    }

    function updateReportMetadata(field, value, options = {}) {
      const draft = reportCurrentDraft();
      if (!Object.prototype.hasOwnProperty.call(draft.metadata, field)) return false;
      const limits = { title: 40, subtitle: 60, note: 120, version: 28, footer: 24 };
      draft.metadata[field] = String(value).slice(0, limits[field] || 40);
      reportMarkGenerationStale();
      if (options.render !== false) reportRenderAll();
      return true;
    }

    function updateReportPageContent(pageId, field, value, options = {}) {
      const draft = reportCurrentDraft();
      if (!draft.pageContent[pageId] || !Object.prototype.hasOwnProperty.call(draft.pageContent[pageId], field)) return false;
      draft.pageContent[pageId][field] = String(value).slice(0, field === "summary" || field === "conclusion" ? 320 : 60);
      reportMarkGenerationStale();
      if (options.render !== false) reportRenderAll();
      return true;
    }

    function toggleReportPage(pageId, enabled) {
      const draft = reportCurrentDraft();
      if (!Object.prototype.hasOwnProperty.call(draft.pageEnabled, pageId)) return false;
      if (REPORT_REQUIRED_PAGES[draft.type].has(pageId) && !enabled) { showToast("必选章节不可停用", "warning", 1800); return false; }
      draft.pageEnabled[pageId] = Boolean(enabled);
      reportMarkGenerationStale();
      const current = reportCurrentPage();
      if (!current || !draft.pageEnabled[current.pageId]) reportWorkbenchState.pageIndex = 0;
      reportRenderAll();
      return true;
    }

    function moveReportPage(pageId, direction) {
      const draft = reportCurrentDraft();
      const index = draft.pageOrder.indexOf(pageId);
      const delta = direction === "up" ? -1 : 1;
      const target = index + delta;
      if (index <= 0 || index >= draft.pageOrder.length - 1 || target <= 0 || target >= draft.pageOrder.length - 1) return false;
      [draft.pageOrder[index], draft.pageOrder[target]] = [draft.pageOrder[target], draft.pageOrder[index]];
      reportMarkGenerationStale();
      const visibleIndex = reportVisiblePages().findIndex((page) => page.pageId === pageId);
      reportWorkbenchState.pageIndex = Math.max(0, visibleIndex);
      reportRenderAll();
      return true;
    }

    function toggleReportPageBlock(pageId, blockId, enabled) {
      const draft = reportCurrentDraft();
      if (!draft.pageBlocks[pageId] || !Object.prototype.hasOwnProperty.call(draft.pageBlocks[pageId], blockId)) return false;
      if ((REPORT_REQUIRED_COMPONENTS[pageId] || new Set()).has(blockId) && !enabled) { showToast("该组件是当前页面的必要内容", "warning", 1800); return false; }
      draft.pageBlocks[pageId][blockId] = Boolean(enabled);
      reportMarkGenerationStale();
      reportRenderAll();
      return true;
    }

    function setReportPageLayout(pageId, layout) {
      const draft = reportCurrentDraft();
      const allowed = (REPORT_PAGE_LAYOUTS[pageId] || REPORT_PAGE_LAYOUTS.default).map(([value]) => value);
      if (!allowed.includes(layout)) return false;
      draft.pageLayouts[pageId] = layout;
      reportMarkGenerationStale();
      reportRenderAll();
      return true;
    }

    function resetCurrentReportPage() {
      const draft = reportCurrentDraft();
      const page = reportCurrentPage();
      const defaults = reportMakeDraft(draft.type, draft.topic);
      draft.pageContent[page.pageId] = reportClone(defaults.pageContent[page.pageId]);
      draft.pageBlocks[page.pageId] = reportClone(defaults.pageBlocks[page.pageId]);
      draft.pageLayouts[page.pageId] = defaults.pageLayouts[page.pageId];
      draft.overflow[page.pageId] = false;
      reportMarkGenerationStale();
      reportRenderAll();
    }

    function resetCurrentReportDraft() {
      const key = reportDraftKey();
      reportDraftState.drafts[key] = reportMakeDraft();
      reportMarkGenerationStale();
      reportWorkbenchState.pageIndex = 0;
      reportWorkbenchState.pendingTracePageId = null;
      reportRenderAll();
    }

    function clearAllReportDrafts(options = {}) {
      reportDraftState.drafts = Object.create(null);
      reportDraftState.lastValidation = null;
      reportDraftState.enabled = false;
      reportWorkbenchState.mode = "baseline";
      reportWorkbenchState.printPreview = false;
      reportWorkbenchState.pendingTracePageId = null;
      reportWorkbenchState.pageIndex = 0;
      reportWorkbenchState.activeTab = "config";
      reportMarkGenerationStale();
      if (options.render !== false && reportWorkspaceInitialized) reportRenderAll();
      if (!options.silent) showToast("全部报告草稿已清除，标准样张保持不变", "success", 2200);
    }

    function renderDraftReport() { reportRenderAll(); }

    function renderReportDifference() { return reportChangeSummary(); }

    function reportOpenConfirm(title, text, action, options = {}) {
      reportWorkbenchState.confirmAction = action;
      $("#reportConfirmTitle").textContent = title;
      $("#reportConfirmText").textContent = text;
      $("#reportConfirmCancel").textContent = options.cancelLabel || "取消";
      $("#reportConfirmAccept").textContent = options.acceptLabel || "确认";
      $("#reportInlineConfirm").hidden = false;
    }

    function reportCloseConfirm() {
      reportWorkbenchState.confirmAction = null;
      $("#reportInlineConfirm").hidden = true;
      $("#reportConfirmCancel").textContent = "取消";
      $("#reportConfirmAccept").textContent = "确认";
    }

    function reportSchedulePreview() {
      window.clearTimeout(reportDraftState.debounceId);
      reportDraftState.debounceId = window.setTimeout(() => {
        reportRenderPage();
        reportRenderCatalog();
        reportRenderConfig();
      }, 220);
    }

    function reportSetZoom(value) {
      reportWorkbenchState.zoom = clamp(Math.round(Number(value) / 10) * 10, 50, 160);
      reportRenderPage();
    }

    function reportFit(mode) {
      const viewport = $("#reportPreviewViewport");
      const widthScale = (viewport.clientWidth - 52) / 640;
      const heightScale = (viewport.clientHeight - 52) / 905;
      const scale = mode === "width" ? widthScale : Math.min(widthScale, heightScale);
      reportSetZoom(clamp(Math.floor(scale * 100 / 10) * 10, 50, 160));
    }

    function reportNavigateTrace(nodeId) {
      if (nodeId.startsWith("RPT-")) {
        if (nodeId === "RPT-04") reportWorkbenchState.reportType = "comprehensive";
        const draft = reportWorkbenchState.mode === "draft" ? reportCurrentDraft() : null;
        if (draft && draft.pageEnabled[nodeId] === false) {
          reportWorkbenchState.pendingTracePageId = nodeId;
          reportWorkbenchState.activeTab = "trace";
          reportRenderAll();
          showToast("该页面当前未纳入草稿", "warning", 2200);
          return;
        }
        reportWorkbenchState.pendingTracePageId = null;
        reportSetPageById(nodeId);
        return;
      }
      if (nodeId.startsWith("IMG-") || nodeId.startsWith("DEF-")) {
        const taskId = nodeId.startsWith("DEF-") ? nodeId : "DEF-021";
        closeReportWorkspace().then(openHumanReviewWorkspace).then(() => { if (initializeHumanReview()) humanReviewSelectTask(taskId); });
      } else if (nodeId.startsWith("MAP-")) {
        closeReportWorkspace().then(openGISWorkspace).then(() => { if (initializeGISWorkspace()) gisSelectIssue(nodeId, { center: true, scroll: true }); });
      } else if (nodeId.startsWith("IND-")) {
        closeReportWorkspace().then(openIndicatorWorkspace).then(() => { if (initializeIndicatorWorkspace()) indicatorSelect(nodeId, { showDetail: true }); });
      }
    }

    function bindReportWorkspaceEvents() {
      if (reportWorkspace.dataset.eventsBound === "true") return;
      reportWorkspace.dataset.eventsBound = "true";
      $("#reportTypeList").addEventListener("click", (event) => { const target = event.target.closest("[data-report-type]"); if (target) reportSetType(target.dataset.reportType); });
      $("#reportPageList").addEventListener("click", (event) => {
        const standard = event.target.closest("[data-report-page]");
        if (standard) { reportSetPage(standard.dataset.reportPage); return; }
        const select = event.target.closest("[data-report-page-id]");
        if (select) { reportSetPageById(select.dataset.reportPageId); return; }
        const toggle = event.target.closest("[data-report-page-toggle]");
        if (toggle) { const draft = reportCurrentDraft(); toggleReportPage(toggle.dataset.reportPageToggle, !draft.pageEnabled[toggle.dataset.reportPageToggle]); return; }
        const move = event.target.closest("[data-report-page-move]");
        if (move) moveReportPage(move.dataset.pageId, move.dataset.reportPageMove);
      });
      $("#reportSpecialTopic").addEventListener("click", (event) => { const target = event.target.closest("[data-report-topic]"); if (!target) return; reportWorkbenchState.specialTopic = target.dataset.reportTopic; reportDraftState.activeTopic = target.dataset.reportTopic; if (reportGenerationState.generatedSnapshot && reportGenerationState.specialTopic !== target.dataset.reportTopic) { reportGenerationState.status = "stale"; reportGenerationState.draftChangedAfterGeneration = true; } reportWorkbenchState.pageIndex = 0; reportRenderAll(); });
      $("#reportPreviousPage").addEventListener("click", () => reportSetPage(reportWorkbenchState.pageIndex - 1));
      $("#reportNextPage").addEventListener("click", () => reportSetPage(reportWorkbenchState.pageIndex + 1));
      $("#reportZoomOut").addEventListener("click", () => reportSetZoom(reportWorkbenchState.zoom - 10));
      $("#reportZoomIn").addEventListener("click", () => reportSetZoom(reportWorkbenchState.zoom + 10));
      $("#reportFitPage").addEventListener("click", () => reportFit("page"));
      $("#reportFitWidth").addEventListener("click", () => reportFit("width"));
      $("#reportActualSize").addEventListener("click", () => reportSetZoom(100));
      $("#reportEvidenceToggle").addEventListener("click", () => { reportWorkbenchState.evidenceVisible = !reportWorkbenchState.evidenceVisible; reportRenderPage(); });
      $("#reportBaselineMode").addEventListener("click", exitReportDraftMode);
      $("#reportDraftMode").addEventListener("click", enterReportDraftMode);
      const togglePrint = () => { reportWorkbenchState.printPreview = !reportWorkbenchState.printPreview; reportRenderAll(); };
      $("#reportPrintPreview").addEventListener("click", togglePrint);
      $("#reportFullscreen").addEventListener("click", async () => {
        reportWorkbenchState.fullscreenPreview = !reportWorkbenchState.fullscreenPreview;
        reportWorkspace.classList.toggle("is-preview-fullscreen", reportWorkbenchState.fullscreenPreview);
        try {
          if (reportWorkbenchState.fullscreenPreview && !document.fullscreenElement && reportWorkspace.requestFullscreen) await reportWorkspace.requestFullscreen();
          else if (!reportWorkbenchState.fullscreenPreview && document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        } catch (error) { showToast("浏览器未允许全屏，已切换工作台内大幅预览", "warning", 2200); }
      });
      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && reportWorkbenchState.fullscreenPreview) {
          reportWorkbenchState.fullscreenPreview = false;
          reportWorkspace.classList.remove("is-preview-fullscreen");
        }
      });
      $$('[data-report-tab]').forEach((button) => button.addEventListener("click", () => { reportWorkbenchState.activeTab = button.dataset.reportTab; reportRenderAll(); }));
      $("#reportTraceChain").addEventListener("click", (event) => { const target = event.target.closest("[data-report-trace]"); if (target) reportNavigateTrace(target.dataset.reportTrace); });
      $("#reportTraceReincludeButton").addEventListener("click", () => {
        const pageId = reportWorkbenchState.pendingTracePageId;
        if (!pageId) return;
        toggleReportPage(pageId, true);
        reportWorkbenchState.pendingTracePageId = null;
        reportSetPageById(pageId);
      });
      $("#reportContentEditor").addEventListener("input", (event) => {
        if (reportWorkbenchState.mode !== "draft") return;
        const meta = event.target.closest("[data-report-meta]");
        const content = event.target.closest("[data-report-content]");
        if (meta) updateReportMetadata(meta.dataset.reportMeta, meta.value, { render: false });
        if (content) updateReportPageContent(reportCurrentPage().pageId, content.dataset.reportContent, content.value, { render: false });
        const small = event.target.parentElement && event.target.parentElement.querySelector("small");
        if (small && event.target.maxLength > 0) small.textContent = `${event.target.value.length} / ${event.target.maxLength}${meta && meta.dataset.reportMeta === "title" ? " · 不得为空" : ""}`;
        reportSchedulePreview();
      });
      $("#reportContentEditor").addEventListener("change", (event) => {
        const block = event.target.closest("[data-report-block]");
        if (block) { toggleReportPageBlock(reportCurrentPage().pageId, block.dataset.reportBlock, block.checked); return; }
        const layout = event.target.closest("[data-report-layout]");
        if (layout) setReportPageLayout(reportCurrentPage().pageId, layout.value);
      });
      $("#reportContentEditor").addEventListener("click", (event) => {
        if (event.target.closest("#reportApplyPage")) { reportRenderAll(); showToast("当前页面草稿已应用", "success", 1600); }
        else if (event.target.closest("#reportResetPage")) reportOpenConfirm("恢复当前页默认值", "仅恢复当前页面的文案、组件与布局，不影响其他页面。", resetCurrentReportPage);
      });
      $("#reportConfigContent").addEventListener("click", (event) => {
        if (event.target.closest("#reportRunValidation")) { reportRenderConfig(); showToast("草稿校验已更新", "success", 1500); }
        else if (event.target.closest("#reportResetCurrentDraft")) reportOpenConfirm("恢复整份标准样张", "仅清除当前报告草稿，其他报告与专项主题草稿继续保留。", resetCurrentReportDraft);
        else if (event.target.closest("#reportClearAllDrafts")) reportOpenConfirm("清除全部报告草稿", "将清除三类报告及建筑安全、社区环境两个专项草稿；标准样张不受影响。", clearAllReportDrafts);
        else if (event.target.closest("#reportConfigPrintPreview")) togglePrint();
        else if (event.target.closest("#reportGeneratePackage")) requestGenerateReportPackage();
        else if (event.target.closest("#reportDownloadHtml")) downloadGeneratedHtmlReport();
        else if (event.target.closest("#reportDownloadWord")) downloadGeneratedWordReport();
        else if (event.target.closest("#reportPrintPdf")) printGeneratedReport();
        else if (event.target.closest("#reportDownloadManifest")) downloadGeneratedReportManifest();
      });
      $("#reportConfirmCancel").addEventListener("click", reportCloseConfirm);
      $("#reportConfirmAccept").addEventListener("click", () => { const action = reportWorkbenchState.confirmAction; reportCloseConfirm(); if (typeof action === "function") action(); });
      $("#reportReturnOverview").addEventListener("click", () => { manualAction(); closeReportWorkspace().then(() => completeReturnToMap("已返回项目总览")); });
      $("#reportViewGenerated").addEventListener("click", viewGeneratedReportSnapshot);
      $("#reportRegeneratePackage").addEventListener("click", requestGenerateReportPackage);
      $("#reportGeneratedViewerClose").addEventListener("click", () => { $("#reportGeneratedViewer").hidden = true; reportGenerationState.viewingSnapshot = false; });
      $("#reportPreviewViewport").addEventListener("wheel", (event) => { if (!event.ctrlKey) return; event.preventDefault(); reportSetZoom(reportWorkbenchState.zoom + (event.deltaY < 0 ? 10 : -10)); }, { passive: false });
      reportWorkspace.addEventListener("keydown", (event) => {
        if (!appState.reportWorkspaceOpen) return;
        if (event.key === "PageUp") { event.preventDefault(); reportSetPage(reportWorkbenchState.pageIndex - 1); }
        else if (event.key === "PageDown") { event.preventDefault(); reportSetPage(reportWorkbenchState.pageIndex + 1); }
        else if (event.key === "Home") { event.preventDefault(); reportSetPage(0); }
        else if (event.key === "End") { event.preventDefault(); reportSetPage(reportVisiblePages().length - 1); }
      });
      $("#reportBackButton").addEventListener("click", () => { manualAction(); closeReportWorkspace().then(() => completeReturnToMap("已返回西安市城市项目总览")); });
      $("#reportCloseButton").addEventListener("click", () => { manualAction(); closeReportWorkspace().then(() => completeReturnToMap("报告生成工作台已关闭")); });
    }

    function initializeReportWorkspace() {
      if (reportWorkspaceInitialized) return true;
      const requiredIds = ["reportWorkspace", "reportTypeList", "reportPageList", "reportA4Page", "reportPreviewViewport", "reportSourceList", "reportTraceChain", "reportContentEditor", "reportConfigContent", "reportGenerationFooter", "reportGeneratedViewer", "reportPrintSurface", "reportSixStageSummary"];
      const missing = requiredIds.filter((id) => !document.getElementById(id));
      if (missing.length) { runtimeDiagnosticError(new Error("06工作台DOM缺失: " + missing.join(", ")), "06惰性初始化"); return false; }
      try {
        bindReportWorkspaceEvents();
        reportRenderAll();
        reportWorkspaceInitialized = true;
        runtimeDiagnosticStep("06模块惰性初始化完成", "标准样张、独立草稿、章节编排与实时预览已就绪");
        return true;
      } catch (error) { runtimeDiagnosticError(error, "06惰性初始化"); return false; }
    }

    function openReportWorkspace() {
      if (!initializeReportWorkspace()) return Promise.resolve(false);
      if (motion.report.state === "open" || motion.report.state === "opening") return motion.report.promise;
      if (motion.report.state === "closing") return motion.report.promise.then(openReportWorkspace);
      if (!appState.activeProjectId) selectProject(cityProjects[0].id, { openDetail: false, pan: false });
      const token = ++motion.report.token;
      motion.report.state = "opening";
      motion.report.promise = (async () => {
        if (appState.workspaceOpen) await closeWorkspace();
        if (appState.aiRecognitionWorkspaceOpen) await closeAIRecognitionWorkspace();
        if (appState.humanReviewWorkspaceOpen) await closeHumanReviewWorkspace();
        if (appState.gisWorkspaceOpen) await closeGISWorkspace();
        if (appState.indicatorWorkspaceOpen) await closeIndicatorWorkspace();
        if (motion.left.state !== "closed") await closeLeftDrawer({ keepBackdrop: true });
        if (motion.right.state !== "closed") await closeRightDrawer({ keepBackdrop: true });
        if (token !== motion.report.token) return false;
        appState.reportWorkspaceOpen = true;
        appState.activeModuleIndex = 5;
        appState.activeViewStage = 5;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = 5;
        if (appState.workflowCompletedThrough >= 4) setWorkflowStage(5, 4, false);
        $("#reportProjectName").textContent = (projectById(appState.activeProjectId) || cityProjects[0]).name;
        reportWorkspace.classList.remove("is-closing", "is-settled");
        reportWorkspace.classList.add("is-opening");
        reportWorkspace.setAttribute("aria-hidden", "false");
        reportRenderAll();
        await nextPaint();
        appStage.classList.add("report-workspace-active");
        reportWorkspace.classList.add("is-open");
        await waitForVisualEnd(reportWorkspace, { property: "transform" });
        if (token !== motion.report.token) return false;
        reportWorkspace.classList.remove("is-opening");
        reportWorkspace.classList.add("is-settled");
        motion.report.state = "open";
        syncMotionDebug("report-open-complete");
        syncDebug();
        return true;
      })();
      return motion.report.promise;
    }

    function closeReportWorkspace() {
      if (!reportWorkspace || motion.report.state === "closed") return Promise.resolve();
      if (motion.report.state === "closing") return motion.report.promise;
      if (motion.report.state === "opening") return motion.report.promise.then(closeReportWorkspace);
      const token = ++motion.report.token;
      motion.report.state = "closing";
      motion.report.promise = (async () => {
        reportCloseConfirm();
        window.clearTimeout(reportDraftState.debounceId);
        $("#reportGeneratedViewer").hidden = true;
        reportGenerationState.viewingSnapshot = false;
        reportWorkspace.classList.remove("is-settled", "is-opening", "is-preview-fullscreen");
        reportWorkbenchState.fullscreenPreview = false;
        if (document.fullscreenElement === reportWorkspace && document.exitFullscreen) await document.exitFullscreen().catch(() => {});
        reportWorkspace.classList.add("is-closing");
        appStage.classList.remove("report-workspace-active");
        await nextPaint();
        reportWorkspace.classList.remove("is-open");
        await waitForVisualEnd(reportWorkspace, { property: "transform" });
        if (token !== motion.report.token) return;
        reportWorkspace.classList.remove("is-closing");
        reportWorkspace.setAttribute("aria-hidden", "true");
        appState.reportWorkspaceOpen = false;
        if (appState.activeWorkspaceStage === 5) appState.activeWorkspaceStage = null;
        motion.report.state = "closed";
        syncMotionDebug("report-close-complete");
        syncDebug();
      })();
      return motion.report.promise;
    }

    function resetReportWorkspaceState() {
      reportWorkbenchState.reportType = "comprehensive";
      reportWorkbenchState.specialTopic = "building";
      reportWorkbenchState.pageIndex = 0;
      reportWorkbenchState.activeTab = "config";
      reportWorkbenchState.zoom = 100;
      reportWorkbenchState.evidenceVisible = true;
      reportWorkbenchState.fullscreenPreview = false;
      reportWorkbenchState.mode = "baseline";
      reportWorkbenchState.printPreview = false;
      reportWorkbenchState.pendingTracePageId = null;
      reportWorkbenchState.confirmAction = null;
      reportDraftState.enabled = false;
      window.clearTimeout(reportDraftState.debounceId);
      const confirm = $("#reportInlineConfirm");
      if (confirm) confirm.hidden = true;
      if (reportWorkspaceInitialized) reportRenderAll();
    }

    function setFlowState(currentIndex, nextIndex) {
      if (typeof nextIndex === "number") setWorkflowStage(nextIndex, currentIndex, true);
      else setWorkflowStage(currentIndex, currentIndex - 1, false);
    }

    function highlightNextStage(index) {
      const safeIndex = typeof index === "number" ? index : 1;
      setFlowState(0, safeIndex);
      appState.activeModuleIndex = safeIndex;
      if (safeIndex === 1) showToast("资料治理完成，可进入02 AI智能识别", "success", 2600);
      else showToast("该模块将在下一开发阶段完成。", "warning", 2600);
      syncDebug();
    }

    const CITY_MAP_FOCUS_SCALE = 1.58;
    const CITY_MAP_FOCUS_SCALE_COMPACT = 1.52;
    const CITY_MAP_RIGHT_RAIL_INSET = 282;
    const CITY_MAP_DETAIL_INSET = 550;

    function cityMapViewportMetrics(options) {
      const viewportWidth = mapViewport.clientWidth || 1920;
      const viewportHeight = mapViewport.clientHeight || 988;
      const contentWidth = mapContent.clientWidth || 1617;
      const contentHeight = mapContent.clientHeight || 988;
      const reserveDetail = Boolean(options && options.reserveDetail);
      return {
        viewportWidth,
        viewportHeight,
        contentWidth,
        contentHeight,
        left: reserveDetail ? CITY_MAP_DETAIL_INSET : 0,
        right: viewportWidth - CITY_MAP_RIGHT_RAIL_INSET,
        top: 0,
        bottom: viewportHeight
      };
    }

    function cityMapPositionBounds(scale, options) {
      const metrics = cityMapViewportMetrics(options);
      const halfWidth = metrics.contentWidth * scale * 0.5;
      const halfHeight = metrics.contentHeight * scale * 0.5;
      const centerX = metrics.viewportWidth * 0.5;
      const centerY = metrics.viewportHeight * 0.5;
      const minX = metrics.right - centerX - halfWidth;
      const maxX = metrics.left - centerX + halfWidth;
      const minY = metrics.bottom - centerY - halfHeight;
      const maxY = metrics.top - centerY + halfHeight;
      return {
        minX: minX <= maxX ? minX : 0,
        maxX: minX <= maxX ? maxX : 0,
        minY: minY <= maxY ? minY : 0,
        maxY: minY <= maxY ? maxY : 0,
        metrics
      };
    }

    function constrainCityMapPosition(x, y, scale, options) {
      const bounds = cityMapPositionBounds(scale, options);
      return {
        x: clamp(x, bounds.minX, bounds.maxX),
        y: clamp(y, bounds.minY, bounds.maxY)
      };
    }

    function calculateCityProjectFocus(project, options) {
      const reserveDetail = Boolean(options && options.reserveDetail);
      const scale = window.innerWidth <= 1400 ? CITY_MAP_FOCUS_SCALE_COMPACT : CITY_MAP_FOCUS_SCALE;
      const metrics = cityMapViewportMetrics({ reserveDetail });
      const targetX = (metrics.left + metrics.right) * 0.5;
      const targetY = (metrics.top + metrics.bottom) * 0.5;
      const projectOffsetX = (project.x / 100 - 0.5) * metrics.contentWidth * scale;
      const projectOffsetY = (project.y / 100 - 0.5) * metrics.contentHeight * scale;
      const desiredX = targetX - metrics.viewportWidth * 0.5 - projectOffsetX;
      const desiredY = targetY - metrics.viewportHeight * 0.5 - projectOffsetY;
      const constrained = constrainCityMapPosition(desiredX, desiredY, scale, { reserveDetail });
      return { scale, x: constrained.x, y: constrained.y, targetX, targetY, reserveDetail };
    }

    function applyMapTransform() {
      appStage.style.setProperty("--map-scale", appState.map.scale.toFixed(3));
      appStage.style.setProperty("--map-x", appState.map.x.toFixed(2) + "px");
      appStage.style.setProperty("--map-y", appState.map.y.toFixed(2) + "px");
      mapViewport.classList.toggle("is-project-focused", cityMapState.mode === "focused");
      mapViewport.dataset.mapMode = cityMapState.mode;
      $("#mapZoomLabel").textContent = Math.round(appState.map.scale * 100) + "%";
    }

    function setMapScale(scale) {
      appState.map.scale = clamp(scale, 1, 2.2);
      const reserveDetail = cityMapState.mode === "focused" && motion.left.state !== "closed";
      const constrained = constrainCityMapPosition(appState.map.x, appState.map.y, appState.map.scale, { reserveDetail });
      appState.map.x = constrained.x;
      appState.map.y = constrained.y;
      applyMapTransform();
    }

    function nextZoomIn() {
      if (appState.map.scale < 1.28) return 1.28;
      if (appState.map.scale < 1.58) return 1.58;
      return Math.min(2.2, appState.map.scale + 0.22);
    }

    function nextZoomOut() {
      if (appState.map.scale > 1.58) return 1.58;
      if (appState.map.scale > 1.28) return 1.28;
      return 1;
    }

    function focusCityProject(projectId, options) {
      const project = projectById(projectId);
      if (!project) return Promise.resolve(false);
      const settings = options || {};
      const focus = calculateCityProjectFocus(project, { reserveDetail: settings.reserveDetail });
      cityMapState.mode = "focused";
      cityMapState.focusedProjectId = project.id;
      cityMapState.interactionSource = settings.interactionSource || "manual";
      cityMapState.scale = focus.scale;
      cityMapState.x = focus.x;
      cityMapState.y = focus.y;
      appState.activeProjectId = project.id;
      renderProjectDetail(project);
      updateProjectSelection();
      applyMapTransform();
      syncDebug();
      return settings.openDetail ? openLeftDrawer("detail") : Promise.resolve(true);
    }

    function switchFocusedProject(projectId, options) {
      return focusCityProject(projectId, { ...(options || {}), interactionSource: (options && options.interactionSource) || "project-switch" });
    }

    function resetCityMapFocus(options) {
      const settings = options || {};
      cityMapState.mode = "overview";
      cityMapState.focusedProjectId = null;
      cityMapState.interactionSource = settings.interactionSource || "reset";
      cityMapState.scale = 1;
      cityMapState.x = 0;
      cityMapState.y = 0;
      cityMapState.dragging = false;
      cityMapState.pointerId = null;
      cityMapState.movedDistance = 0;
      mapViewport.classList.remove("is-dragging");
      updateProjectSelection();
      applyMapTransform();
      syncDebug();
      if (settings.closeDetail && motion.left.state !== "closed") return closeLeftDrawer();
      return Promise.resolve(true);
    }

    function restoreMap() {
      return resetCityMapFocus({ closeDetail: false, interactionSource: "restore" });
    }

    function panToProject(project, options) {
      const width = mapContent.clientWidth || 1617;
      const height = mapContent.clientHeight || 988;
      cityMapState.mode = "focused";
      cityMapState.focusedProjectId = project.id;
      cityMapState.interactionSource = (options && options.interactionSource) || "legacy-pan";
      appState.map.scale = Math.max(1.12, appState.map.scale);
      const dx = (project.x / 100 - 0.5) * width;
      const dy = (project.y / 100 - 0.5) * height;
      const boundX = width * (appState.map.scale - 1) * 0.5;
      const boundY = height * (appState.map.scale - 1) * 0.5;
      appState.map.x = clamp(-dx * 0.17, -boundX, boundX);
      appState.map.y = clamp(-dy * 0.17, -boundY, boundY);
      updateProjectSelection();
      applyMapTransform();
    }

    function cancelManualUpload() {
      if (appState.manualUpload && appState.manualUpload.rafId) cancelAnimationFrame(appState.manualUpload.rafId);
      appState.manualUpload = null;
    }

    function renderUploadProgress(progress) {
      const p = clamp(progress, 0, 1);
      const curved = easeOut(p);
      const counters = [
        ["#photoCount", 186, 194],
        ["#droneCount", 12, 15],
        ["#surveyCount", 3, 4],
        ["#gisCount", 8, 9]
      ];
      counters.forEach(([selector, start, end]) => {
        $(selector).textContent = String(Math.round(start + (end - start) * curved));
      });
      const percent = Math.round(p * 100);
      $("#uploadProgressValue").textContent = percent + "%";
      $("#uploadProgressBar").style.width = percent + "%";
      $("#processingValue").textContent = String(percent);
      $("#totalAssetsValue").textContent = String(Math.round(209 + 13 * curved));
      $("#uploadProgressCopy").textContent = p >= 1 ? "资料接入与治理完成" : p > 0 ? "正在接入并治理项目资料" : "等待接入新资料";

      const completeness = Math.round(82 + 14 * curved);
      $("#completenessValue").innerHTML = completeness + "<small>%</small>";
      $("#completenessBar").style.width = completeness + "%";
      $("#completenessDelta").textContent = p >= 1 ? "数据完整度已提升 14 个百分点" : "治理后预计提升至 96%";

      const steps = $$("[data-governance]");
      const starts = [0.04, 0.18, 0.32, 0.47, 0.63, 0.78];
      steps.forEach((step, index) => {
        const completeAt = index === steps.length - 1 ? 0.98 : starts[index + 1];
        const running = p >= starts[index] && p < completeAt;
        const complete = p >= completeAt;
        step.classList.toggle("is-running", running);
        step.classList.toggle("is-complete", complete);
        $("small", step).textContent = complete ? "已完成" : running ? "处理中" : "等待处理";
      });

      const anomalyPanel = $(".anomaly-panel");
      const detected = p >= 0.44;
      anomalyPanel.classList.toggle("is-detected", detected);
      $("#anomalyCount").textContent = detected ? "2类异常" : "待检测";
      $("b", $("#duplicateAnomaly")).textContent = detected ? "2组" : "—";
      $("b", $("#locationAnomaly")).textContent = detected ? "12张" : "—";

      appState.uploadComplete = p >= 1;
      if (appState.uploadComplete) {
        $("#simulateUploadButton span").textContent = "重新模拟";
        setFlowState(0, 1);
      } else {
        $("#simulateUploadButton span").textContent = p > 0 ? "治理中" : "模拟上传";
      }
    }

    function resetUploadUI() {
      cancelManualUpload();
      window.clearTimeout(appState.toastTimer);
      window.clearTimeout(appState.handoffHintTimer);
      appState.toastTimer = 0;
      appState.handoffHintTimer = 0;
      toast.classList.remove("is-open", "is-warning", "is-success");
      $("#aiRecognitionResultStatus").classList.remove("is-next-hint");
      $("#aiRecognitionHandoffButton").classList.remove("is-notifying");
      appState.uploadComplete = false;
      renderUploadProgress(0);
      setFlowState(0);
    }

    function startManualUpload() {
      cancelManualUpload();
      renderUploadProgress(0);
      const startedAt = performance.now();
      const duration = 4300;
      const upload = { rafId: 0 };
      appState.manualUpload = upload;
      function frame(now) {
        if (appState.manualUpload !== upload) return;
        const progress = clamp((now - startedAt) / duration, 0, 1);
        renderUploadProgress(progress);
        if (progress < 1) upload.rafId = requestAnimationFrame(frame);
        else {
          appState.manualUpload = null;
          showToast("资料治理完成，完整度提升至96%", "success", 2500);
        }
      }
      upload.rafId = requestAnimationFrame(frame);
    }

    function forceResetMotion() {
      motion.left.token += 1;
      motion.right.token += 1;
      motion.workspace.token += 1;
      motion.aiRecognition.token += 1;
      motion.humanReview.token += 1;
      motion.gis.token += 1;
      motion.indicator.token += 1;
      motion.report.token += 1;
      motion.left.state = "closed";
      motion.right.state = "closed";
      motion.workspace.state = "closed";
      motion.aiRecognition.state = "closed";
      motion.humanReview.state = "closed";
      motion.gis.state = "closed";
      motion.indicator.state = "closed";
      motion.report.state = "closed";
      motion.left.contentState = "idle";
      motion.right.contentState = "idle";
      leftDrawer.classList.remove("is-open", "is-opening", "is-closing", "is-settled", "is-content-leaving", "is-content-entering");
      moduleDrawer.classList.remove("is-open", "is-opening", "is-closing", "is-settled", "is-content-leaving", "is-content-entering", "is-indicator-module", "is-report-module", "is-stage-module");
      workspaceShell.classList.remove("is-opening", "is-closing", "is-settled");
      aiRecognitionWorkspace.classList.remove("is-open", "is-opening", "is-closing", "is-settled");
      if (humanReviewWorkspace) humanReviewWorkspace.classList.remove("is-open", "is-opening", "is-closing", "is-settled", "is-original-mode");
      if (gisWorkspace) gisWorkspace.classList.remove("is-open", "is-opening", "is-closing", "is-settled", "is-demo-layer-sequence");
      if (indicatorWorkspace) indicatorWorkspace.classList.remove("is-open", "is-opening", "is-closing", "is-settled");
      if (reportWorkspace) reportWorkspace.classList.remove("is-open", "is-opening", "is-closing", "is-settled", "is-preview-fullscreen");
      leftDrawer.setAttribute("aria-hidden", "true");
      moduleDrawer.setAttribute("aria-hidden", "true");
      workspaceShell.setAttribute("aria-hidden", "true");
      aiRecognitionWorkspace.setAttribute("aria-hidden", "true");
      if (humanReviewWorkspace) humanReviewWorkspace.setAttribute("aria-hidden", "true");
      if (gisWorkspace) gisWorkspace.setAttribute("aria-hidden", "true");
      if (indicatorWorkspace) indicatorWorkspace.setAttribute("aria-hidden", "true");
      if (reportWorkspace) reportWorkspace.setAttribute("aria-hidden", "true");
      const gisImagePreview = $("#gisImagePreview");
      if (gisImagePreview) gisImagePreview.hidden = true;
      const gisDemoCompletion = $("#gisDemoCompletion");
      if (gisDemoCompletion) gisDemoCompletion.hidden = true;
      const indicatorDemoCompletion = $("#indicatorDemoCompletion");
      if (indicatorDemoCompletion) indicatorDemoCompletion.hidden = true;
      projectEntry.setAttribute("aria-expanded", "false");
      appStage.classList.remove("is-left-open", "is-workspace", "ai-recognition-workspace-active", "human-review-workspace-active", "gis-workspace-active", "indicator-workspace-active", "report-workspace-active", "is-stage-switching");
      setBackdrop("closed");
      appState.leftDrawerView = null;
      appState.rightDrawerOpen = false;
      appState.workspaceOpen = false;
      appState.aiRecognitionWorkspaceOpen = false;
      appState.humanReviewWorkspaceOpen = false;
      appState.gisWorkspaceOpen = false;
      appState.indicatorWorkspaceOpen = false;
      appState.reportWorkspaceOpen = false;
      appState.activeViewStage = null;
      appState.activeDrawerStage = null;
      appState.activeWorkspaceStage = null;
      appState.stageNavigationInFlight = false;
      pendingStageNavigation = null;
      $("#moduleProjectContext").hidden = true;
      humanReviewState = humanReviewCreateState();
      humanReviewClearTransientUI();
      gisState.selectedMapId = "MAP-021";
      gisState.riskFilter = "all";
      gisState.typeFilter = "all";
      gisState.search = "";
      gisState.activeTab = "detail";
      gisState.radius = "500";
      gisState.objectFilter = null;
      gisState.distanceTarget = null;
      gisState.layerCollapsed = false;
      gisState.layers = { boundary: true, buildings: true, planning: false, roads: true, transit: false, publicServices: false, commercial: false, greenHeritage: false, points: true, risk: true, labels: true, imagePoints: false, analysisRange: false };
      gisState.pendingBindings = new Set(gisIssueData.filter((issue) => issue.gisStatus === "pending").map((issue) => issue.mapId));
      gisState.bindingOverrides.clear();
      gisState.positionOverrides.clear();
      gisState.adjustmentHistory.clear();
      gisState.map = { scale: 1, x: 0, y: 0, dragging: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 };
      indicatorState.selectedIndicatorId = "IND-BS-03";
      indicatorState.statusFilter = "all";
      indicatorState.search = "";
      indicatorState.categoryFocus = "all";
      indicatorState.activeTab = "detail";
      indicatorState.issueRiskFilter = "all";
      indicatorState.issueTypeFilter = "all";
      indicatorState.lastLocatedMapId = null;
      resetIndicatorScenario({ render:false });
      resetReportWorkspaceState();
      if (gisInitialized) {
        $("#gisSearchInput").value = "";
        $("#gisTypeFilter").value = "all";
        $("#gisLayerControl").classList.remove("is-collapsed");
        $("#gisLayerCollapse").textContent = "−";
        gisRenderAll();
        gisApplyMapTransform();
      }
      if (indicatorInitialized) {
        $("#indicatorSearchInput").value = "";
        indicatorRenderAll();
      }
      syncMotionDebug("force-reset");
      syncDebug();
    }

    function closeDrawersFromMap() {
      const hadDrawer = motion.left.state !== "closed" || motion.right.state !== "closed";
      const transition = motion.right.state !== "closed" ? closeRightDrawer() : closeLeftDrawer();
      if (hadDrawer) transition.then(() => showToast("抽屉已收回，地图恢复操作"));
    }

    function resetApplication(options) {
      const preserveDemo = options && options.preserveDemo;
      cancelManualUpload();
      resetAIRecognitionUI({ silent: true });
      forceResetMotion();
      resetDemoReportGenerationState({ render: false });
      if (preserveDemo && reportGenerationState.status === "generating") {
        clearReportGenerationTimers();
        Object.assign(reportGenerationState, { status: "idle", progress: 0, currentStep: null, generatedSnapshot: null, generatedFiles: [], snapshotId: null, snapshotCreatedAt: null });
      }
      if (!preserveDemo && (!options || options.clearReportDrafts !== false)) resetReportGenerationState({ render: false });
      if (!preserveDemo && (!options || options.clearReportDrafts !== false)) clearAllReportDrafts({ render: false, silent: true });
      appState.activeProjectId = null;
      appState.activeModuleIndex = null;
      updateProjectSelection();
      restoreMap();
      if (preserveDemo || (options && options.preserveManualSpatial)) {
        resetSpatialWorkflowState(demoSpatialCollectionState);
        resetSpatialCollectionView({ render: false, resetWorkflow: false });
      } else {
        resetSpatialCollectionView({ render: false });
      }
      resetUploadUI();
      if (preserveDemo) setWorkflowStage(0, -1, false);
      else setWorkflowStage(null, -1, false);
      appStage.classList.remove("is-demo-intro", "is-demo-sequencing");
      projectEntry.classList.remove("is-demo-focus");
      $$(".city-project-point").forEach((point) => point.classList.remove("is-demo-visible", "is-demo-flash"));
      $$('[data-demo-metric]').forEach((metric) => metric.classList.remove("is-demo-highlight"));
      $("#workspaceProjectName").textContent = "请选择项目";
      $("#aiRecognitionProjectName").textContent = "请选择项目";
      const humanReviewProjectName = $("#humanReviewProjectName");
      if (humanReviewProjectName) humanReviewProjectName.textContent = "请选择项目";
      const gisProjectName = $("#gisProjectName");
      if (gisProjectName) gisProjectName.textContent = "请选择项目";
      const indicatorProjectName = $("#indicatorProjectName");
      if (indicatorProjectName) indicatorProjectName.textContent = "请选择项目";
      const reportProjectName = $("#reportProjectName");
      if (reportProjectName) reportProjectName.textContent = "请选择项目";
      if (!preserveDemo) {
        stopDemoFrame();
        demo.runId += 1;
        demo.elapsed = 0;
        demo.currentStep = "idle";
        demo.fired.clear();
        demo.queue = Promise.resolve();
        demo.workspaceReady = false;
        demo.spatialActive = false;
        demo.spatialRenderKey = "";
        demo.aiWorkspaceReady = false;
        demo.aiStartedAtElapsed = shiftedDemoTime(16.5);
        demo.aiSequenceEndElapsed = shiftedDemoTime(22.5);
        demo.aiNextStageAtElapsed = shiftedDemoTime(22.8);
        demo.aiCompletedImages.clear();
        demo.humanReviewActive = false;
        demo.humanReviewCompletedTaskIds.clear();
        demo.gisActive = false;
        demo.gisDemoBoundIds.clear();
        demo.indicatorActive = false;
        demo.indicatorDemoSimulated = false;
        demo.completing = false;
        setDemoState("idle");
        updateDemoProgress();
      }
      syncDebug();
    }

    function stopDemoFrame() {
      if (demo.rafId) cancelAnimationFrame(demo.rafId);
      demo.rafId = 0;
    }

    const DYNAMIC_DEMO_EVENT_KEYS = new Set(["ai-complete", "ai-next-stage"]);

    function scheduledDemoTime(key, seconds) {
      if (String(key).startsWith("spatial-") || DYNAMIC_DEMO_EVENT_KEYS.has(key)) return seconds;
      return shiftedDemoTime(seconds);
    }

    function at(key, seconds, action) {
      const scheduled = scheduledDemoTime(key, seconds);
      if (demo.elapsed >= scheduled && !demo.fired.has(key)) {
        demo.fired.add(key);
        action();
      }
    }

    function atQueued(key, seconds, action) {
      const scheduled = scheduledDemoTime(key, seconds);
      if (demo.elapsed < scheduled || demo.fired.has(key)) return;
      demo.fired.add(key);
      const runId = demo.runId;
      demo.queue = demo.queue.then(async () => {
        if (runId !== demo.runId || demo.state === "idle") return;
        await action();
      });
    }

    function setDemoStep(step) {
      demo.currentStep = step;
      syncDebug();
    }

    function prepareGISDemoState() {
      if (!initializeGISWorkspace()) return false;
      gisState.selectedMapId = "MAP-021";
      gisState.riskFilter = "all";
      gisState.typeFilter = "all";
      gisState.search = "";
      gisState.activeTab = "detail";
      gisState.radius = "500";
      gisState.objectFilter = null;
      gisState.distanceTarget = null;
      gisState.pendingBindings = new Set(gisIssueData.filter((issue) => issue.gisStatus === "pending").map((issue) => issue.mapId));
      gisState.bindingOverrides.clear();
      gisState.positionOverrides.clear();
      gisState.adjustmentHistory.clear();
      gisState.layers = { boundary: false, buildings: false, planning: false, roads: false, transit: false, publicServices: false, commercial: false, greenHeritage: false, points: false, risk: true, labels: true, imagePoints: false, analysisRange: false };
      gisState.map = { scale: 1, x: 0, y: 0, dragging: false, pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 };
      demo.gisDemoBoundIds.clear();
      $("#gisDemoCompletion").hidden = true;
      gisWorkspace.classList.add("is-demo-layer-sequence");
      gisRenderAll();
      gisApplyMapTransform();
      return true;
    }

    function revealGISDemoLayer(layerName) {
      if (!Object.prototype.hasOwnProperty.call(gisState.layers, layerName)) return;
      gisState.layers[layerName] = true;
      gisRenderAll();
    }

    function bindGISDemoBatch(count) {
      const pending = gisIssueData.filter((issue) => gisState.pendingBindings.has(issue.mapId));
      pending.slice(0, count).forEach((issue) => {
        gisState.pendingBindings.delete(issue.mapId);
        demo.gisDemoBoundIds.add(issue.mapId);
      });
      gisRenderAll();
    }

    function showGISDemoCompletion() {
      if (gisState.pendingBindings.size) return false;
      $("#gisDemoCompletion").hidden = false;
      setDemoStep("gis-spatial-binding-complete");
      return true;
    }

    function prepareIndicatorDemoState() {
      if (!initializeIndicatorWorkspace()) return false;
      resetIndicatorScenario({ render:false });
      indicatorState.selectedIndicatorId = "IND-BS-03";
      indicatorState.statusFilter = "all";
      indicatorState.search = "";
      indicatorState.categoryFocus = "all";
      indicatorState.activeTab = "detail";
      indicatorState.issueRiskFilter = "all";
      indicatorState.issueTypeFilter = "all";
      indicatorState.lastLocatedMapId = null;
      $("#indicatorSearchInput").value = "";
      $("#indicatorDemoCompletion").hidden = true;
      indicatorRenderAll();
      return true;
    }

    function applyIndicatorDemoScenario(resolveMap001) {
      if (!indicatorScenarioState.enabled) enterIndicatorScenarioMode();
      indicatorState.selectedIndicatorId = "IND-BS-03";
      if (resolveMap001) {
        indicatorState.activeTab = "issues";
        if (!indicatorScenarioState.resolvedIssueIds.has("MAP-001")) toggleScenarioIssue("MAP-001",true);
        demo.indicatorDemoSimulated = true;
      }
      indicatorRenderAll();
    }

    function restoreIndicatorDemoBaseline() {
      if (indicatorScenarioState.enabled) {
        resetAllIndicatorRules();
        exitIndicatorScenarioMode(true);
      } else {
        resetIndicatorScenario({ keepEnabled:false, render:false });
      }
      indicatorState.selectedIndicatorId = "IND-BS-03";
      indicatorState.activeTab = "detail";
      demo.indicatorDemoSimulated = false;
      indicatorRenderAll();
    }

    function showIndicatorDemoCompletion() {
      restoreIndicatorDemoBaseline();
      $("#indicatorDemoCompletion").hidden = false;
      setDemoStep("indicator-calculation-complete");
      return true;
    }

    async function applyIndicatorDemoStateAt(target, stale) {
      if (target < shiftedDemoTime(39.35)) return true;
      if (target < shiftedDemoTime(39.95)) {
        setWorkflowStage(4,3,true);
        await openModule(4);
        return !stale();
      }
      if (target < shiftedDemoTime(44.1)) {
        if (!prepareIndicatorDemoState()) return false;
        const opened = await openIndicatorWorkspace();
        if (opened === false || stale()) return false;
        demo.indicatorActive = true;
        setWorkflowStage(4,3,false);
        if (target >= shiftedDemoTime(41.1)) indicatorSelect("IND-BS-03",{ showDetail:true });
        if (target >= shiftedDemoTime(41.55)) indicatorSetTab("basis");
        if (target >= shiftedDemoTime(41.95) && target < shiftedDemoTime(43.15)) applyIndicatorDemoScenario(target >= shiftedDemoTime(42.3));
        if (target >= shiftedDemoTime(43.15)) restoreIndicatorDemoBaseline();
        if (target >= shiftedDemoTime(43.6)) showIndicatorDemoCompletion();
        return !stale();
      }
      demo.indicatorActive = false;
      demo.indicatorDemoSimulated = false;
      resetIndicatorScenario({ render:false });
      $("#indicatorDemoCompletion").hidden = true;
      await resetCityMapFocus({ closeDetail:false, interactionSource:"demo-indicator-seek-complete" });
      setWorkflowStage(5,4,true);
      appState.activeViewStage = null;
      renderStageNavigation();
      return !stale();
    }

    function demoReportProgressAt(target) {
      if (target < shiftedDemoTime(48.7)) return 0;
      if (target >= shiftedDemoTime(51.7)) return 100;
      return clamp((target - shiftedDemoTime(48.7)) / 3 * 100, 0, 100);
    }

    function updateDemoReportGenerationAt(target, options = {}) {
      if (target < shiftedDemoTime(45.05)) { resetDemoReportGenerationState({ render: false }); return; }
      demoReportGenerationState.active = true;
      const previousStatus = demoReportGenerationState.status;
      const progress = demoReportProgressAt(target);
      if (target < shiftedDemoTime(48.55)) {
        demoReportGenerationState.status = "idle";
        demoReportGenerationState.progress = 0;
        demoReportGenerationState.currentStep = null;
      } else if (target < shiftedDemoTime(52)) {
        demoReportGenerationState.status = "generating";
        demoReportGenerationState.progress = progress;
        const step = REPORT_GENERATION_STEPS.find(([threshold]) => progress <= threshold) || REPORT_GENERATION_STEPS[4];
        demoReportGenerationState.currentStep = step[1];
        if (!demoReportGenerationState.generatedSnapshot) demoReportGenerationState.generatedSnapshot = createGeneratedReportSnapshot({ demo: true, sourceMode: "baseline", reportType: "comprehensive", specialTopic: "building" });
      } else {
        demoReportGenerationState.status = "completed";
        demoReportGenerationState.progress = 100;
        demoReportGenerationState.currentStep = "报告包封装完成";
        demoReportGenerationState.outputReady = target >= shiftedDemoTime(52.8);
        demoReportGenerationState.completionVisible = target >= shiftedDemoTime(53.65);
        if (!demoReportGenerationState.generatedSnapshot) demoReportGenerationState.generatedSnapshot = createGeneratedReportSnapshot({ demo: true, sourceMode: "baseline", reportType: "comprehensive", specialTopic: "building" });
      }
      const progressKey = Math.floor(demoReportGenerationState.progress / 2);
      if (options.render && reportWorkspaceInitialized && (progressKey !== demoReportGenerationState.lastRenderedProgress || previousStatus !== demoReportGenerationState.status)) {
        demoReportGenerationState.lastRenderedProgress = progressKey;
        reportRenderConfig();
        reportRenderGenerationFooter();
      }
    }

    async function applyReportDemoStateAt(target, stale) {
      if (target < shiftedDemoTime(44.8)) return true;
      updateDemoReportGenerationAt(target, { render: false });
      if (target < shiftedDemoTime(45.05)) {
        setWorkflowStage(5,4,true);
        $("#reportSixStageSummary").hidden = true;
        return !stale();
      }
      if (target < shiftedDemoTime(45.7)) {
        setWorkflowStage(5,4,false);
        await openModule(5);
        return !stale();
      }
      if (target < shiftedDemoTime(54.35)) {
        reportWorkbenchState.mode = "baseline";
        reportDraftState.enabled = false;
        reportWorkbenchState.reportType = "comprehensive";
        reportWorkbenchState.specialTopic = "building";
        reportWorkbenchState.printPreview = false;
        const opened = await openStageWorkspace(5,{ automated:true });
        if (opened === false || stale()) return false;
        if (target < shiftedDemoTime(47.15)) { reportWorkbenchState.pageIndex = 2; reportWorkbenchState.activeTab = "config"; }
        else if (target < shiftedDemoTime(47.95)) { reportWorkbenchState.pageIndex = 3; reportWorkbenchState.activeTab = "trace"; }
        else { reportWorkbenchState.pageIndex = 3; reportWorkbenchState.activeTab = "config"; }
        updateDemoReportGenerationAt(target, { render: false });
        if (target >= shiftedDemoTime(53.65)) setWorkflowStage(null,5,false);
        else setWorkflowStage(5,4,false);
        $("#reportSixStageSummary").hidden = true;
        reportRenderAll();
        return !stale();
      }
      if (appState.reportWorkspaceOpen) await closeReportWorkspace();
      if (motion.right.state !== "closed") await closeRightDrawer();
      await resetCityMapFocus({ closeDetail:true, interactionSource:"demo-six-stage-complete" });
      appState.activeViewStage = null;
      appState.activeDrawerStage = null;
      appState.activeWorkspaceStage = null;
      setWorkflowStage(null,5,false);
      $("#reportSixStageSummary").hidden = target < shiftedDemoTime(54.8);
      return !stale();
    }

    const LEGACY_DEMO_SEEK_EVENTS = [
      ["map-intro",0],["project-point-0",.8],["project-point-1",1.55],["project-point-2",1.85],["project-point-3",2.15],["project-point-4",2.45],["project-point-5",2.75],
      ["project-entry",3],["open-city-list",3.35],["select-project",4.65],["project-detail",5.95],["metric-completeness",6.15],["metric-candidate",6.55],["metric-review",6.95],
      ["module-01",7.5],["workspace-01",9],["upload-complete",13.2],["module-02",14],["workspace-02",15.15],["ai-complete",21.63],["ai-next-stage",22.28],
      ["module-03",23],["workspace-03",23.8],["review-DEF-021-prepare",24.8],["review-DEF-021-save",25.45],["review-DEF-024-prepare",25.9],["review-DEF-024-save",26.75],
      ["review-DEF-034-prepare",27.15],["review-DEF-034-save",28],["review-DEF-028-prepare",28.4],["review-DEF-028-save",28.62],["review-DEF-031-prepare",28.84],["review-DEF-031-save",29.06],
      ["review-DEF-038-prepare",29.28],["review-DEF-038-save",29.5],["review-DEF-041-prepare",29.72],["review-DEF-041-save",29.94],["review-complete",30.2],["review-close-next-04",31.65],
      ["gis-module-drawer",33],["gis-workspace-open",33.55],["gis-layer-boundary",34.4],["gis-layer-buildings",34.57],["gis-layer-roads",34.75],["gis-layer-public-services",34.93],
      ["gis-layer-points",35.1],["gis-select-map-021",35.2],["gis-surroundings",35.6],["gis-radius-500",35.95],["gis-radius-800",36.35],["gis-bind-batch-1",36.8],
      ["gis-bind-batch-2",37.25],["gis-bind-batch-3",37.7],["gis-completion-summary",37.9],["gis-close-next-05",38.55],
      ["indicator-module-drawer",39.35],["indicator-workspace-open",39.95],["indicator-baseline-stable",40.55],["indicator-select-BS-03",41.1],
      ["indicator-basis-tab",41.55],["indicator-scenario-start",41.95],["indicator-resolve-MAP-001",42.3],["indicator-scenario-result",42.65],
      ["indicator-restore-baseline",43.15],["indicator-completion-summary",43.6],["indicator-close-next-06",44.1],["indicator-final-06-hold",44.5],
      ["report-module-drawer",45.05],["report-workspace-open",45.7],["report-summary-page",46.35],["report-trace-page",47.15],["report-config-validation",47.95],
      ["report-generation-start",48.55],["report-generation-complete",52],["report-output-ready",52.8],["report-six-stage-complete",53.65],["report-return-overview",54.35],["report-final-summary",54.8]
    ];
    const SPATIAL_DEMO_SEEK_EVENTS = [
      ["spatial-view-open",14.15],["spatial-route-cleaning",14.65],["spatial-auto-locate-1",15.05],["spatial-auto-locate-2",15.4],
      ["spatial-auto-locate-3",15.75],["spatial-locate-complete",16.1],["spatial-binding-progress",16.3],["spatial-route-linking",16.9],["spatial-demo-complete",17.5]
    ];
    const DEMO_SEEK_EVENTS = [
      ...LEGACY_DEMO_SEEK_EVENTS.map(([key, seconds]) => [key, shiftedDemoTime(seconds)]),
      ...SPATIAL_DEMO_SEEK_EVENTS
    ].sort((a, b) => a[1] - b[1]);

    function seedDemoTimelineAfterSeek(target) {
      demo.fired.clear();
      DEMO_SEEK_EVENTS.forEach(([key, seconds]) => { if (target >= seconds) demo.fired.add(key); });
      demo.workspaceReady = target >= 9 && target < shiftedDemoTime(14);
      demo.spatialActive = target >= 14.15 && target < shiftedDemoTime(14);
      demo.spatialRenderKey = "";
      demo.aiWorkspaceReady = target >= shiftedDemoTime(15.15) && target < shiftedDemoTime(23);
      demo.aiStartedAtElapsed = shiftedDemoTime(15.63);
      demo.aiSequenceEndElapsed = shiftedDemoTime(21.63);
      demo.aiNextStageAtElapsed = shiftedDemoTime(22.28);
      demo.humanReviewActive = target >= shiftedDemoTime(23.8) && target < shiftedDemoTime(31.65);
      demo.gisActive = target >= shiftedDemoTime(33.55) && target < shiftedDemoTime(38.55);
      demo.indicatorActive = target >= shiftedDemoTime(39.95) && target < shiftedDemoTime(44.1);
      demo.indicatorDemoSimulated = target >= shiftedDemoTime(42.3) && target < shiftedDemoTime(43.15);
      demoReportGenerationState.active = target >= shiftedDemoTime(45.05);
    }

    async function applyDemoStateAt(target, seekToken) {
      const stale = () => seekToken !== demo.seekToken;
      const project = cityProjects[0];
      if (target >= 14) renderUploadProgress(1);
      if (target >= shiftedDemoTime(23)) {
        aiRecognitionState.source = "auto";
        completeAIRecognitionRun("auto");
      }
      if (target >= shiftedDemoTime(31.65)) {
        humanReviewState = humanReviewCreateState();
        humanReviewState.tasks.forEach((task) => humanReviewApplyPresetResult(humanReviewState,task.taskId));
        humanReviewState.completed = true;
        humanReviewState.sessionMessage = "人工复核已完成，等待GIS落图与问题清单生成";
        if (humanReviewInitialized) humanReviewRenderAll();
      }
      if (target >= shiftedDemoTime(38.55)) {
        gisState.pendingBindings.clear();
        gisIssueData.filter((issue) => issue.gisStatus === "pending").forEach((issue) => demo.gisDemoBoundIds.add(issue.mapId));
      }
      appStage.classList.toggle("is-demo-intro", target >= 0 && target < 3.35);
      appStage.classList.toggle("is-demo-sequencing", target < shiftedDemoTime(39.2));
      $$(".city-project-point").forEach((point, index) => point.classList.toggle("is-demo-visible", target >= [.8,1.55,1.85,2.15,2.45,2.75][index]));
      if (target >= 3) projectEntry.classList.add("is-demo-focus");
      if (target >= 3.35 && target < 5.95) {
        await openLeftDrawer("list");
        if (stale()) return false;
      }
      if (target >= 4.65) {
        await selectProject(project.id, { openDetail:false, pan:target < 7.5 });
        if (stale()) return false;
      }
      if (target >= 5.95 && target < 7.5) {
        await openLeftDrawer("detail");
        if (stale()) return false;
        if (target >= 6.15) $("[data-demo-metric='completeness']").classList.add("is-demo-highlight");
        if (target >= 6.55) $("[data-demo-metric='candidate']").classList.add("is-demo-highlight");
        if (target >= 6.95) $("[data-demo-metric='review']").classList.add("is-demo-highlight");
      }
      if (target >= 7.5 && target < 9) {
        setWorkflowStage(0,-1,false);
        await openModule(0);
        if (stale()) return false;
      } else if (target >= 9 && target < SPATIAL_DEMO_START) {
        setWorkflowStage(target >= 13.2 ? 1 : 0,target >= 13.2 ? 0 : -1,target >= 13.2);
        await openWorkspace();
        if (stale()) return false;
        renderUploadProgress(target < 10 ? 0 : clamp((target - 10) / 3.2,0,1));
      } else if (target >= SPATIAL_DEMO_START && target < shiftedDemoTime(14)) {
        setWorkflowStage(target >= 17.5 ? 1 : 0,target >= 17.5 ? 0 : -1,target >= 17.5);
        await openWorkspace();
        if (stale()) return false;
        if (target < 14.15) {
          spatialCollectionState.workflowSource = "manual";
          setSpatialCollectionView("governance");
        } else {
          spatialCollectionState.workflowSource = "demo";
          setSpatialCollectionView("spatial");
          applySpatialDemoStateAt(target);
        }
      } else if (target >= shiftedDemoTime(14) && target < shiftedDemoTime(15.15)) {
        setWorkflowStage(1,0,false);
        await openModule(1);
        if (stale()) return false;
      } else if (target >= shiftedDemoTime(15.15) && target < shiftedDemoTime(23)) {
        setWorkflowStage(target >= shiftedDemoTime(22.28) ? 2 : 1,target >= shiftedDemoTime(22.28) ? 1 : 0,target >= shiftedDemoTime(22.28));
        await openAIRecognitionWorkspace();
        if (stale()) return false;
        resetAIRecognitionUI({ silent:true });
        aiRecognitionState.source = "auto";
        aiRecognitionState.status = "playing";
        aiRecognitionState.autoSequenceIndex = -1;
        demo.aiStartedAtElapsed = shiftedDemoTime(15.63);
        demo.aiSequenceEndElapsed = shiftedDemoTime(21.63);
        demo.aiNextStageAtElapsed = shiftedDemoTime(22.28);
        if (target >= demo.aiSequenceEndElapsed) completeAIRecognitionRun("auto");
        else if (target >= demo.aiStartedAtElapsed) renderAutoAIRecognitionSequence(target);
        else renderAIRecognitionProgress(0,{ status:"playing",force:true });
        if (target >= demo.aiNextStageAtElapsed) setAIRecognitionNextStage();
      } else if (target >= shiftedDemoTime(23) && target < shiftedDemoTime(23.8)) {
        setWorkflowStage(2,1,false);
        await openModule(2);
        if (stale()) return false;
      } else if (target >= shiftedDemoTime(23.8) && target < shiftedDemoTime(31.65)) {
        setWorkflowStage(target >= shiftedDemoTime(30.2) ? 3 : 2,target >= shiftedDemoTime(30.2) ? 2 : 1,target >= shiftedDemoTime(30.2));
        await openHumanReviewWorkspace();
        if (stale()) return false;
        const reviewSteps = [
          ["DEF-021",shiftedDemoTime(24.8),shiftedDemoTime(25.45)],["DEF-024",shiftedDemoTime(25.9),shiftedDemoTime(26.75)],["DEF-034",shiftedDemoTime(27.15),shiftedDemoTime(28)],
          ["DEF-028",shiftedDemoTime(28.4),shiftedDemoTime(28.62)],["DEF-031",shiftedDemoTime(28.84),shiftedDemoTime(29.06)],["DEF-038",shiftedDemoTime(29.28),shiftedDemoTime(29.5)],["DEF-041",shiftedDemoTime(29.72),shiftedDemoTime(29.94)]
        ];
        reviewSteps.forEach(([taskId,prepareAt,saveAt]) => {
          if (target >= saveAt) {
            humanReviewPrepareAutomatedTask(taskId);
            humanReviewCommitAutomatedTask(taskId);
          } else if (target >= prepareAt) humanReviewPrepareAutomatedTask(taskId);
        });
        if (target >= shiftedDemoTime(30.2)) humanReviewComplete({ automated:true });
      } else if (target >= shiftedDemoTime(31.65) && target < shiftedDemoTime(33)) {
        setWorkflowStage(3,2,true);
      } else if (target >= shiftedDemoTime(33) && target < shiftedDemoTime(33.55)) {
        setWorkflowStage(3,2,false);
        await openModule(3);
        if (stale()) return false;
      } else if (target >= shiftedDemoTime(33.55) && target < shiftedDemoTime(38.55)) {
        setWorkflowStage(3,2,false);
        prepareGISDemoState();
        await openGISWorkspace();
        if (stale()) return false;
        if (target >= shiftedDemoTime(34.4)) revealGISDemoLayer("boundary");
        if (target >= shiftedDemoTime(34.57)) revealGISDemoLayer("buildings");
        if (target >= shiftedDemoTime(34.75)) revealGISDemoLayer("roads");
        if (target >= shiftedDemoTime(34.93)) revealGISDemoLayer("publicServices");
        if (target >= shiftedDemoTime(35.1)) revealGISDemoLayer("points");
        if (target >= shiftedDemoTime(35.2)) gisSelectIssue("MAP-021",{ center:true,scroll:true });
        if (target >= shiftedDemoTime(35.6)) gisSetActiveTab("surroundings",{ autoEnable:false });
        if (target >= shiftedDemoTime(35.95)) { gisState.radius="500"; gisState.layers.analysisRange=true; gisState.layers.transit=true; gisState.layers.publicServices=true; }
        if (target >= shiftedDemoTime(36.35)) gisState.radius="800";
        if (target >= shiftedDemoTime(36.8)) bindGISDemoBatch(2);
        if (target >= shiftedDemoTime(37.25)) bindGISDemoBatch(2);
        if (target >= shiftedDemoTime(37.7)) bindGISDemoBatch(2);
        gisRenderAll();
        if (target >= shiftedDemoTime(37.9)) showGISDemoCompletion();
      } else if (target >= shiftedDemoTime(38.55)) {
        setWorkflowStage(4,3,true);
        appState.activeViewStage = null;
        renderStageNavigation();
      }
      if (target >= shiftedDemoTime(39.35)) {
        const indicatorApplied = await applyIndicatorDemoStateAt(target,stale);
        if (!indicatorApplied || stale()) return false;
      }
      if (target >= shiftedDemoTime(44.8)) {
        const reportApplied = await applyReportDemoStateAt(target,stale);
        if (!reportApplied || stale()) return false;
      }
      return !stale();
    }

    async function seekDemoTo(seconds) {
      const target = clamp(Number(seconds) || 0,0,DEMO_DURATION);
      const token = ++demo.seekToken;
      demo.seeking = true;
      $("#demoTimeline").classList.add("is-seeking");
      stopDemoFrame();
      resetApplication({ preserveDemo:false, clearReportDrafts:false, preserveManualSpatial:true });
      demo.runId += 1;
      demo.elapsed = target;
      demo.currentStep = "seek-" + target.toFixed(1);
      demo.queue = Promise.resolve();
      const applied = await applyDemoStateAt(target,token);
      if (!applied || token !== demo.seekToken) return false;
      seedDemoTimelineAfterSeek(target);
      demo.elapsed = target;
      demo.seeking = false;
      $("#demoTimeline").classList.remove("is-seeking");
      setDemoState(target >= DEMO_DURATION ? "completed" : "paused");
      updateDemoProgress();
      return true;
    }

    function runDemoTimeline() {
      at("map-intro", 0, () => {
        setDemoStep("city-map-intro");
        appStage.classList.add("is-demo-intro", "is-demo-sequencing");
      });

      const pointTimes = [0.8, 1.55, 1.85, 2.15, 2.45, 2.75];
      pointTimes.forEach((time, index) => {
        at("point-" + index, time, () => {
          setDemoStep("project-points");
          const point = $$(".city-project-point")[index];
          if (point) {
            $$(".city-project-point").forEach((item) => item.classList.remove("is-demo-flash"));
            point.classList.add("is-demo-visible", "is-demo-flash");
          }
        });
      });

      at("entry-focus", 3, () => {
        setDemoStep("project-entry");
        $$(".city-project-point").forEach((point) => point.classList.remove("is-demo-flash"));
        projectEntry.classList.add("is-demo-focus");
      });
      atQueued("open-city-list", 3.35, async () => {
        await openLeftDrawer("list");
        projectEntry.classList.remove("is-demo-focus");
      });
      atQueued("select-project", 4.65, async () => {
        setDemoStep("select-P1");
        await selectProject("P1", { openDetail: false, pan: true });
      });
      atQueued("project-detail", 5.95, async () => {
        setDemoStep("project-detail");
        await openLeftDrawer("detail");
      });
      atQueued("metric-completeness", 6.15, () => $("[data-demo-metric='completeness']").classList.add("is-demo-highlight"));
      atQueued("metric-candidate", 6.55, () => $("[data-demo-metric='candidate']").classList.add("is-demo-highlight"));
      atQueued("metric-review", 6.95, () => $("[data-demo-metric='review']").classList.add("is-demo-highlight"));
      atQueued("module-01", 7.5, async () => {
        setDemoStep("module-01-panel");
        await openModule(0);
      });
      atQueued("workspace-01", 9, async () => {
        setDemoStep("workspace-01");
        await openWorkspace();
        resetUploadUI();
        demo.workspaceReady = true;
      });
      if (demo.workspaceReady && demo.elapsed >= 10 && demo.elapsed <= 13.2) {
        setDemoStep("upload-governance");
        renderUploadProgress((demo.elapsed - 10) / 3.2);
      }
      atQueued("upload-complete", 13.2, () => {
        renderUploadProgress(1);
        setDemoStep("next-stage-02");
        highlightNextStage(1);
      });

      at("spatial-view-open", 14.15, () => {
        setDemoStep("spatial-collection-open");
        demo.spatialActive = true;
        demo.spatialRenderKey = "";
        spatialCollectionState.workflowSource = "demo";
        setWorkflowStage(0, -1, false);
        setSpatialCollectionView("spatial");
      });
      if (demo.spatialActive && demo.elapsed >= 14.15 && demo.elapsed < 18) {
        const local = demo.elapsed - SPATIAL_DEMO_START;
        setDemoStep(local < .65 ? "spatial-route-cleaning" : local < 1.05 ? "spatial-route-ready" : local < 2.1 ? "spatial-auto-locating" : local < 2.85 ? "spatial-confirm-binding" : local < 3.5 ? "spatial-route-linking" : "spatial-collection-complete");
        applySpatialDemoStateAt(demo.elapsed);
      }
      at("spatial-demo-complete", 17.5, () => {
        applySpatialDemoStateAt(18);
        setDemoStep("spatial-collection-complete");
        setWorkflowStage(1, 0, true);
      });

      atQueued("module-02", 14, async () => {
        demo.spatialActive = false;
        spatialCollectionState.workflowSource = "manual";
        setDemoStep("module-02-panel");
        await closeWorkspace();
        await openModule(1);
      });
      atQueued("workspace-02", 15.15, async () => {
        setDemoStep("workspace-02");
        await closeRightDrawer({ keepBackdrop: true });
        const workspaceOpening = openAIRecognitionWorkspace();
        resetAIRecognitionUI({ silent: true });
        aiRecognitionState.source = "auto";
        aiRecognitionState.status = "playing";
        aiRecognitionState.autoSequenceIndex = -1;
        aiRecognitionWorkspace.classList.add("is-auto-sequence");
        demo.aiWorkspaceReady = true;
        demo.aiStartedAtElapsed = demo.elapsed + 0.48;
        demo.aiSequenceEndElapsed = demo.aiStartedAtElapsed + autoAIImageSequence.length * AUTO_AI_IMAGE_SECONDS;
        demo.aiNextStageAtElapsed = Math.min(shiftedDemoTime(22.72), demo.aiSequenceEndElapsed + 0.65);
        demo.aiCompletedImages.clear();
        renderAIRecognitionProgress(0, { status: "playing", force: true });
        await workspaceOpening;
      });
      if (demo.aiWorkspaceReady && demo.elapsed >= demo.aiStartedAtElapsed && demo.elapsed < demo.aiSequenceEndElapsed) {
        setDemoStep("ai-recognition-scanning");
        aiRecognitionState.source = "auto";
        renderAutoAIRecognitionSequence(demo.elapsed);
      }
      if (demo.aiWorkspaceReady) {
        at("ai-complete", demo.aiSequenceEndElapsed, () => {
          completeAutoAISequenceImage(autoAIImageSequence.length - 1, demo.elapsed);
          completeAIRecognitionRun("auto");
          setDemoStep("ai-recognition-complete");
        });
        if (demo.fired.has("ai-complete")) {
          at("ai-next-stage", demo.aiNextStageAtElapsed, () => {
            setAIRecognitionNextStage();
            setDemoStep("next-stage-03");
          });
        }
      }

      atQueued("module-03", 23.0, async () => {
        setDemoStep("module-03-panel");
        await closeAIRecognitionWorkspace();
        await openModule(2);
      });
      atQueued("workspace-03", 23.8, async () => {
        setDemoStep("workspace-03-initial");
        const opened = await openHumanReviewWorkspace();
        demo.humanReviewActive = opened !== false;
      });

      if (demo.humanReviewActive) {
        at("review-DEF-021-prepare", 24.8, () => {
          setDemoStep("review-DEF-021-confirm");
          humanReviewPrepareAutomatedTask("DEF-021");
        });
        at("review-DEF-021-save", 25.45, () => humanReviewCommitAutomatedTask("DEF-021"));

        at("review-DEF-024-prepare", 25.9, () => {
          setDemoStep("review-DEF-024-modify");
          humanReviewPrepareAutomatedTask("DEF-024");
        });
        at("review-DEF-024-save", 26.75, () => humanReviewCommitAutomatedTask("DEF-024"));

        at("review-DEF-034-prepare", 27.15, () => {
          setDemoStep("review-DEF-034-exclude");
          humanReviewPrepareAutomatedTask("DEF-034");
        });
        at("review-DEF-034-save", 28.0, () => humanReviewCommitAutomatedTask("DEF-034"));

        at("review-DEF-028-prepare", 28.4, () => {
          setDemoStep("review-remaining-priority");
          humanReviewPrepareAutomatedTask("DEF-028");
        });
        at("review-DEF-028-save", 28.62, () => humanReviewCommitAutomatedTask("DEF-028"));
        at("review-DEF-031-prepare", 28.84, () => humanReviewPrepareAutomatedTask("DEF-031"));
        at("review-DEF-031-save", 29.06, () => humanReviewCommitAutomatedTask("DEF-031"));
        at("review-DEF-038-prepare", 29.28, () => humanReviewPrepareAutomatedTask("DEF-038"));
        at("review-DEF-038-save", 29.5, () => humanReviewCommitAutomatedTask("DEF-038"));
        at("review-DEF-041-prepare", 29.72, () => humanReviewPrepareAutomatedTask("DEF-041"));
        at("review-DEF-041-save", 29.94, () => humanReviewCommitAutomatedTask("DEF-041"));

        at("review-complete", 30.2, () => {
          if (humanReviewComplete({ automated: true })) setDemoStep("human-review-complete");
        });
        atQueued("review-close-next-04", 31.65, async () => {
          demo.humanReviewActive = false;
          await closeHumanReviewWorkspace();
          setDemoStep("next-stage-04");
        });
      }

      atQueued("gis-module-drawer", 33.0, async () => {
        setDemoStep("module-04-panel");
        appState.activeViewStage = null;
        setWorkflowStage(3, 2, false);
        await openModule(3);
        renderStageNavigation();
      });
      atQueued("gis-workspace-open", 33.55, async () => {
        setDemoStep("gis-workspace-open");
        if (!prepareGISDemoState()) return;
        const opened = await openGISWorkspace();
        demo.gisActive = opened !== false;
        if (demo.gisActive) {
          appState.activeViewStage = 3;
          renderStageNavigation();
        }
      });

      if (demo.gisActive) {
        at("gis-layer-boundary", 34.4, () => revealGISDemoLayer("boundary"));
        at("gis-layer-buildings", 34.57, () => revealGISDemoLayer("buildings"));
        at("gis-layer-roads", 34.75, () => revealGISDemoLayer("roads"));
        at("gis-layer-public-services", 34.93, () => revealGISDemoLayer("publicServices"));
        at("gis-layer-points", 35.1, () => revealGISDemoLayer("points"));
        at("gis-select-map-021", 35.2, () => {
          setDemoStep("gis-select-MAP-021");
          gisSelectIssue("MAP-021", { center: true, scroll: true });
        });
        at("gis-surroundings", 35.6, () => {
          setDemoStep("gis-surroundings");
          gisSetActiveTab("surroundings", { autoEnable: false });
        });
        at("gis-radius-500", 35.95, () => {
          setDemoStep("gis-radius-500");
          gisState.radius = "500";
          gisState.layers.analysisRange = true;
          gisState.layers.transit = true;
          gisState.layers.publicServices = true;
          gisRenderAll();
        });
        at("gis-radius-800", 36.35, () => {
          setDemoStep("gis-radius-800");
          gisState.radius = "800";
          gisRenderAll();
        });
        at("gis-bind-batch-1", 36.8, () => {
          setDemoStep("gis-binding-38-of-42");
          bindGISDemoBatch(2);
        });
        at("gis-bind-batch-2", 37.25, () => {
          setDemoStep("gis-binding-40-of-42");
          bindGISDemoBatch(2);
        });
        at("gis-bind-batch-3", 37.7, () => {
          setDemoStep("gis-binding-42-of-42");
          bindGISDemoBatch(2);
        });
        at("gis-completion-summary", 37.9, () => showGISDemoCompletion());
        atQueued("gis-close-next-05", 38.55, async () => {
          setDemoStep("next-stage-05");
          demo.gisActive = false;
          $("#gisDemoCompletion").hidden = true;
          await closeGISWorkspace();
          gisWorkspace.classList.remove("is-demo-layer-sequence");
          appState.activeViewStage = null;
          setWorkflowStage(4, 3, true);
        });
      }

      atQueued("indicator-module-drawer",39.35,async () => {
        setDemoStep("module-05-panel");
        setWorkflowStage(4,3,true);
        await openModule(4);
      });
      atQueued("indicator-workspace-open",39.95,async () => {
        setDemoStep("indicator-baseline-open");
        if (!prepareIndicatorDemoState()) return;
        const opened = await openStageWorkspace(4,{ automated:true });
        demo.indicatorActive = opened !== false;
        if (demo.indicatorActive) setWorkflowStage(4,3,false);
      });

      if (demo.indicatorActive) {
        at("indicator-baseline-stable",40.55,() => {
          setDemoStep("indicator-baseline-82.4");
          restoreIndicatorDemoBaseline();
        });
        at("indicator-select-BS-03",41.1,() => {
          setDemoStep("indicator-select-IND-BS-03");
          indicatorSelect("IND-BS-03",{ showDetail:true });
        });
        at("indicator-basis-tab",41.55,() => {
          setDemoStep("indicator-evidence-chain");
          indicatorSetTab("basis");
        });
        at("indicator-scenario-start",41.95,() => {
          setDemoStep("indicator-scenario-start");
          applyIndicatorDemoScenario(false);
        });
        at("indicator-resolve-MAP-001",42.3,() => {
          setDemoStep("indicator-simulate-MAP-001");
          applyIndicatorDemoScenario(true);
        });
        at("indicator-scenario-result",42.65,() => setDemoStep("indicator-scenario-82.7"));
        at("indicator-restore-baseline",43.15,() => {
          setDemoStep("indicator-restore-82.4");
          restoreIndicatorDemoBaseline();
        });
        at("indicator-completion-summary",43.6,() => showIndicatorDemoCompletion());
        atQueued("indicator-close-next-06",44.1,async () => {
          setDemoStep("next-stage-06");
          demo.indicatorActive = false;
          demo.indicatorDemoSimulated = false;
          $("#indicatorDemoCompletion").hidden = true;
          resetIndicatorScenario({ render:false });
          await closeIndicatorWorkspace();
          await resetCityMapFocus({ closeDetail:false, interactionSource:"demo-indicator-complete" });
          appState.activeViewStage = null;
          setWorkflowStage(5,4,true);
        });
      }
      at("indicator-final-06-hold",44.5,() => setDemoStep("final-next-stage-06"));

      atQueued("report-module-drawer",45.05,async () => {
        setDemoStep("module-06-panel");
        demoReportGenerationState.active = true;
        setWorkflowStage(5,4,false);
        await openModule(5);
      });
      atQueued("report-workspace-open",45.7,async () => {
        setDemoStep("report-workspace-open");
        reportWorkbenchState.mode = "baseline";
        reportDraftState.enabled = false;
        reportWorkbenchState.reportType = "comprehensive";
        reportWorkbenchState.specialTopic = "building";
        reportWorkbenchState.pageIndex = 0;
        reportWorkbenchState.activeTab = "config";
        await openStageWorkspace(5,{ automated:true });
        setWorkflowStage(5,4,false);
      });
      at("report-summary-page",46.35,() => {
        setDemoStep("report-RPT-03-summary");
        reportWorkbenchState.pageIndex = 2;
        reportWorkbenchState.activeTab = "config";
        reportRenderAll();
      });
      at("report-trace-page",47.15,() => {
        setDemoStep("report-RPT-04-trace");
        reportWorkbenchState.pageIndex = 3;
        reportWorkbenchState.activeTab = "trace";
        reportRenderAll();
      });
      at("report-config-validation",47.95,() => {
        setDemoStep("report-validation-blocking-0");
        reportWorkbenchState.activeTab = "config";
        reportRenderAll();
      });
      at("report-generation-start",48.55,() => {
        setDemoStep("report-generation-start");
        updateDemoReportGenerationAt(demo.elapsed,{ render:true });
      });
      if (demo.elapsed >= shiftedDemoTime(48.55) && demo.elapsed < shiftedDemoTime(54.35)) updateDemoReportGenerationAt(demo.elapsed,{ render:true });
      at("report-generation-complete",52,() => {
        setDemoStep("report-package-generated");
        updateDemoReportGenerationAt(shiftedDemoTime(52),{ render:true });
      });
      at("report-output-ready",52.8,() => {
        setDemoStep("report-output-capabilities-ready");
        updateDemoReportGenerationAt(shiftedDemoTime(52.8),{ render:true });
      });
      at("report-six-stage-complete",53.65,() => {
        setDemoStep("six-stage-assessment-complete");
        demoReportGenerationState.completionVisible = true;
        setWorkflowStage(null,5,false);
        reportRenderConfig();
        reportRenderGenerationFooter();
      });
      atQueued("report-return-overview",54.35,async () => {
        setDemoStep("report-return-overview");
        await closeReportWorkspace();
        await resetCityMapFocus({ closeDetail:true,interactionSource:"demo-six-stage-complete" });
        appState.activeViewStage = null;
        appState.activeDrawerStage = null;
        appState.activeWorkspaceStage = null;
        setWorkflowStage(null,5,false);
      });
      at("report-final-summary",54.8,() => {
        setDemoStep("final-six-stage-summary");
        $("#reportSixStageSummary").hidden = false;
        setWorkflowStage(null,5,false);
      });
    }

    function completeDemoAfterTransitions() {
      if (demo.completing) return;
      demo.completing = true;
      stopDemoFrame();
      const runId = demo.runId;
      demo.queue.then(() => {
        if (runId !== demo.runId) return;
        demo.completing = false;
        if (demo.state !== "playing") return;
        demo.elapsed = DEMO_DURATION;
        demo.currentStep = "completed-six-stage-assessment";
        setDemoState("completed");
        updateDemoProgress();
      });
    }

    function demoFrame(now) {
      if (demo.state !== "playing") return;
      demo.elapsed = Math.min(DEMO_DURATION, (now - demo.startedAt) / 1000);
      runDemoTimeline();
      updateDemoProgress();
      if (demo.elapsed < DEMO_DURATION) {
        demo.rafId = requestAnimationFrame(demoFrame);
      } else {
        completeDemoAfterTransitions();
      }
    }

    function startDemo() {
      stopDemoFrame();
      resetApplication({ preserveDemo: true });
      demo.runId += 1;
      demo.elapsed = 0;
      demo.currentStep = "starting";
      demo.fired.clear();
      demo.queue = Promise.resolve();
      demo.workspaceReady = false;
      demo.spatialActive = false;
      demo.spatialRenderKey = "";
      demo.aiWorkspaceReady = false;
      demo.aiStartedAtElapsed = shiftedDemoTime(16.5);
      demo.aiSequenceEndElapsed = shiftedDemoTime(22.5);
      demo.aiNextStageAtElapsed = shiftedDemoTime(22.8);
      demo.aiCompletedImages.clear();
      demo.humanReviewActive = false;
      demo.humanReviewCompletedTaskIds.clear();
      demo.gisActive = false;
      demo.gisDemoBoundIds.clear();
      demo.indicatorActive = false;
      demo.indicatorDemoSimulated = false;
      demo.completing = false;
      demo.startedAt = performance.now();
      setDemoState("playing");
      updateDemoProgress();
      runDemoTimeline();
      demo.rafId = requestAnimationFrame(demoFrame);
    }

    function pauseDemo() {
      if (demo.state !== "playing") return;
      demo.elapsed = Math.min(DEMO_DURATION, (performance.now() - demo.startedAt) / 1000);
      stopDemoFrame();
      setDemoState("paused");
      aiRecognitionScanLine.classList.add("is-paused");
      updateDemoProgress();
    }

    function resumeDemo() {
      if (demo.state !== "paused") return;
      demo.startedAt = performance.now() - demo.elapsed * 1000;
      setDemoState("playing");
      aiRecognitionScanLine.classList.remove("is-paused");
      demo.rafId = requestAnimationFrame(demoFrame);
    }

    function manualAction() {
      if (demo.state === "playing") pauseDemo();
      if (demo.state === "completed" && demoReportGenerationState.active) {
        demoReportGenerationState.active = false;
        $("#reportSixStageSummary").hidden = true;
      }
    }

    function toggleDemo() {
      if (demo.state === "playing") pauseDemo();
      else if (demo.state === "paused") resumeDemo();
      else startDemo();
    }

    function bindDemoTimeline() {
      const timeline = $("#demoTimeline");
      const track = $("#demoTimelineTrack");
      timeline.setAttribute("aria-valuemax", String(DEMO_DURATION));
      updateDemoProgress();
      let pointerId = null;
      const secondsFromPointer = (event) => {
        const rect = track.getBoundingClientRect();
        return clamp((event.clientX - rect.left) / Math.max(1,rect.width),0,1) * DEMO_DURATION;
      };
      timeline.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (demo.state === "playing") pauseDemo();
        demo.seekToken += 1;
        demo.seeking = true;
        pointerId = event.pointerId;
        timeline.classList.add("is-seeking");
        if (typeof timeline.setPointerCapture === "function") timeline.setPointerCapture(pointerId);
        previewDemoSeek(secondsFromPointer(event));
      });
      timeline.addEventListener("pointermove", (event) => {
        if (!demo.seeking || event.pointerId !== pointerId) return;
        previewDemoSeek(secondsFromPointer(event));
      });
      const finish = (event) => {
        if (!demo.seeking || event.pointerId !== pointerId) return;
        previewDemoSeek(secondsFromPointer(event));
        if (typeof timeline.hasPointerCapture === "function" && timeline.hasPointerCapture(pointerId)) timeline.releasePointerCapture(pointerId);
        pointerId = null;
        seekDemoTo(demo.seekPreview);
      };
      timeline.addEventListener("pointerup", finish);
      timeline.addEventListener("pointercancel", (event) => {
        if (event.pointerId !== pointerId) return;
        pointerId = null;
        demo.seeking = false;
        timeline.classList.remove("is-seeking");
        updateDemoProgress();
      });
      timeline.addEventListener("keydown", (event) => {
        let target = demo.elapsed;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") target -= event.shiftKey ? 2 : .5;
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") target += event.shiftKey ? 2 : .5;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = DEMO_DURATION;
        else return;
        event.preventDefault();
        if (demo.state === "playing") pauseDemo();
        seekDemoTo(target);
      });
    }

    function bindHumanReviewEvents() {
      $("#humanReviewBackButton").addEventListener("click", () => {
        manualAction();
        humanReviewRequestNavigation(() => closeHumanReviewWorkspace().then(() => completeReturnToMap("已返回西安市城市项目总览")), "返回地图将放弃当前未保存修改。");
      });
      $("#humanReviewCloseButton").addEventListener("click", () => {
        manualAction();
        humanReviewRequestNavigation(() => closeHumanReviewWorkspace().then(() => completeReturnToMap("人工复核工作台已关闭")), "关闭工作台将放弃当前未保存修改。");
      });
      humanReviewMainImage.addEventListener("load", humanReviewFitMedia);
      $$('[data-human-review-mode]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        humanReviewSetMode(button.dataset.humanReviewMode);
      }));
      $$('[data-human-review-risk]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        humanReviewSetRiskFilter(button.dataset.humanReviewRisk);
      }));
      $("#humanReviewPreviousTask").addEventListener("click", () => { manualAction(); humanReviewStepTask(-1); });
      $("#humanReviewNextTask").addEventListener("click", () => { manualAction(); humanReviewStepTask(1); });
      $("#humanReviewCurrentBox").addEventListener("click", () => {
        manualAction();
        humanReviewSetSessionMessage("当前识别框已聚焦，bbox保持百分比定位");
        showToast("已聚焦当前候选问题识别框");
      });
      $("#humanReviewZoomButton").addEventListener("click", () => {
        manualAction();
        const placeholder = $("#humanReviewZoomPlaceholder");
        placeholder.hidden = !placeholder.hidden;
        humanReviewSetSessionMessage(placeholder.hidden ? "已关闭问题局部放大占位" : "已打开问题局部放大占位");
      });
      $$('[data-human-review-decision]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        humanReviewSelectDecision(button.dataset.humanReviewDecision);
      }));
      $("#humanReviewAddIssueButton").addEventListener("click", () => {
        manualAction();
        const form = $("#humanReviewSupplementForm");
        form.hidden = !form.hidden;
        $("#humanReviewAddIssueButton").classList.toggle("is-selected", !form.hidden);
        humanReviewSetSessionMessage(form.hidden ? "补录问题草稿区已关闭" : "补录问题草稿区已打开，不改变锁定结果口径");
      });
      $$('[data-human-review-toggle]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        const panel = $(`[data-human-review-panel="${button.dataset.humanReviewToggle}"]`);
        humanReviewSetPanel(button.dataset.humanReviewToggle, panel.hidden);
      }));
      $$('input[name="humanReviewRisk"]').forEach((input) => input.addEventListener("change", () => {
        humanReviewUpdateDraft({ severity: input.value }, "风险等级已写入草稿，尚未保存");
      }));
      $("#humanReviewTypeInput").addEventListener("input", (event) => humanReviewUpdateDraft({ type: event.target.value }, "问题类型修改已暂存，尚未保存"));
      $("#humanReviewIndicatorInput").addEventListener("input", (event) => humanReviewUpdateDraft({ indicator: event.target.value }, "指标关联建议已暂存，尚未保存"));
      $("#humanReviewOpinionInput").addEventListener("input", (event) => humanReviewUpdateDraft({ opinion: event.target.value }, "复核意见已暂存，尚未保存"));
      $("#humanReviewExclusionReason").addEventListener("input", (event) => humanReviewUpdateDraft({ exclusionReason: event.target.value }, "排除原因已暂存，尚未保存"));
      $("#humanReviewSaveButton").addEventListener("click", () => {
        manualAction();
        humanReviewSaveCurrent();
      });
      $("#humanReviewSupplementSave").addEventListener("click", () => { manualAction(); humanReviewSaveSupplementDraft(); });
      $("#humanReviewCompleteButton").addEventListener("click", () => { manualAction(); humanReviewComplete(); });
      $("#humanReviewResetButton").addEventListener("click", () => { manualAction(); humanReviewRequestNavigation(humanReviewReset, "重置将清除全部重点任务结果、日志和补录草稿。"); });
      $("#humanReviewCompletionReset").addEventListener("click", () => { manualAction(); humanReviewReset(); });
      $("#humanReviewKeepEditing").addEventListener("click", () => humanReviewResolveNavigation(false));
      $("#humanReviewDiscardChanges").addEventListener("click", () => humanReviewResolveNavigation(true));
    }

    function initializeHumanReview() {
      if (humanReviewInitialized) return true;
      const requiredIds = [
        "humanReviewWorkspace", "humanReviewMainImage", "humanReviewMediaViewport", "humanReviewMediaFrame",
        "humanReviewBackButton", "humanReviewCloseButton", "humanReviewTaskList", "humanReviewSaveButton",
        "humanReviewCompleteButton", "humanReviewResetButton", "humanReviewUnsavedPrompt", "humanReviewLogList"
      ];
      const missing = requiredIds.filter((id) => !document.getElementById(id));
      if (missing.length) {
        runtimeDiagnosticError(new Error("03工作台DOM缺失: " + missing.join(", ")), "03惰性初始化");
        return false;
      }
      try {
        bindHumanReviewEvents();
        humanReviewRenderAll();
        humanReviewInitialized = true;
        runtimeDiagnosticStep("03模块惰性初始化完成", "事件绑定与首次渲染完成");
        return true;
      } catch (error) {
        runtimeDiagnosticError(error, "03惰性初始化");
        return false;
      }
    }

    function bindEvents() {
      runtimeDiagnosticStep("全局事件绑定开始");
      bindDemoTimeline();
      document.addEventListener("pointerdown", (event) => {
        if (demo.state === "playing" && !event.target.closest("#autoDemoButton")) pauseDemo();
      }, true);
      window.addEventListener("resize", () => {
        resizeStage();
        if (appState.aiRecognitionWorkspaceOpen) fitAIRecognitionMedia();
        if (appState.humanReviewWorkspaceOpen) humanReviewFitMedia();
      });

      $("#brandHome").addEventListener("click", () => {
        manualAction();
        resetApplication({ preserveDemo: false });
      });
      projectEntry.addEventListener("click", (event) => {
        event.stopPropagation();
        manualAction();
        projectEntry.classList.add("is-pressed");
        requestAnimationFrame(() => requestAnimationFrame(() => projectEntry.classList.remove("is-pressed")));
        openLeftDrawer("list");
      });
      $("#leftDrawerClose").addEventListener("click", () => { manualAction(); closeLeftDrawer(); });
      $("#backToProjectList").addEventListener("click", () => { manualAction(); openLeftDrawer("list"); });
      $("#createAssessmentButton").addEventListener("click", () => {
        manualAction();
        selectProject(appState.activeProjectId || cityProjects[0].id, { openDetail: true, pan: true });
      });
      $("#enterCurrentAssessment").addEventListener("click", () => {
        manualAction();
        const selectedProject = projectById(appState.activeProjectId) || cityProjects[0];
        if (!appState.activeProjectId) selectProject(selectedProject.id, { openDetail: false, pan: false });
        openStageDrawer(0, { source: "project-entry" });
      });

      bindUnifiedStageNavigation();
      $("#moduleDrawerClose").addEventListener("click", () => { manualAction(); closeRightDrawer(); });
      $("#moduleEnterButton").addEventListener("click", () => {
        const index = appState.activeModuleIndex === null ? 0 : appState.activeModuleIndex;
        openStageWorkspace(index, { source: "drawer-cta" });
      });
      $("#backToMapButton").addEventListener("click", () => {
        manualAction();
        closeWorkspace().then(() => completeReturnToMap("已返回西安市城市项目总览"));
      });
      $("#aiRecognitionBackButton").addEventListener("click", () => {
        manualAction();
        closeAIRecognitionWorkspace().then(() => completeReturnToMap("已返回西安市城市项目总览"));
      });
      $("#aiRecognitionCloseButton").addEventListener("click", () => {
        manualAction();
        closeAIRecognitionWorkspace().then(() => completeReturnToMap("AI识别工作台已关闭"));
      });
      $("#aiRecognitionRunButton").addEventListener("click", () => {
        manualAction();
        toggleAIRecognitionRun();
      });
      $("#aiRecognitionResetButton").addEventListener("click", () => {
        manualAction();
        resetAIRecognitionUI();
      });
      $$('[data-ai-mode]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        setAIRecognitionMode(button.dataset.aiMode);
      }));
      $$('[data-ai-risk]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        setAIRecognitionRiskFilter(button.dataset.aiRisk);
      }));
      $$('[data-ai-image-filter]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        setAIRecognitionImageFilter(button.dataset.aiImageFilter);
      }));
      $("#aiRecognitionPreviousIssue").addEventListener("click", () => {
        manualAction();
        stepAIRecognitionIssue(-1);
      });
      $("#aiRecognitionNextIssue").addEventListener("click", () => {
        manualAction();
        stepAIRecognitionIssue(1);
      });
      $("#aiRecognitionHandoffButton").addEventListener("click", () => {
        openNextStageDrawer(1);
      });
      aiRecognitionMediaViewport.addEventListener("click", (event) => {
        if (event.target.closest(".ai-recognition-box")) return;
        manualAction();
        aiRecognitionState.selectedIssueId = null;
        renderAIRecognitionBoxes();
        renderAIRecognitionIssueDetail();
        syncAIRecognitionDebug();
      });
      aiRecognitionMainImage.addEventListener("load", fitAIRecognitionMedia);
      $("#simulateUploadButton").addEventListener("click", () => { manualAction(); startManualUpload(); });
      $$('[data-upload-view]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        if (button.dataset.uploadView === "spatial") spatialCollectionState.workflowSource = "manual";
        setSpatialCollectionView(button.dataset.uploadView);
      }));
      $$('[data-spatial-layer]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        const layer = button.dataset.spatialLayer;
        spatialCollectionState.layers[layer] = !spatialCollectionState.layers[layer];
        renderSpatialCollectionView();
      }));
      $$('[data-spatial-tab]').forEach((button) => button.addEventListener("click", () => {
        manualAction();
        spatialCollectionState.activeTab = button.dataset.spatialTab;
        renderSpatialCollectionView();
      }));
      $("#spatialCollectionSvg").addEventListener("click", (event) => {
        const photo = event.target.closest("[data-spatial-photo]");
        const stop = event.target.closest("[data-spatial-stop]");
        const terminal = event.target.closest("[data-spatial-route-point]");
        if (photo) selectPhotoLocation(photo.dataset.spatialPhoto);
        else if (stop) selectSurveyStop(stop.dataset.spatialStop);
        else if (terminal) { spatialCollectionState.activeTab = "route"; spatialCollectionState.selectedRoutePoint = terminal.dataset.spatialRoutePoint; renderSpatialCollectionView(); }
      });
      $("#spatialCollectionInfo").addEventListener("click", (event) => {
        const photo = event.target.closest("[data-spatial-photo]");
        const stop = event.target.closest("[data-spatial-stop]");
        if (photo) selectPhotoLocation(photo.dataset.spatialPhoto);
        else if (stop) selectSurveyStop(stop.dataset.spatialStop);
      });
      $("#spatialLocateRoute").addEventListener("click", () => { manualAction(); spatialCollectionState.focused = true; spatialCollectionState.activeTab = "route"; renderSpatialCollectionView(); });
      $("#spatialResetMap").addEventListener("click", () => { manualAction(); spatialCollectionState.focused = false; spatialCollectionState.selectedPhotoId = photoLocationData[0].photoId; spatialCollectionState.selectedStopId = null; renderSpatialCollectionView(); });
      $("#spatialAutoLocateButton").addEventListener("click", () => {
        manualAction();
        spatialCollectionState.workflowSource = "manual";
        if (!startSpatialAutoLocate({ state: manualSpatialCollectionState })) showToast("当前定位流程不可重复启动", "warning", 1800);
      });
      $("#spatialConfirmBindButton").addEventListener("click", () => {
        manualAction();
        spatialCollectionState.workflowSource = "manual";
        if (!startSpatialManualBinding({ state: manualSpatialCollectionState })) showToast("请先完成12张缺失照片的候选定位", "warning", 1800);
      });
      $("#nextStageButton").addEventListener("click", () => openNextStageDrawer(0));
      $("#humanReviewNextStageButton").addEventListener("click", () => openNextStageDrawer(2));
      $("#gisNextStageButton").addEventListener("click", () => openNextStageDrawer(3));
      $("#indicatorNextStageButton").addEventListener("click", () => openNextStageDrawer(4));

      $("#zoomInButton").addEventListener("click", () => { manualAction(); setMapScale(nextZoomIn()); });
      $("#zoomOutButton").addEventListener("click", () => { manualAction(); setMapScale(nextZoomOut()); });
      $("#restoreMapButton").addEventListener("click", () => {
        manualAction();
        resetCityMapFocus({ closeDetail: true, interactionSource: "map-reset-button" }).then(() => showToast("已恢复西安市完整地图"));
      });

      mapViewport.addEventListener("wheel", (event) => {
        event.preventDefault();
        manualAction();
        const next = event.deltaY < 0 ? appState.map.scale + 0.12 : appState.map.scale - 0.12;
        setMapScale(next);
      }, { passive: false });

      mapViewport.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest(".city-project-point")) return;
        manualAction();
        appState.map.dragging = true;
        appState.map.pointerId = event.pointerId;
        appState.map.startX = event.clientX;
        appState.map.startY = event.clientY;
        appState.map.originX = appState.map.x;
        appState.map.originY = appState.map.y;
        appState.map.movedDistance = 0;
        mapViewport.classList.add("is-dragging");
        if (typeof mapViewport.setPointerCapture === "function") mapViewport.setPointerCapture(event.pointerId);
      });

      mapViewport.addEventListener("pointermove", (event) => {
        if (!appState.map.dragging || event.pointerId !== appState.map.pointerId) return;
        const stageScale = parseFloat(getComputedStyle(appStage).getPropertyValue("--stage-scale")) || 1;
        const dx = (event.clientX - appState.map.startX) / stageScale;
        const dy = (event.clientY - appState.map.startY) / stageScale;
        appState.map.movedDistance = Math.max(appState.map.movedDistance, Math.hypot(event.clientX - appState.map.startX, event.clientY - appState.map.startY));
        const reserveDetail = cityMapState.mode === "focused" && motion.left.state !== "closed";
        const constrained = constrainCityMapPosition(appState.map.originX + dx, appState.map.originY + dy, appState.map.scale, { reserveDetail });
        appState.map.x = constrained.x;
        appState.map.y = constrained.y;
        appState.map.interactionSource = "drag";
        applyMapTransform();
      });

      function finishDrag(event) {
        if (!appState.map.dragging || event.pointerId !== appState.map.pointerId) return;
        const isBlankClick = event.type === "pointerup" && appState.map.movedDistance <= 6;
        appState.map.dragging = false;
        mapViewport.classList.remove("is-dragging");
        if (typeof mapViewport.hasPointerCapture === "function" && mapViewport.hasPointerCapture(event.pointerId)) mapViewport.releasePointerCapture(event.pointerId);
        appState.map.pointerId = null;
        if (isBlankClick && cityMapState.mode === "focused") {
          resetCityMapFocus({ closeDetail: true, interactionSource: "map-blank" });
        } else if (isBlankClick) {
          closeDrawersFromMap();
        }
      }
      mapViewport.addEventListener("pointerup", finishDrag);
      mapViewport.addEventListener("pointercancel", finishDrag);

      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        manualAction();
        if (appState.reportWorkspaceOpen) closeReportWorkspace().then(() => completeReturnToMap());
        else if (appState.indicatorWorkspaceOpen) {
          resetIndicatorScenario({ render: false });
          closeIndicatorWorkspace().then(() => completeReturnToMap());
        }
        else if (appState.gisWorkspaceOpen) closeGISWorkspace().then(() => completeReturnToMap());
        else if (appState.humanReviewWorkspaceOpen) humanReviewRequestNavigation(() => closeHumanReviewWorkspace().then(() => completeReturnToMap()), "Esc关闭工作台将放弃当前未保存修改。");
        else if (appState.aiRecognitionWorkspaceOpen) closeAIRecognitionWorkspace().then(() => completeReturnToMap());
        else if (appState.workspaceOpen) closeWorkspace().then(() => completeReturnToMap());
        else if (appState.rightDrawerOpen) closeRightDrawer();
        else if (cityMapState.mode === "focused") resetCityMapFocus({ closeDetail: true, interactionSource: "escape" });
        else if (appState.leftDrawerView !== null) closeLeftDrawer();
      });

      autoDemoButton.addEventListener("click", () => {
        if (demo.state === "idle" || demo.state === "completed") resetIndicatorScenario({ render: false });
        toggleDemo();
      });
      runtimeDiagnosticStep("自动演示按钮绑定完成");
      $("#resetButton").addEventListener("click", () => {
        demo.seekToken += 1;
        demo.seeking = false;
        $("#demoTimeline").classList.remove("is-seeking");
        resetApplication({ preserveDemo: false });
      });
      $("#fullscreenButton").addEventListener("click", async () => {
        try {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
          else await document.exitFullscreen();
        } catch (error) {
          showToast("当前浏览器未允许全屏，可继续使用自动演示", "warning", 2800);
        }
      });
      document.addEventListener("fullscreenchange", () => {
        $("#fullscreenButton").setAttribute("aria-label", document.fullscreenElement ? "退出全屏" : "全屏");
      });
      runtimeDiagnosticStep("全局事件绑定完成", "地图、模块轨、01、02、自动演示与重置入口已绑定");
    }

    renderProjectCollections();
    validateAIRecognitionData();
    validateGISIssueData();
    validateIndicatorData();
    validateReportTemplateData();
    validateSpatialCollectionData();
    bindEvents();
    resizeStage();
    restoreMap();
    resetUploadUI();
    resetSpatialCollectionView();
    resetAIRecognitionUI({ silent: true });
    setWorkflowStage(null, -1, false);
    updateProjectSelection();
    if (new URLSearchParams(window.location.search).get("debug") === "points") appStage.classList.add("is-debug-points");
    syncDebug();
    window.__aiRecognitionBetaControls = {
      open: openAIRecognitionWorkspace,
      close: closeAIRecognitionWorkspace,
      reset: () => resetAIRecognitionUI({ silent: true }),
      setProgress: (progress) => renderAIRecognitionProgress(progress, { status: progress >= 1 ? "completed" : "playing", force: true }),
      selectImage: selectAIRecognitionImage,
      selectIssue: selectAIRecognitionIssue,
      setRisk: setAIRecognitionRiskFilter
    };
    window.__humanReviewBetaControls = {
      open: openHumanReviewWorkspace,
      close: closeHumanReviewWorkspace,
      selectTask: (taskId) => initializeHumanReview() && humanReviewSelectTask(taskId),
      setRisk: (risk) => initializeHumanReview() && humanReviewSetRiskFilter(risk),
      setMode: (mode) => initializeHumanReview() && humanReviewSetMode(mode),
      save: () => initializeHumanReview() && humanReviewSaveCurrent(),
      complete: () => initializeHumanReview() && humanReviewComplete(),
      reset: () => initializeHumanReview() && humanReviewReset(),
      getState: () => ({
        workspaceOpen: appState.humanReviewWorkspaceOpen,
        selectedTaskId: humanReviewState.selectedTaskId,
        riskFilter: humanReviewState.riskFilter,
        mode: humanReviewState.mode,
        dirty: humanReviewState.dirty,
        completed: humanReviewState.completed,
        stats: humanReviewCalculateStats(humanReviewState),
        aligned: humanReviewPresetAligned(humanReviewState),
        logCount: humanReviewState.logs.length,
        supplementDraft: humanReviewState.supplementDraft,
        tasks: humanReviewState.tasks.map((task) => ({ taskId: task.taskId, status: task.status, result: task.result, revision: task.revision })),
        candidateIssues: 43,
        priorityReview: 7,
        formalResultCount: humanReviewState.completed ? humanReviewCalculateStats(humanReviewState).effective : null
      })
    };
    window.__gisBetaControls = {
      open: openGISWorkspace,
      close: closeGISWorkspace,
      initialize: initializeGISWorkspace,
      select: (mapId) => initializeGISWorkspace() && gisSelectIssue(mapId, { center: true, scroll: true }),
      setRisk: (risk) => { if (initializeGISWorkspace()) { gisState.riskFilter = risk; gisRenderAll(); } },
      setType: (type) => { if (initializeGISWorkspace()) { gisState.typeFilter = type; $("#gisTypeFilter").value = type; gisRenderAll(); } },
      search: (keyword) => { if (initializeGISWorkspace()) { gisState.search = String(keyword || ""); $("#gisSearchInput").value = gisState.search; gisRenderAll(); } },
      setRadius: (radius) => { if (initializeGISWorkspace() && ["500", "800", "1000"].includes(String(radius))) { gisState.radius = String(radius); gisRenderAll(); } },
      setTab: (tab) => initializeGISWorkspace() && gisSetActiveTab(tab),
      confirmBinding: () => initializeGISWorkspace() && gisConfirmBinding(),
      resetMap: () => initializeGISWorkspace() && gisResetMap(),
      getState: () => ({
        workspaceOpen: appState.gisWorkspaceOpen,
        initialized: gisInitialized,
        selectedMapId: gisState.selectedMapId,
        riskFilter: gisState.riskFilter,
        typeFilter: gisState.typeFilter,
        search: gisState.search,
        layers: { ...gisState.layers },
        radius: gisState.radius,
        activeTab: gisState.activeTab,
        bound: 42 - gisState.pendingBindings.size,
        pending: gisState.pendingBindings.size,
        visibleCount: gisVisibleIssues().length,
        total: gisIssueData.length,
        risks: validateGISIssueData().risks
      })
    };
    window.__indicatorAlphaControls = {
      open: openIndicatorWorkspace,
      close: closeIndicatorWorkspace,
      initialize: initializeIndicatorWorkspace,
      select: (indicatorId) => initializeIndicatorWorkspace() && indicatorSelect(indicatorId, { showDetail: true }),
      setTab: (tab) => initializeIndicatorWorkspace() && indicatorSetTab(tab),
      setStatus: (status) => {
        if (!initializeIndicatorWorkspace() || !["all", "unmet", "basic", "good"].includes(status)) return false;
        indicatorState.statusFilter = status;
        indicatorRenderAll();
        return true;
      },
      locateIssue: (mapId) => initializeIndicatorWorkspace() && indicatorLocateInGIS(mapId),
      getState: () => ({
        workspaceOpen: appState.indicatorWorkspaceOpen,
        initialized: indicatorInitialized,
        selectedIndicatorId: indicatorState.selectedIndicatorId,
        statusFilter: indicatorState.statusFilter,
        categoryFocus: indicatorState.categoryFocus,
        activeTab: indicatorState.activeTab,
        categories: indicatorData.categories.length,
        indicators: indicatorData.indicators.length,
        mappedIssues: new Set(indicatorData.indicators.flatMap((item) => item.issueIds)).size,
        overallScore: indicatorData.overallDisplayScore,
        unmetCount: indicatorData.unmetCount
      })
    };
    window.__indicatorBetaControls = {
      open: openIndicatorWorkspace,
      close: closeIndicatorWorkspace,
      initialize: initializeIndicatorWorkspace,
      enterScenario: enterIndicatorScenarioMode,
      exitScenario: (force = false) => exitIndicatorScenarioMode(force),
      resetScenario: () => resetIndicatorScenario({ keepEnabled: true }),
      select: (indicatorId) => initializeIndicatorWorkspace() && indicatorSelect(indicatorId, { showDetail: true }),
      setCategoryWeight: (categoryId, value) => updateCategoryWeight(categoryId, value),
      setIndicatorWeight: (indicatorId, value) => updateIndicatorWeight(indicatorId, value),
      setThreshold: (indicatorId, value) => updateIndicatorThreshold(indicatorId, value),
      resolveIssue: (mapId, resolved = true) => toggleScenarioIssue(mapId, resolved),
      calculate: () => calculateIndicatorResults(),
      getState: () => {
        const results = calculateIndicatorResults();
        return {
          enabled: indicatorScenarioState.enabled,
          modified: indicatorScenarioState.modified,
          resolvedIssueIds: [...indicatorScenarioState.resolvedIssueIds],
          categoryWeights: { ...indicatorScenarioState.categoryWeights },
          indicatorWeights: { ...indicatorScenarioState.indicatorWeights },
          thresholds: { ...indicatorScenarioState.thresholds },
          overallScore: results.overallDisplayScore,
          buildingSafety: results.categories.find((item) => item.id === "CAT-BS").rawScore,
          communityEnvironment: results.categories.find((item) => item.id === "CAT-CE").rawScore,
          unmetIds: results.unmet.map((item) => item.id)
        };
      }
    };
    window.__indicatorRC1DemoControls = {
      seek: (seconds) => seekDemoTo(seconds),
      play: () => { if (demo.state === "paused") resumeDemo(); else if (demo.state !== "playing") startDemo(); },
      pause: pauseDemo,
      reset: () => resetApplication({ preserveDemo:false }),
      getState: () => {
        const results = calculateIndicatorResults();
        return {
          state: demo.state,
          elapsed: Number(demo.elapsed.toFixed(2)),
          step: demo.currentStep,
          indicatorActive: demo.indicatorActive,
          indicatorScenarioEnabled: indicatorScenarioState.enabled,
          map001Simulated: indicatorScenarioState.resolvedIssueIds.has("MAP-001"),
          indicatorCompletionVisible: !$("#indicatorDemoCompletion").hidden,
          overallScore: results.overallDisplayScore,
          buildingSafety: results.categories.find((item) => item.id === "CAT-BS").displayScore,
          communityEnvironment: results.categories.find((item) => item.id === "CAT-CE").displayScore,
          unmetCount: results.unmet.length,
          workflowCurrentStage: appState.workflowCurrentStage,
          workflowCompletedThrough: appState.workflowCompletedThrough,
          workflowNextOnly: appState.workflowNextOnly,
          activeDrawerStage: appState.activeDrawerStage,
          activeWorkspaceStage: appState.activeWorkspaceStage
        };
      }
    };
    window.__reportAlphaControls = {
      open: openReportWorkspace,
      close: closeReportWorkspace,
      initialize: initializeReportWorkspace,
      setType: reportSetType,
      setPage: reportSetPage,
      setZoom: reportSetZoom,
      navigateTrace: reportNavigateTrace,
      getState: () => ({
        workspaceOpen: appState.reportWorkspaceOpen,
        initialized: reportWorkspaceInitialized,
        reportType: reportWorkbenchState.reportType,
        specialTopic: reportWorkbenchState.specialTopic,
        pageIndex: reportWorkbenchState.pageIndex,
        activeTab: reportWorkbenchState.activeTab,
        zoom: reportWorkbenchState.zoom,
        mode: reportWorkbenchState.mode,
        reportCount: Object.keys(reportTemplateData).length,
        pageCounts: Object.fromEntries(Object.entries(reportTemplateData).map(([key, value]) => [key, value.pages.length])),
        workflowCurrentStage: appState.workflowCurrentStage,
        workflowCompletedThrough: appState.workflowCompletedThrough
      })
    };
    window.__reportBetaControls = {
      enterDraft: enterReportDraftMode,
      viewBaseline: exitReportDraftMode,
      updateMetadata: updateReportMetadata,
      updatePageContent: updateReportPageContent,
      togglePage: toggleReportPage,
      movePage: moveReportPage,
      toggleBlock: toggleReportPageBlock,
      setLayout: setReportPageLayout,
      resetPage: resetCurrentReportPage,
      resetReport: resetCurrentReportDraft,
      clearAll: clearAllReportDrafts,
      validate: reportValidateDraft,
      checkOverflow: reportCheckOverflow,
      render: renderDraftReport,
      difference: renderReportDifference,
      getState: () => ({
        mode: reportWorkbenchState.mode,
        reportType: reportWorkbenchState.reportType,
        specialTopic: reportWorkbenchState.specialTopic,
        currentPage: reportCurrentPage() && reportCurrentPage().pageId,
        visiblePages: reportVisiblePages().map((page) => page.pageId),
        draftKeys: Object.keys(reportDraftState.drafts),
        changes: reportChangeSummary(reportCurrentDraft(false)).count,
        validation: reportWorkbenchState.mode === "draft" ? reportValidateDraft() : null,
        printPreview: reportWorkbenchState.printPreview
      })
    };
    window.__reportRC1Controls = {
      generate: requestGenerateReportPackage,
      resetGeneration: () => resetReportGenerationState(),
      createSnapshot: (options) => createGeneratedReportSnapshot(options),
      buildHtml: (snapshot) => buildSelfContainedReportHtml(snapshot || reportOutputSnapshot()),
      viewGenerated: viewGeneratedReportSnapshot,
      downloadHtml: downloadGeneratedHtmlReport,
      downloadWord: downloadGeneratedWordReport,
      downloadManifest: downloadGeneratedReportManifest,
      printPdf: printGeneratedReport,
      getState: () => ({
        manual: reportClone({ ...reportGenerationState, timerIds: [] }),
        demo: reportClone(demoReportGenerationState),
        workflowCurrentStage: appState.workflowCurrentStage,
        workflowCompletedThrough: appState.workflowCompletedThrough
      })
    };
    window.reportTemplateData = reportTemplateData;
    window.__cityMapRC2Controls = {
      focus: (projectId) => focusCityProject(projectId, { openDetail: true, reserveDetail: true, interactionSource: "debug-control" }),
      switchProject: (projectId) => switchFocusedProject(projectId, { openDetail: true, reserveDetail: true, interactionSource: "debug-control" }),
      reset: () => resetCityMapFocus({ closeDetail: true, interactionSource: "debug-control" }),
      calculate: (projectId) => {
        const project = projectById(projectId);
        return project ? calculateCityProjectFocus(project, { reserveDetail: true }) : null;
      },
      getState: () => ({
        mode: cityMapState.mode,
        focusedProjectId: cityMapState.focusedProjectId,
        activeProjectId: appState.activeProjectId,
        scale: cityMapState.scale,
        x: cityMapState.x,
        y: cityMapState.y,
        dragging: cityMapState.dragging,
        interactionSource: cityMapState.interactionSource,
        workflowCurrentStage: appState.workflowCurrentStage,
        activeViewStage: appState.activeViewStage,
        activeDrawerStage: appState.activeDrawerStage,
        activeWorkspaceStage: appState.activeWorkspaceStage
      })
    };
    window.__spatialCollectionAlphaControls = {
      open: () => { setSpatialCollectionView("spatial"); return true; },
      governance: () => setSpatialCollectionView("governance"),
      selectPhoto: selectPhotoLocation,
      selectStop: selectSurveyStop,
      setTab: (tab) => { spatialCollectionState.activeTab = tab; renderSpatialCollectionView(); },
      toggleLayer: (layer) => { if (layer in spatialCollectionState.layers) { spatialCollectionState.layers[layer] = !spatialCollectionState.layers[layer]; renderSpatialCollectionView(); } },
      reset: () => resetSpatialCollectionView(),
      validate: validateSpatialCollectionData,
      getState: () => ({ ...spatialCollectionState, layers: { ...spatialCollectionState.layers }, total: photoLocationData.length, exif: photoLocationData.filter((photo) => photo.locationSource === "exif").length, manualBound: photoLocationData.filter((photo) => photo.locationSource === "manual-bind").length, routeStops: surveyRouteData.keyStops.length })
    };
    window.__spatialCollectionBetaControls = {
      autoLocate: () => startSpatialAutoLocate({ state: manualSpatialCollectionState }),
      confirmBinding: () => startSpatialManualBinding({ state: manualSpatialCollectionState }),
      applyLocateGroup: (groupIndex) => { applySpatialLocateGroup(manualSpatialCollectionState, groupIndex); renderSpatialCollectionView(); },
      applyBindingProgress: (progress) => { applySpatialBindingProgress(manualSpatialCollectionState, progress); renderSpatialCollectionView(); },
      applyRouteLinkingProgress: (progress) => { applySpatialRouteLinkingProgress(manualSpatialCollectionState, progress); renderSpatialCollectionView(); },
      applyDemoAt: (seconds) => applySpatialDemoStateAt(Number(seconds)),
      resetManual: () => { resetSpatialWorkflowState(manualSpatialCollectionState); spatialCollectionState.workflowSource = "manual"; renderSpatialCollectionView(); },
      getState: () => ({
        source: spatialCollectionState.workflowSource,
        manual: { ...manualSpatialCollectionState, timerIds: manualSpatialCollectionState.timerIds.length },
        demo: { ...demoSpatialCollectionState, timerIds: demoSpatialCollectionState.timerIds.length },
        duration: DEMO_DURATION,
        spatialStart: SPATIAL_DEMO_START,
        spatialDuration: SPATIAL_DEMO_DURATION
      })
    };
    window.__stageDrawerSummaryControls = {
      render: (stageId) => renderStageDrawerSummary(Number(stageId)),
      model: (stageId) => stageSummaryModel(Number(stageId)),
      status: (stageId) => getStageBusinessStatus(Number(stageId)),
      availability: (stageId) => getStageDataAvailability(Number(stageId))
    };
    window.__urbanHotfixReady = true;
    runtimeDiagnosticStep("应用初始化完成", "页面全局入口已可操作；03、04、05与06等待首次进入时惰性初始化");
  }
})();
