/**
 * report-preview.js
 * 报告预览和导出面板。
 * 展示正式报告网页预览、校验结果和 Word 导出。
 *
 * 公共挂载：window.SmartRenewReportStudioModules.reportPreview
 */
(function () {
  'use strict';

  var NS = window.SmartRenewReportStudioModules =
    window.SmartRenewReportStudioModules || {};

  var api = null;

  function init() { api = NS.apiClient; }

  function esc(t) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(t == null ? '' : t)));
    return d.innerHTML;
  }

  /**
   * 渲染步骤03：分章生成概览
   * @param {HTMLElement} container
   * @param {object} draft
   * @param {object[]} sections
   * @param {Function} onNext
   * @param {Function} onBack
   */
  function renderStep3(container, draft, sections, onNext, onBack) {
    var html = '<div class="rs-step-content">';
    html += '<h2 class="rs-step-title">步骤 03：分章生成</h2>';

    // 需要生成的章节列表
    var templateSections = NS.templateSchema ? NS.templateSchema.SECTIONS : [];
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">章节状态</h3>';
    html += '<table class="rs-table"><thead><tr><th>章节</th><th>状态</th><th>操作</th></tr></thead><tbody>';

    for (var i = 0; i < templateSections.length; i++) {
      var ts = templateSections[i];
      var existing = sections.find(function (s) { return s.sectionKey === ts.key; });
      var status = existing ? existing.status : 'not-generated';
      var statusMap = {
        'not-generated': '未生成', 'generating': '生成中', 'generated': '已生成',
        'edited': '已编辑', 'approved': '已审核', 'locked': '已锁定', 'error': '失败'
      };
      html += '<tr>';
      html += '<td>' + esc(ts.title) + '</td>';
      html += '<td><span class="rs-badge rs-badge-' + (status === 'locked' ? 'blue' : status === 'generated' || status === 'approved' ? 'green' : 'muted') + '">' + (statusMap[status] || status) + '</span></td>';
      html += '<td>';
      if (status === 'not-generated' || status === 'error') {
        html += '<button class="rs-btn rs-btn-sm rs-btn-outline rs-gen-single" data-key="' + esc(ts.key) + '">生成</button>';
      }
      html += '</td></tr>';
    }
    html += '</tbody></table></div>';

    // 操作
    html += '<div class="rs-actions">';
    html += '<button class="rs-btn rs-btn-primary" id="rs-gen-all">生成全部未锁定章节</button>';
    if (onNext) html += '<button class="rs-btn rs-btn-outline" id="rs-to-review">进入编辑审核</button>';
    if (onBack) html += '<button class="rs-btn rs-btn-outline" id="rs-back-calc">返回指标计算</button>';
    html += '</div></div>';

    container.innerHTML = html;

    // 绑定
    var genAllBtn = document.getElementById('rs-gen-all');
    if (genAllBtn) genAllBtn.addEventListener('click', function () {
      genAllBtn.disabled = true; genAllBtn.textContent = '生成中…';
      // 逐个生成未锁定章节
      var toGen = sections.filter(function (s) { return !s.locked && s.status !== 'locked'; });
      var chain = Promise.resolve();
      toGen.forEach(function (s) {
        chain = chain.then(function () {
          return api.generateSection(draft.id, s.id, 'generate');
        });
      });
      chain.then(function () {
        alert('生成完成');
        if (onNext) onNext();
      }).catch(function (e) {
        genAllBtn.disabled = false; genAllBtn.textContent = '生成全部未锁定章节';
        alert('生成失败：' + e.message);
      });
    });

    container.querySelectorAll('.rs-gen-single').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.textContent = '生成中…';
        api.generateSection(draft.id, btn.dataset.key, 'generate').then(function () {
          alert('生成完成');
          if (onNext) onNext();
        }).catch(function (e) { btn.disabled = false; btn.textContent = '生成'; alert(e.message); });
      });
    });

    var toReview = document.getElementById('rs-to-review');
    if (toReview && onNext) toReview.addEventListener('click', onNext);
    var backCalc = document.getElementById('rs-back-calc');
    if (backCalc && onBack) backCalc.addEventListener('click', onBack);
  }

  /**
   * 渲染步骤05：Word 导出
   * @param {HTMLElement} container
   * @param {object} draft
   * @param {object[]} sections
   * @param {object} validation - 校验结果
   * @param {Function} onBack
   */
  function renderStep5(container, draft, sections, validation, onBack) {
    var html = '<div class="rs-step-content">';
    html += '<h2 class="rs-step-title">步骤 05：Word 导出</h2>';

    // 校验结果
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">校验结果</h3>';
    if (validation) {
      var errCount = validation.issues ? validation.issues.filter(function (i) { return i.severity === 'error'; }).length : 0;
      var warnCount = validation.issues ? validation.issues.filter(function (i) { return i.severity === 'warning'; }).length : 0;
      html += '<div class="rs-grid rs-grid-3">';
      html += '<div class="rs-stat"><span class="rs-stat-label">状态</span><span class="rs-stat-value ' + (validation.valid ? '' : 'rs-stat-high') + '">' + (validation.valid ? '通过' : '未通过') + '</span></div>';
      html += '<div class="rs-stat rs-stat-high"><span class="rs-stat-label">错误</span><span class="rs-stat-value">' + errCount + '</span></div>';
      html += '<div class="rs-stat"><span class="rs-stat-label">警告</span><span class="rs-stat-value">' + warnCount + '</span></div>';
      html += '</div>';
      if (validation.issues && validation.issues.length) {
        html += '<ul class="rs-list" style="margin-top:12px">';
        for (var i = 0; i < validation.issues.length; i++) {
          var iss = validation.issues[i];
          html += '<li class="' + (iss.severity === 'error' ? 'rs-warn-item' : 'rs-miss-item') + '">';
          html += esc(iss.message);
          if (iss.details && iss.details.length) html += '：' + esc(iss.details.slice(0, 5).join('、'));
          html += '</li>';
        }
        html += '</ul>';
      }
    } else {
      html += '<p class="rs-muted">尚未运行校验。</p>';
    }
    html += '</div>';

    // 导出操作
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">导出 Word</h3>';
    html += '<p class="rs-muted">导出基于冻结的计算快照和已审核的段落内容。</p>';
    html += '<div class="rs-actions">';
    html += '<button class="rs-btn rs-btn-primary" id="rs-export-formal"' + (validation && !validation.valid ? ' disabled' : '') + '>导出正式版</button>';
    html += '<button class="rs-btn rs-btn-outline" id="rs-export-review">导出审核稿</button>';
    html += '</div></div>';

    if (onBack) {
      html += '<div class="rs-actions"><button class="rs-btn rs-btn-outline" id="rs-back-review">返回编辑审核</button></div>';
    }
    html += '</div>';

    container.innerHTML = html;

    var formalBtn = document.getElementById('rs-export-formal');
    if (formalBtn) formalBtn.addEventListener('click', function () {
      formalBtn.disabled = true; formalBtn.textContent = '导出中…';
      api.exportDocx(draft.id, 'formal', '用户').then(function (res) {
        alert('导出完成：' + (res.artifact ? res.artifact.fileName || '报告.docx' : '报告.docx'));
        if (res.artifact && res.artifact.downloadUrl) window.open(res.artifact.downloadUrl);
      }).catch(function (e) { formalBtn.disabled = false; formalBtn.textContent = '导出正式版'; alert('导出失败：' + e.message); });
    });

    var reviewBtn = document.getElementById('rs-export-review');
    if (reviewBtn) reviewBtn.addEventListener('click', function () {
      reviewBtn.disabled = true; reviewBtn.textContent = '导出中…';
      api.exportDocx(draft.id, 'review', '用户').then(function (res) {
        alert('审核稿导出完成');
        if (res.artifact && res.artifact.downloadUrl) window.open(res.artifact.downloadUrl);
      }).catch(function (e) { reviewBtn.disabled = false; reviewBtn.textContent = '导出审核稿'; alert('导出失败：' + e.message); });
    });

    var backBtn = document.getElementById('rs-back-review');
    if (backBtn && onBack) backBtn.addEventListener('click', onBack);
  }

  NS.reportPreview = {
    init: init,
    renderStep3: renderStep3,
    renderStep5: renderStep5
  };
})();
