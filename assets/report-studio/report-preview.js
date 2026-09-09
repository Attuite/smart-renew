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
  var paragraphGroup = 0;

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
   * @param {string} [reportId] - 报告快照 ID，用于新版 AI 叙述生成
   */
  function renderStep3(container, draft, sections, onNext, onBack, reportId) {
    var html = '<div class="rs-step-content">';
    html += '<h2 class="rs-step-title">步骤 03：分章生成</h2>';

    // 新版 AI 叙述生成（范例驱动）
    html += '<div class="rs-card" style="border-left:3px solid var(--spice-500);">';
    html += '<h3 class="rs-card-title">AI 叙述生成（范例驱动）</h3>';
    html += '<p class="rs-muted" style="margin-bottom:12px;">基于范例报告模板，逐小节生成项目化正文。每个小节读取对应范例原文、项目事实包和指标数据，生成后自动校验。</p>';
    html += '<div class="rs-actions">';
    html += '<button class="rs-btn rs-btn-primary" id="rs-narrative-gen-all">生成全部 AI 小节</button>';
    html += '<button class="rs-btn rs-btn-outline" id="rs-narrative-view">查看已生成文档</button>';
    html += '</div>';
    html += '<div id="rs-narrative-status" style="margin-top:12px;"></div>';
    html += '</div>';

    // 旧版分章生成（模板段落）
    var templateSections = NS.templateSchema ? NS.templateSchema.SECTIONS : [];
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">模板段落生成</h3>';
    html += '<p class="rs-muted" style="margin-bottom:12px;">基于 Word 母版模板，逐段生成正式报告正文。</p>';
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
    html += '<button class="rs-btn rs-btn-outline" id="rs-gen-all">生成全部未锁定模板段落</button>';
    if (onNext) html += '<button class="rs-btn rs-btn-outline" id="rs-to-review">进入编辑审核</button>';
    if (onBack) html += '<button class="rs-btn rs-btn-outline" id="rs-back-calc">返回指标计算</button>';
    html += '</div></div>';

    container.innerHTML = html;

    // ============ 新版 AI 叙述生成绑定 ============
    var narrativeGenAllBtn = document.getElementById('rs-narrative-gen-all');
    var narrativeStatusEl = document.getElementById('rs-narrative-status');
    if (narrativeGenAllBtn && reportId) {
      narrativeGenAllBtn.addEventListener('click', function () {
        narrativeGenAllBtn.disabled = true;
        narrativeGenAllBtn.textContent = '生成中…';
        if (narrativeStatusEl) narrativeStatusEl.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem;">正在逐小节生成 AI 叙述，请勿关闭页面…</p>';

        // 先获取文档，收集所有 AI 小节 ID
        api.getNarrativeDocument(reportId).then(function (docRes) {
          var document = docRes.document || {};
          var allSubsectionIds = [];
          (document.sections || []).forEach(function (section) {
            (section.subsections || []).forEach(function (subsection) {
              if ((subsection.blocks || []).some(function (block) { return block.type === 'ai-narrative'; })) {
                if (allSubsectionIds.indexOf(subsection.id) < 0) allSubsectionIds.push(subsection.id);
              }
            });
          });
          if (!allSubsectionIds.length) {
            narrativeGenAllBtn.disabled = false;
            narrativeGenAllBtn.textContent = '生成全部 AI 小节';
            if (narrativeStatusEl) narrativeStatusEl.innerHTML = '<p style="color:var(--warning);">报告模板中没有可生成的 AI 小节</p>';
            return;
          }
          // 逐个生成
          var completed = 0;
          var failed = [];
          var chain = Promise.resolve();
          allSubsectionIds.forEach(function (subId, index) {
            chain = chain.then(function () {
              if (narrativeStatusEl) narrativeStatusEl.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem;">正在生成第 ' + (index + 1) + ' / ' + allSubsectionIds.length + ' 节…</p>';
              return api.generateNarrative(reportId, [subId]).then(function () {
                completed++;
              }).catch(function (err) {
                failed.push({ subsectionId: subId, error: err.message });
              });
            });
          });
          chain.then(function () {
            narrativeGenAllBtn.disabled = false;
            narrativeGenAllBtn.textContent = '生成全部 AI 小节';
            if (failed.length) {
              if (narrativeStatusEl) narrativeStatusEl.innerHTML = '<p style="color:var(--warning);">已生成 ' + completed + ' 个小节，' + failed.length + ' 个小节失败</p>';
            } else {
              if (narrativeStatusEl) narrativeStatusEl.innerHTML = '<p style="color:var(--success);">全部 ' + completed + ' 个 AI 小节生成完成</p>';
            }
          });
        }).catch(function (err) {
          narrativeGenAllBtn.disabled = false;
          narrativeGenAllBtn.textContent = '生成全部 AI 小节';
          if (narrativeStatusEl) narrativeStatusEl.innerHTML = '<p style="color:var(--error);">获取文档失败：' + err.message + '</p>';
        });
      });
    }

    var narrativeViewBtn = document.getElementById('rs-narrative-view');
    if (narrativeViewBtn && reportId) {
      narrativeViewBtn.addEventListener('click', function () {
        api.getNarrativeDocument(reportId).then(function (docRes) {
          var document = docRes.document || {};
          var completeness = document.completeness || {};
          var msg = '文档标题：' + (document.title || '未生成') + '\n';
          msg += 'AI 小节完成：' + (completeness.narrativeReady || 0) + ' / ' + (completeness.narrativeTotal || 0) + '\n';
          msg += '回退小节：' + (completeness.narrativeFallback || 0) + '\n';
          msg += '全部完成：' + (completeness.complete ? '是' : '否');
          alert(msg);
        }).catch(function (err) {
          alert('获取文档失败：' + err.message);
        });
      });
    }

    // ============ 旧版模板段落生成绑定 ============
    var genAllBtn = document.getElementById('rs-gen-all');
    if (genAllBtn) genAllBtn.addEventListener('click', function () {
      genAllBtn.disabled = true; genAllBtn.textContent = '生成中…';
      var toGen = sections.filter(function (s) { return !s.locked && (s.status === 'not-generated' || s.status === 'error'); });
      var chain = Promise.resolve();
      toGen.forEach(function (s) {
        chain = chain.then(function () {
          return api.generateSection(draft.id, s.id, 'generate').then(function (res) { replaceSection(sections, res.section); });
        });
      });
      chain.then(function () {
        alert('生成完成');
        if (onNext) onNext();
      }).catch(function (e) {
        genAllBtn.disabled = false; genAllBtn.textContent = '生成全部未锁定模板段落';
        alert('生成失败：' + e.message);
      });
    });

    container.querySelectorAll('.rs-gen-single').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true; btn.textContent = '生成中…';
        var section = sections.find(function (item) { return item.sectionKey === btn.dataset.key; });
        if (!section) { alert('章节尚未初始化'); return; }
        api.generateSection(draft.id, section.id, 'generate').then(function (res) {
          replaceSection(sections, res.section);
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

  NS.reportPreview = {
    init: init,
    renderStep3: renderStep3,
    renderStep5: renderStep5
  };

  function replaceSection(sections, next) {
    if (!next) return;
    var index = sections.findIndex(function (item) { return item.id === next.id; });
    if (index >= 0) sections[index] = next;
  }
})();
