/**
 * section-editor.js
 * 报告工作台步骤04：编辑审核。
 * 支持按章节预览、直接编辑、审核通过、锁定/解锁、重新生成。
 *
 * 公共挂载：window.SmartRenewReportStudioModules.sectionEditor
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

  function statusBadge(status) {
    var map = {
      'not-generated': ['未生成', 'rs-badge-muted'],
      'generating': ['生成中…', 'rs-badge-amber'],
      'generated': ['已生成', 'rs-badge-green'],
      'edited': ['已编辑', 'rs-badge-amber'],
      'approved': ['已审核', 'rs-badge-green'],
      'locked': ['已锁定', 'rs-badge-blue'],
      'error': ['生成失败', 'rs-badge-red']
    };
    var pair = map[status] || ['未知', 'rs-badge-muted'];
    return '<span class="rs-badge ' + pair[1] + '">' + esc(pair[0]) + '</span>';
  }

  /**
   * 渲染步骤04
   * @param {HTMLElement} container
   * @param {object} draft - 草稿对象
   * @param {object[]} sections - 段落列表
   * @param {Function} onNext - 进入下一步
   * @param {Function} onBack - 返回
   */
  function render(container, draft, sections, onNext, onBack) {
    var html = '<div class="rs-step-content">';
    html += '<h2 class="rs-step-title">步骤 04：编辑审核</h2>';

    if (!sections || !sections.length) {
      html += '<div class="rs-card"><p class="rs-muted">尚无生成的段落。请先在步骤03完成分章生成。</p></div>';
    } else {
      // 段落列表
      html += '<div class="rs-card">';
      html += '<div class="rs-flex rs-flex-between" style="margin-bottom:12px">';
      html += '<h3 class="rs-card-title" style="margin:0">段落列表</h3>';
      html += '<span class="rs-badge">' + sections.length + ' 段</span>';
      html += '</div>';

      html += '<table class="rs-table"><thead><tr>';
      html += '<th>章节</th><th>状态</th><th>版本</th><th>操作</th>';
      html += '</tr></thead><tbody>';

      for (var i = 0; i < sections.length; i++) {
        var s = sections[i];
        html += '<tr data-section-id="' + esc(s.id) + '">';
        html += '<td><strong>' + esc(s.sectionKey) + '</strong></td>';
        html += '<td>' + statusBadge(s.status) + '</td>';
        html += '<td>v' + s.version + '</td>';
        html += '<td class="rs-actions-cell">';

        if (!s.locked && (s.status === 'generated' || s.status === 'edited')) {
          html += '<button class="rs-btn rs-btn-sm rs-btn-outline rs-edit-btn" data-id="' + esc(s.id) + '">编辑</button> ';
          html += '<button class="rs-btn rs-btn-sm rs-btn-outline rs-review-btn" data-id="' + esc(s.id) + '">审核</button> ';
        }
        if (!s.locked && s.status !== 'not-generated') {
          html += '<button class="rs-btn rs-btn-sm rs-btn-outline rs-regen-btn" data-id="' + esc(s.id) + '">重新生成</button> ';
        }
        if (s.status === 'approved' || s.status === 'locked') {
          html += '<button class="rs-btn rs-btn-sm rs-btn-outline rs-lock-btn" data-id="' + esc(s.id) + '">' + (s.locked ? '解锁' : '锁定') + '</button>';
        }
        html += '</td></tr>';
      }
      html += '</tbody></table></div>';

      // 编辑区域（默认隐藏）
      html += '<div class="rs-card" id="rs-edit-panel" style="display:none">';
      html += '<h3 class="rs-card-title">编辑段落</h3>';
      html += '<div id="rs-edit-content"></div>';
      html += '<div class="rs-actions">';
      html += '<button class="rs-btn rs-btn-primary rs-save-edit-btn">保存编辑</button>';
      html += '<button class="rs-btn rs-btn-outline rs-cancel-edit-btn">取消</button>';
      html += '</div></div>';
    }

    // 操作
    html += '<div class="rs-actions">';
    if (onNext) html += '<button class="rs-btn rs-btn-primary" id="rs-btn-to-export">进入 Word 导出</button>';
    if (onBack) html += '<button class="rs-btn rs-btn-outline" id="rs-btn-back-review">返回分章生成</button>';
    html += '</div></div>';

    container.innerHTML = html;
    bindEvents(container, draft, sections, onNext, onBack);
  }

  function bindEvents(container, draft, sections, onNext, onBack) {
    // 编辑按钮
    container.querySelectorAll('.rs-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.dataset.id;
        var section = sections.find(function (s) { return s.id === sid; });
        if (!section) return;
        showEditor(container, section);
      });
    });

    // 审核按钮
    container.querySelectorAll('.rs-review-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.dataset.id;
        api.reviewSection(draft.id, sid, '审核人').then(function () {
          alert('审核通过');
          render(container, draft, sections, onNext, onBack);
        }).catch(function (e) { alert('审核失败：' + e.message); });
      });
    });

    // 锁定按钮
    container.querySelectorAll('.rs-lock-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.dataset.id;
        var section = sections.find(function (s) { return s.id === sid; });
        if (!section) return;
        var action = section.locked ? '解锁' : '锁定';
        api.lockSection(draft.id, sid, '操作人').then(function () {
          alert(action + '成功');
          render(container, draft, sections, onNext, onBack);
        }).catch(function (e) { alert(action + '失败：' + e.message); });
      });
    });

    // 重新生成按钮
    container.querySelectorAll('.rs-regen-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.dataset.id;
        btn.disabled = true; btn.textContent = '生成中…';
        api.generateSection(draft.id, sid, 'regenerate').then(function () {
          alert('重新生成完成');
          render(container, draft, sections, onNext, onBack);
        }).catch(function (e) { btn.disabled = false; btn.textContent = '重新生成'; alert('生成失败：' + e.message); });
      });
    });

    // 保存编辑
    container.querySelectorAll('.rs-save-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sid = btn.dataset.sectionId;
        var textarea = document.getElementById('rs-edit-textarea');
        if (!textarea || !sid) return;
        api.saveSection(draft.id, sid, { text: textarea.value }, parseInt(btn.dataset.version || '0', 10))
          .then(function () { alert('保存成功'); render(container, draft, sections, onNext, onBack); })
          .catch(function (e) { alert('保存失败：' + e.message); });
      });
    });

    // 取消编辑
    container.querySelectorAll('.rs-cancel-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = document.getElementById('rs-edit-panel');
        if (panel) panel.style.display = 'none';
      });
    });

    // 下一步
    var exportBtn = document.getElementById('rs-btn-to-export');
    if (exportBtn && onNext) exportBtn.addEventListener('click', onNext);

    var backBtn = document.getElementById('rs-btn-back-review');
    if (backBtn && onBack) backBtn.addEventListener('click', onBack);
  }

  function showEditor(container, section) {
    var panel = document.getElementById('rs-edit-panel');
    var content = document.getElementById('rs-edit-content');
    if (!panel || !content) return;
    panel.style.display = 'block';
    var text = '';
    if (section.content && section.content.paragraphs) {
      text = section.content.paragraphs.map(function (p) { return p.text || ''; }).join('\n\n');
    } else if (section.content && typeof section.content.text === 'string') {
      text = section.content.text;
    }
    content.innerHTML = '<textarea id="rs-edit-textarea" class="rs-textarea" rows="12">' + esc(text) + '</textarea>';
    var saveBtn = container.querySelector('.rs-save-edit-btn');
    if (saveBtn) {
      saveBtn.dataset.sectionId = section.id;
      saveBtn.dataset.version = section.version;
    }
  }

  NS.sectionEditor = { init: init, render: render };
})();
