(function (global) {
  'use strict';

  var primaryNav = [
    { key: 'projects', label: '项目管理', hash: '#projects' },
    { key: 'outcomes', label: '成果中心', hash: '#outcomes' },
    { key: 'settings', label: '系统设置', hash: '#settings' }
  ];

  var projectTabs = [
    { key: 'overview', label: '项目概览' },
    { key: 'ledger', label: '住宅台账' },
    { key: 'analysis', label: '住区分析' },
    { key: 'review', label: '人工复核' },
    { key: 'community', label: '社区／街区' },
    { key: 'issues', label: '问题台账' },
    { key: 'indicators', label: '指标库' },
    { key: 'reports', label: '报告成果' }
  ];

  function cleanHash(hash) {
    return String(hash || '').replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  }

  function parse(hash) {
    var raw = cleanHash(hash);
    if (!raw) raw = 'home';
    if (raw === 'workbench') raw = 'projects';
    var parts = raw.split('/');
    if (parts[0] === 'project' && parts[1]) {
      var view = parts[2] || 'overview';
      var legacyViews = { data: 'indicators', indicator: 'indicators', report: 'reports', photos: 'analysis' };
      if (legacyViews[view]) view = legacyViews[view];
      if (!projectTabs.some(function (item) { return item.key === view; })) view = 'overview';
      return {
        raw: raw,
        page: view === 'photos' || view === 'analysis' ? 'ai-analysis'
          : view === 'community' ? 'community'
            : view === 'reports' ? 'diagnostic'
              : 'detail',
        primary: 'projects',
        projectId: parts[1],
        projectView: view,
        isProject: true
      };
    }

    var primaryByPage = {
      home: 'home',
      projects: 'projects',
      'new-project': 'projects',
      'ai-analysis': 'projects',
      community: 'projects',
      outcomes: 'outcomes',
      analysis: 'outcomes',
      diagnostic: 'outcomes',
      settings: 'settings',
      'ai-config': 'settings'
    };
    if (!primaryByPage[raw]) raw = 'home';
    return {
      raw: raw,
      page: raw,
      primary: primaryByPage[raw] || 'home',
      projectId: null,
      projectView: null,
      isProject: false
    };
  }

  function projectHash(projectId, view) {
    return '#project/' + encodeURIComponent(String(projectId)) + '/' + (view || 'overview');
  }

  function legacyProjectHash(page, projectId) {
    var map = {
      'ai-analysis': 'analysis',
      community: 'community',
      diagnostic: 'reports',
      analysis: 'overview'
    };
    return map[page] && projectId ? projectHash(projectId, map[page]) : '#' + page;
  }

  global.SmartRenewStructure = {
    primaryNav: primaryNav,
    projectTabs: projectTabs,
    parse: parse,
    projectHash: projectHash,
    legacyProjectHash: legacyProjectHash
  };
})(window);
