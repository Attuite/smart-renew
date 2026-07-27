export const HOUSING_PROBLEM_GROUPS = [
  {
    code: '01',
    name: '结构安全隐患',
    indicatorCode: 'IND-HOUSE-001',
    items: [
      ['PRB-01-01', '混凝土结构构件裂缝'],
      ['PRB-01-02', '违规拆除结构承重构件'],
      ['PRB-01-03', '砖体缺棱掉角砂浆饱满度差'],
      ['PRB-01-04', '违规加建改变结构']
    ]
  },
  {
    code: '02',
    name: '燃气安全隐患',
    indicatorCode: 'IND-HOUSE-002',
    items: [
      ['PRB-02-01', '燃气管道锈蚀破损'],
      ['PRB-02-02', '燃气橡胶软管老化'],
      ['PRB-02-03', '燃气管道私改私接'],
      ['PRB-02-04', '燃气器具无熄火保护装置'],
      ['PRB-02-05', '未安装燃气自闭阀'],
      ['PRB-02-06', '未安装燃气报警器']
    ]
  },
  {
    code: '03',
    name: '楼道安全隐患',
    indicatorCode: 'IND-HOUSE-003',
    items: [
      ['PRB-03-01', '楼梯踏步缺损'],
      ['PRB-03-02', '楼梯扶手松动损坏'],
      ['PRB-03-03', '楼道照明损坏缺失'],
      ['PRB-03-04', '楼道安全护栏松动损坏或缺失'],
      ['PRB-03-05', '通风井道排风烟道堵塞'],
      ['PRB-03-06', '消防门缺失损坏'],
      ['PRB-03-07', '消火栓缺失或无水'],
      ['PRB-03-08', '灭火器缺失'],
      ['PRB-03-09', '疏散指示灯损坏缺失'],
      ['PRB-03-10', '楼道堆放杂物占用'],
      ['PRB-03-11', '楼道违规停放电动车及充电']
    ]
  },
  {
    code: '04',
    name: '围护安全隐患',
    indicatorCode: 'IND-HOUSE-004',
    items: [
      ['PRB-04-01', '外墙装饰面层开裂脱落'],
      ['PRB-04-02', '外墙保温层开裂脱落'],
      ['PRB-04-03', '外墙悬挂设施松脱'],
      ['PRB-04-04', '门窗玻璃破损脱落'],
      ['PRB-04-05', '屋面排水不畅漏水'],
      ['PRB-04-06', '外墙内侧地下室渗水']
    ]
  },
  {
    code: '05',
    name: '非成套住宅',
    indicatorCode: 'IND-HOUSE-005',
    items: [
      ['PRB-05-01', '缺独立厨房卫生间']
    ]
  },
  {
    code: '06',
    name: '管线管道破损',
    indicatorCode: 'IND-HOUSE-006',
    items: [
      ['PRB-06-01', '给水管线跑冒滴漏'],
      ['PRB-06-02', '给水管线老化破损'],
      ['PRB-06-03', '排水管线老化破损'],
      ['PRB-06-04', '给排水管线渗漏堵塞'],
      ['PRB-06-05', '采暖季温度不达标'],
      ['PRB-06-06', '电力电信管线老化破损及裸露'],
      ['PRB-06-07', '私搭乱接电线']
    ]
  }
];

const PROBLEM_BY_CODE = new Map(
  HOUSING_PROBLEM_GROUPS.flatMap((group) => group.items.map(([code, name]) => [
    code,
    {
      code,
      name,
      groupCode: group.code,
      groupName: group.name,
      indicatorCode: group.indicatorCode
    }
  ]))
);

export function findHousingProblem(code) {
  return PROBLEM_BY_CODE.get(String(code || '').trim()) || null;
}

export function housingProblemCatalogResponse() {
  return HOUSING_PROBLEM_GROUPS.map((group) => ({
    code: group.code,
    name: group.name,
    indicatorCode: group.indicatorCode,
    items: group.items.map(([code, name]) => ({ code, name }))
  }));
}
