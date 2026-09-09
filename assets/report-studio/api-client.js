/**
 * api-client.js
 * 报告工作台 API 客户端封装。
 * 本地 server 和 CloudBase 共用同一套前端调用。
 *
 * 公共挂载：window.SmartRenewReportStudioModules.apiClient
 */
(function () {
  'use strict';

  var NS = window.SmartRenewReportStudioModules =
    window.SmartRenewReportStudioModules || {};

  var BASE = '/api/report-studio';

  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body !== undefined && method !== 'GET') {
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE + path, opts).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.message || '请求失败 (' + res.status + ')');
        return data;
      });
    });
  }

  var api = {
    /**
     * 获取项目报告上下文
     * @param {string} projectId
     * @returns {Promise<{context: object}>}
     */
    getContext: function (projectId) {
      return request('GET', '/projects/' + encodeURIComponent(projectId) + '/context');
    },

    /**
     * 运行全部计算
     * @param {string} projectId
     * @returns {Promise<{snapshot: object}>}
     */
    runCalculations: function (projectId) {
      return request('POST', '/projects/' + encodeURIComponent(projectId) + '/calculations', {});
    },

    /**
     * 创建报告草稿
     * @param {string} projectId
     * @param {object} params
     * @returns {Promise<{draft: object}>}
     */
    createDraft: function (projectId, params) {
      return request('POST', '/projects/' + encodeURIComponent(projectId) + '/drafts', params || {});
    },

    /**
     * 查询项目草稿列表
     * @param {string} projectId
     * @returns {Promise<{items: object[]}>}
     */
    listDrafts: function (projectId) {
      return request('GET', '/projects/' + encodeURIComponent(projectId) + '/drafts');
    },

    /**
     * 查询指定草稿
     * @param {string} draftId
     * @returns {Promise<{draft: object}>}
     */
    getDraft: function (draftId) {
      return request('GET', '/drafts/' + encodeURIComponent(draftId));
    },

    /**
     * 生成或重新生成单段
     * @param {string} draftId
     * @param {string} sectionId
     * @param {string} mode - 'generate' | 'regenerate'
     * @returns {Promise<{section: object}>}
     */
    generateSection: function (draftId, sectionId, mode) {
      return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/sections/' + encodeURIComponent(sectionId) + '/generate', { mode: mode || 'generate' });
    },

    /**
     * 保存段落编辑
     * @param {string} draftId
     * @param {string} sectionId
     * @param {object} content
     * @param {number} baseVersion
     * @returns {Promise<{section: object}>}
     */
    saveSection: function (draftId, sectionId, content, baseVersion) {
      return request('PUT', '/drafts/' + encodeURIComponent(draftId) + '/sections/' + encodeURIComponent(sectionId), { content: content, baseVersion: baseVersion });
    },

    /**
     * 审核通过
     * @param {string} draftId
     * @param {string} sectionId
     * @param {string} reviewedBy
     * @returns {Promise<{section: object}>}
     */
    reviewSection: function (draftId, sectionId, reviewedBy) {
      return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/sections/' + encodeURIComponent(sectionId) + '/review', { reviewedBy: reviewedBy });
    },

    /**
     * 锁定段落
     * @param {string} draftId
     * @param {string} sectionId
     * @param {string} lockedBy
     * @returns {Promise<{section: object}>}
     */
    lockSection: function (draftId, sectionId, lockedBy) {
      return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/sections/' + encodeURIComponent(sectionId) + '/lock', { lockedBy: lockedBy });
    },

    /**
     * 全文校验
     * @param {string} draftId
     * @returns {Promise<{validation: object}>}
     */
    validateDraft: function (draftId) {
      return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/validate', {});
    },

    /**
     * 导出 Word
     * @param {string} draftId
     * @param {string} edition - 'review' | 'formal'
     * @param {string} generatedBy
     * @returns {Promise<{artifact: object}>}
     */
    exportDocx: function (draftId, edition, generatedBy) {
      return request('POST', '/drafts/' + encodeURIComponent(draftId) + '/exports/docx', { edition: edition, generatedBy: generatedBy });
    }
  };

  NS.apiClient = api;
})();
