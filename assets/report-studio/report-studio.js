/**
 * report-studio.js
 * 报告工作台唯一公开入口。
 *
 * 公开 API：
 *   window.SmartRenewReportStudio.open({ projectId, projectName })
 *
 * 内部模块挂载在：
 *   window.SmartRenewReportStudioModules
 *
 * 本文件不包含业务逻辑，仅负责挂载入口和协调模块。
 */
(function () {
  'use strict';

  var NS = window.SmartRenewReportStudioModules =
    window.SmartRenewReportStudioModules || {};

  var CONTAINER_ID = 'report-studio-container';
  var currentContext = null;
  var reportContext = null;
  var calcSnapshot = null;
  var currentDraft = null;
  var currentSections = [];
  var currentValidation = null;
  var currentStep = 0;

  function ensureContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.className = 'report-studio-root';
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  function renderNav() {
    var steps = [
      { num: 1, label: '数据准备' },
      { num: 2, label: '指标计算' },
      { num: 3, label: '分章生成' },
      { num: 4, label: '编辑审核' },
      { num: 5, label: 'Word 导出' }
    ];
    var html = '<nav class="rs-nav"><div class="rs-nav-inner">';
    html += '<div class="rs-nav-brand">报告工作台</div>';
    html += '<div class="rs-nav-steps">';
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      var cls = s.num === currentStep ? 'rs-nav-step rs-nav-step-active' :
                s.num < currentStep ? 'rs-nav-step rs-nav-step-done' : 'rs-nav-step rs-nav-step-pending';
      html += '<span class="' + cls + '">' + s.num + '. ' + esc(s.label) + '</span>';
    }
    html += '</div>';
    html += '<button class="rs-btn rs-btn-sm rs-btn-outline" id="rs-btn-close">关闭</button>';
    html += '</div></nav>';
    return html;
  }

  function renderStep(contentHtml) {
    var container = ensureContainer();
    container.innerHTML = renderNav() + '<div id="rs-step-content" class="rs-step-wrap">' + contentHtml + '</div>';
    var closeBtn = document.getElementById('rs-btn-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    return document.getElementById('rs-step-content');
  }

  function esc(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text == null ? '' : text)));
    return div.innerHTML;
  }

  // === 步骤导航 ===

  function goToStep1() {
    currentStep = 1;
    var el = renderStep('');
    NS.dataReadiness.render(el, reportContext, goToStep2);
  }

  function goToStep2() {
    currentStep = 2;
    var el = renderStep('');
    NS.calculationView.render(el, reportContext, calcSnapshot, function (snapshot) {
      calcSnapshot = snapshot;
      goToStep3();
    }, function () { goToStep1(); });
  }

  function goToStep3() {
    currentStep = 3;
    ensureOrCreateDraft().then(function () {
      var el = renderStep('');
      NS.reportPreview.renderStep3(el, currentDraft, currentSections, goToStep4, function () { goToStep2(); });
    }).catch(function (err) {
      renderStep('<div class="rs-step-content"><div class="rs-card rs-card-warn"><p>创建草稿失败：' + esc(err.message) + '</p></div></div>');
    });
  }

  function goToStep4() {
    currentStep = 4;
    var el = renderStep('');
    NS.sectionEditor.render(el, currentDraft, currentSections, goToStep5, function () { goToStep3(); });
  }

  function goToStep5() {
    currentStep = 5;
    // 运行校验
    if (currentDraft) {
      NS.apiClient.validateDraft(currentDraft.id).then(function (res) {
        currentValidation = res.validation;
        var el = renderStep('');
        NS.reportPreview.renderStep5(el, currentDraft, currentSections, currentValidation, function () { goToStep4(); });
      }).catch(function () {
        currentValidation = { valid: false, issues: [{ type: 'error', severity: 'error', message: '校验请求失败' }] };
        var el = renderStep('');
        NS.reportPreview.renderStep5(el, currentDraft, currentSections, currentValidation, function () { goToStep4(); });
      });
    } else {
      var el = renderStep('');
      NS.reportPreview.renderStep5(el, null, [], null, function () { goToStep4(); });
    }
  }

  // === 草稿管理 ===

  function ensureOrCreateDraft() {
    if (currentDraft) return Promise.resolve(currentDraft);
    return NS.apiClient.listDrafts(currentContext.projectId).then(function (res) {
      if (res.items && res.items.length) {
        currentDraft = res.items[0];
        return NS.apiClient.getDraft(currentDraft.id);
      }
      return NS.apiClient.createDraft(currentContext.projectId, {
        title: (currentContext.projectName || '城市体检') + '报告',
        templateId: 'TPL-WORD-V1',
        contextSnapshotId: reportContext ? reportContext.contextHash : '',
        calculationSnapshotId: calcSnapshot ? calcSnapshot.contextHash : '',
        createdBy: '用户'
      });
    }).then(function (res) {
      currentDraft = res.draft || res.item || res;
      // 加载段落
      return currentDraft;
    });
  }

  // === 公开入口 ===

  function open(options) {
    if (!options || !options.projectId) {
      console.error('[ReportStudio] open() requires projectId');
      return;
    }
    currentContext = { projectId: String(options.projectId), projectName: options.projectName || '' };
    reportContext = null;
    calcSnapshot = null;
    currentDraft = null;
    currentSections = [];
    currentValidation = null;
    currentStep = 1;

    var container = ensureContainer();
    container.style.display = 'block';
    container.innerHTML = renderNav() + '<div id="rs-step-content" class="rs-step-wrap"><div class="rs-loading">加载项目数据...</div></div>';
    var closeBtn = document.getElementById('rs-btn-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    NS.apiClient.getContext(currentContext.projectId).then(function (res) {
      reportContext = res.context;
      var el = document.getElementById('rs-step-content');
      if (el) NS.dataReadiness.render(el, reportContext, goToStep2);
    }).catch(function (err) {
      var el = document.getElementById('rs-step-content');
      if (el) el.innerHTML = '<div class="rs-step-content"><div class="rs-card rs-card-warn"><p>加载失败：' + esc(err.message) + '</p></div></div>';
    });
  }

  function close() {
    var container = document.getElementById(CONTAINER_ID);
    if (container) { container.style.display = 'none'; container.innerHTML = ''; }
    currentContext = null;
    reportContext = null;
    calcSnapshot = null;
    currentDraft = null;
    currentSections = [];
    currentValidation = null;
    currentStep = 0;
  }

  function getContext() {
    return currentContext ? Object.assign({}, currentContext) : null;
  }

  window.SmartRenewReportStudio = { open: open, close: close, getContext: getContext };
})();
