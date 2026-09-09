/**
 * calculation-view.js
 * 报告工作台步骤02：指标计算。
 * 展示公式、输入、结果和来源；支持一键计算和冻结快照。
 *
 * 公共挂载：window.SmartRenewReportStudioModules.calculationView
 */
(function () {
  'use strict';

  var NS = window.SmartRenewReportStudioModules =
    window.SmartRenewReportStudioModules || {};

  var api = null;
  var currentSnapshot = null;

  function init() {
    api = NS.apiClient;
  }

  function esc(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text == null ? '' : text)));
    return div.innerHTML;
  }

  function statusLabel(status) {
    var map = {
      'calculated': '已计算',
      'not-computable': '无法计算',
      'not-applicable': '不适用',
      'error': '计算错误',
      'zero': '零',
      'null': '无数据'
    };
    return map[status] || status;
  }

  function statusClass(status) {
    if (status === 'calculated') return 'rs-calc-ok';
    if (status === 'not-computable') return 'rs-calc-pending';
    return 'rs-calc-warn';
  }

  /**
   * 渲染步骤02
   * @param {HTMLElement} container
   * @param {object} context - 标准报告上下文
   * @param {object|null} snapshot - 已有的计算快照（可选）
   * @param {Function} onNext - 进入下一步
   * @param {Function} onBack - 返回上一步
   */
  function render(container, context, snapshot, onNext, onBack) {
    currentSnapshot = snapshot;
    var html = '<div class="rs-step-content">';
    html += '<h2 class="rs-step-title">步骤 02：指标计算</h2>';

    if (!snapshot) {
      html += '<div class="rs-card">';
      html += '<p class="rs-muted">尚未运行计算。点击下方按钮自动计算全部指标。</p>';
      html += '<div class="rs-actions">';
      html += '<button class="rs-btn rs-btn-primary" id="rs-btn-run-calc">运行全部计算</button>';
      if (onBack) html += '<button class="rs-btn rs-btn-outline" id="rs-btn-back-calc">返回数据准备</button>';
      html += '</div></div>';
    } else {
      // 快照摘要
      html += '<div class="rs-card">';
      html += '<div class="rs-flex rs-flex-between">';
      html += '<h3 class="rs-card-title">计算结果</h3>';
      html += '<span class="rs-badge">' + esc(snapshot.results.length) + ' 项指标</span>';
      html += '</div>';

      // 按类别展示
      var categories = [
        { key: 'housing', label: '住宅台账' },
        { key: 'photos', label: '现场采集' },
        { key: 'issues', label: '正式问题' },
        { key: 'community', label: '社区/街区' }
      ];

      for (var ci = 0; ci < categories.length; ci++) {
        var cat = categories[ci];
        var rules = snapshot.byCategory[cat.key] || [];
        if (!rules.length) continue;

        html += '<div class="rs-calc-section">';
        html += '<h4 class="rs-calc-section-title">' + esc(cat.label) + '</h4>';
        html += '<table class="rs-table rs-table-calc"><thead><tr>';
        html += '<th>指标</th><th>公式</th><th>输入</th><th>结果</th><th>单位</th><th>状态</th>';
        html += '</tr></thead><tbody>';

        for (var ri = 0; ri < rules.length; ri++) {
          var r = rules[ri];
          var inputStr = '';
          if (r.inputs && typeof r.inputs === 'object') {
            var keys = Object.keys(r.inputs);
            inputStr = keys.map(function (k) { return k + '=' + r.inputs[k]; }).join(', ');
          }
          html += '<tr class="' + statusClass(r.status) + '">';
          html += '<td class="rs-calc-label">' + esc(r.label) + '</td>';
          html += '<td class="rs-calc-formula">' + esc(r.formulaLabel) + '</td>';
          html += '<td class="rs-calc-input">' + esc(inputStr || '—') + '</td>';
          html += '<td class="rs-calc-value">' + esc(r.formattedValue) + '</td>';
          html += '<td>' + esc(r.unit || '') + '</td>';
          html += '<td><span class="rs-status ' + statusClass(r.status) + '">' + statusLabel(r.status) + '</span></td>';
          html += '</tr>';
        }

        html += '</tbody></table></div>';
      }

      html += '</div>';

      // 操作
      html += '<div class="rs-actions">';
      html += '<button class="rs-btn rs-btn-primary" id="rs-btn-freeze">冻结本次计算结果</button>';
      html += '<button class="rs-btn rs-btn-outline" id="rs-btn-recalc">重新计算</button>';
      if (onBack) html += '<button class="rs-btn rs-btn-outline" id="rs-btn-back-calc">返回数据准备</button>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;

    // 绑定事件
    var runBtn = document.getElementById('rs-btn-run-calc');
    if (runBtn) runBtn.addEventListener('click', function () { handleRunCalc(container, context, onNext, onBack); });

    var recalcBtn = document.getElementById('rs-btn-recalc');
    if (recalcBtn) recalcBtn.addEventListener('click', function () { handleRunCalc(container, context, onNext, onBack); });

    var freezeBtn = document.getElementById('rs-btn-freeze');
    if (freezeBtn && onNext) freezeBtn.addEventListener('click', function () { onNext(currentSnapshot); });

    var backBtn = document.getElementById('rs-btn-back-calc');
    if (backBtn && onBack) backBtn.addEventListener('click', onBack);
  }

  function handleRunCalc(container, context, onNext, onBack) {
    var btn = document.getElementById('rs-btn-run-calc') || document.getElementById('rs-btn-recalc');
    if (btn) { btn.disabled = true; btn.textContent = '计算中...'; }

    api.runCalculations(context.projectId).then(function (res) {
      currentSnapshot = res.snapshot;
      render(container, context, currentSnapshot, onNext, onBack);
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = '运行全部计算'; }
      alert('计算失败：' + err.message);
    });
  }

  NS.calculationView = { init: init, render: render };
})();
