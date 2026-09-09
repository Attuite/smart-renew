/**
 * data-readiness.js
 * 报告工作台步骤01：数据准备。
 * 展示项目数据完整度、照片、分析、问题和缺失项。
 *
 * 公共挂载：window.SmartRenewReportStudioModules.dataReadiness
 */
(function () {
  'use strict';

  var NS = window.SmartRenewReportStudioModules =
    window.SmartRenewReportStudioModules || {};

  var api = null;

  function init() {
    api = NS.apiClient;
  }

  /**
   * 渲染步骤01内容到容器
   * @param {HTMLElement} container
   * @param {object} context - 标准报告上下文
   * @param {Function} onNext - 进入下一步的回调
   */
  function render(container, context, onNext) {
    if (!context) {
      container.innerHTML = '<div class="rs-empty">无法加载项目数据</div>';
      return;
    }

    var p = context.project;
    var h = context.housing;
    var ph = context.photos;
    var an = context.analyses;
    var iss = context.officialIssues;
    var av = context.availability;

    var html = '<div class="rs-step-content">';
    html += '<h2 class="rs-step-title">步骤 01：数据准备</h2>';

    // 项目概览
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">项目概览</h3>';
    html += '<div class="rs-grid rs-grid-3">';
    html += rsStat('项目名称', p.name || '—');
    html += rsStat('行政区划', p.administrativeArea || '—');
    html += rsStat('项目范围', p.scopeAreaSqKm ? p.scopeAreaSqKm + ' km²' : '—');
    html += '</div></div>';

    // 住宅台账
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">住宅台账</h3>';
    html += '<div class="rs-grid rs-grid-4">';
    html += rsStat('住宅小区', h.communityCount + ' 个');
    html += rsStat('住宅楼栋', h.buildingCount + ' 栋');
    html += rsStat('住宅户数', h.householdCount + ' 户');
    html += rsStat('有楼栋明细', h.communitiesWithBuildingDetail + ' 个小区');
    html += '</div>';
    if (h.communities && h.communities.length) {
      html += '<table class="rs-table rs-table-sm"><thead><tr><th>小区</th><th>楼栋</th><th>户数</th></tr></thead><tbody>';
      for (var i = 0; i < h.communities.length; i++) {
        var c = h.communities[i];
        html += '<tr><td>' + esc(c.name) + '</td><td>' + c.buildingCount + '</td><td>' + c.householdCount + '</td></tr>';
      }
      html += '</tbody></table>';
    }
    html += '</div>';

    // 现场采集
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">现场采集</h3>';
    html += '<div class="rs-grid rs-grid-4">';
    html += rsStat('原始照片', ph.originalCount + ' 张');
    html += rsStat('标注图', ph.annotatedCount + ' 张');
    html += rsStat('分析批次', an.totalCount + ' 个');
    html += rsStat('已归档分析', an.archivedCount + ' 个');
    html += '</div></div>';

    // 正式问题
    html += '<div class="rs-card">';
    html += '<h3 class="rs-card-title">正式问题</h3>';
    html += '<div class="rs-grid rs-grid-4">';
    html += rsStat('问题总数', iss.totalCount + ' 个');
    html += rsStat('高风险', iss.stats.high + ' 个', 'rs-stat-high');
    html += rsStat('中风险', iss.stats.medium + ' 个', 'rs-stat-medium');
    html += rsStat('低风险', iss.stats.low + ' 个', 'rs-stat-low');
    html += '</div></div>';

    // 缺失项
    if (av.warnings.length || av.missingFields.length || av.missingImageSlots.length) {
      html += '<div class="rs-card rs-card-warn">';
      html += '<h3 class="rs-card-title">数据提示</h3>';
      html += '<ul class="rs-list">';
      for (var w = 0; w < av.warnings.length; w++) {
        html += '<li class="rs-warn-item">' + esc(av.warnings[w]) + '</li>';
      }
      for (var m = 0; m < av.missingFields.length; m++) {
        html += '<li class="rs-miss-item">缺少：' + esc(av.missingFields[m].label) + '</li>';
      }
      for (var s = 0; s < av.missingImageSlots.length; s++) {
        html += '<li class="rs-miss-item">缺图：' + esc(av.missingImageSlots[s].label) + '</li>';
      }
      html += '</ul></div>';
    }

    // 操作
    html += '<div class="rs-actions">';
    html += '<button class="rs-btn rs-btn-primary" id="rs-btn-to-calc">进入指标计算</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    var btn = document.getElementById('rs-btn-to-calc');
    if (btn && onNext) btn.addEventListener('click', onNext);
  }

  function rsStat(label, value, cls) {
    return '<div class="rs-stat ' + (cls || '') + '"><span class="rs-stat-label">' + esc(label) + '</span><span class="rs-stat-value">' + esc(value) + '</span></div>';
  }

  function esc(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(text == null ? '' : text)));
    return div.innerHTML;
  }

  NS.dataReadiness = { init: init, render: render };
})();
