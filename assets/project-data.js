(function () {
  'use strict';

  var typeLabels = {
    project: '项目档案',
    scope: '项目范围',
    residentialUnit: '住宅台账',
    geoNode: '地理单元',
    photo: '照片',
    analysisRecord: '分析批次',
    issue: '问题实例',
    indicatorResult: '指标结果',
    report: '报告',
    dictionary: '标准字典',
    audit: '审计记录',
    other: '其他数据'
  };
  var sqliteTypeMap = {
    project: 'project',
    geo_node: 'geoNode',
    photo: 'photo',
    analysis_record: 'analysisRecord',
    issue: 'issue',
    issue_media: 'issue',
    unclassified_problem: 'issue',
    indicator_result: 'indicatorResult',
    score_summary: 'indicatorResult',
    report: 'report',
    report_indicator_ref: 'report',
    report_issue_ref: 'report',
    audit_log: 'audit',
    dimension: 'dictionary',
    element: 'dictionary',
    indicator: 'dictionary',
    problem_category: 'dictionary',
    problem_type: 'dictionary',
    remediation: 'dictionary',
    severity_rule: 'dictionary',
    severity_band: 'dictionary',
    code_dict: 'dictionary',
    geo_level: 'dictionary',
    survey_route: 'other',
    survey_stop: 'other',
    gis_layer: 'other',
    meta: 'other'
  };
  var sqliteTables = Object.keys(sqliteTypeMap);
  var recordCache = {};
  var autoRebuilt = {};
  var sqlJsPromise = null;
  var syncTimers = {};

  function hash(value) {
    var next = 2166136261;
    var text = String(value || '');
    for (var i = 0; i < text.length; i++) {
      next ^= text.charCodeAt(i);
      next = Math.imul(next, 16777619);
    }
    return (next >>> 0).toString(36).toUpperCase();
  }

  function dataId(projectId, type, key) {
    return 'PDI-' + String(projectId) + '-' + String(type || 'other').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) + '-' + hash(key);
  }

  function targetRecordId() {
    var parts = window.location.hash.replace(/^#/, '').split('/');
    return parts[2] === 'data' ? decodeURIComponent(parts.slice(3).join('/')) : '';
  }

  function api(path, options) {
    return window.storageApi(path, options || {});
  }

  function escape(value) {
    return window.escapeHtml ? window.escapeHtml(value) : String(value == null ? '' : value);
  }

  window.projectDataIndexPanelHtml = function (projectId) {
    return '<div class="project-data-shell" id="projectDataIndexRoot" data-project-id="' + escape(projectId) + '">'
      + '<div class="project-data-toolbar"><div class="project-data-toolbar-copy"><strong>项目数据索引</strong><p>所有项目档案、住宅台账、问题、照片、指标和报告均使用独立编号。其他页面或外部接口可通过编号直接读取单条数据。</p></div>'
      + '<div class="project-data-actions">'
      + '<label class="btn btn-primary btn-sm" for="projectDataImportFile">导入数据库</label><input id="projectDataImportFile" type="file" accept=".db,.sqlite,.sqlite3,.json,application/json" onchange="importProjectDataFile(event,\'' + escape(projectId) + '\')">'
      + '<button class="btn btn-outline btn-sm" onclick="importCityHealthStandardLibrary(\'' + escape(projectId) + '\')">载入城市体检标准库</button>'
      + '<button class="btn btn-outline btn-sm" onclick="exportProjectDataJson(\'' + escape(projectId) + '\')">导出 JSON</button>'
      + '<button class="btn btn-outline btn-sm" onclick="exportProjectDataSqlite(\'' + escape(projectId) + '\')">导出 SQLite</button>'
      + '<button class="btn btn-outline btn-sm" onclick="rebuildProjectDataIndex(\'' + escape(projectId) + '\')">同步现有数据</button>'
      + '</div></div>'
      + '<div id="projectDataIndexContent" class="project-data-loading">正在读取项目数据索引...</div>'
      + '<p class="project-data-note">导入采用合并方式：相同来源编号会更新，不同编号会新增。SQLite 输出包含统一索引表，可供其他系统按数据编号、项目编号、类型或标签查询。</p>'
      + '</div>';
  };

  window.loadProjectDataIndex = async function (projectId) {
    var root = document.getElementById('projectDataIndexRoot');
    var content = document.getElementById('projectDataIndexContent');
    if (!root || !content || String(root.dataset.projectId) !== String(projectId)) return;
    content.className = 'project-data-loading';
    content.textContent = '正在读取项目数据索引...';
    try {
      var result = await api('/api/project-data?projectId=' + encodeURIComponent(projectId));
      if (!result.items.length && !autoRebuilt[projectId]) {
        autoRebuilt[projectId] = true;
        await api('/api/projects/' + encodeURIComponent(projectId) + '/data-index/rebuild', { method: 'POST', body: '{}' });
        result = await api('/api/project-data?projectId=' + encodeURIComponent(projectId));
      }
      recordCache = {};
      result.items.forEach(function (item) { recordCache[item.id] = item; });
      renderIndex(result.items, projectId);
    } catch (error) {
      content.className = 'project-data-empty';
      content.innerHTML = '<strong style="display:block;color:var(--editorial-ink);margin-bottom:8px;">数据索引暂不可用</strong><span>' + escape(error.message) + '</span>';
    }
  };

  window.hydrateProjectDataSummary = function (projects) {
    (projects || []).forEach(async function (project) {
      var target = document.getElementById('project-index-count-' + project.id);
      if (!target) return;
      try {
        var stats = await api('/api/projects/' + encodeURIComponent(project.id) + '/data-index/stats');
        target.textContent = stats.total ? stats.total + ' 条' : '待同步';
      } catch (error) {
        target.textContent = '待接入';
      }
    });
  };

  function renderIndex(items, projectId) {
    var content = document.getElementById('projectDataIndexContent');
    if (!content) return;
    var counts = {};
    var tags = {};
    items.forEach(function (item) {
      counts[item.dataType] = (counts[item.dataType] || 0) + 1;
      (item.tags || []).forEach(function (tag) { tags[tag] = true; });
    });
    var typeOptions = Object.keys(typeLabels).filter(function (key) { return counts[key]; })
      .map(function (key) { return '<option value="' + key + '">' + escape(typeLabels[key]) + '（' + counts[key] + '）</option>'; }).join('');
    content.className = '';
    content.innerHTML = '<div class="project-data-stats">'
      + stat(items.length, '索引数据')
      + stat(counts.issue || 0, '问题实例')
      + stat(counts.dictionary || 0, '标准字典')
      + stat(Object.keys(tags).length, '可用标签')
      + '</div>'
      + '<div class="project-data-filter"><input id="projectDataSearch" placeholder="搜索编号、名称、编码或标签" oninput="filterProjectDataRows()">'
      + '<select id="projectDataTypeFilter" onchange="filterProjectDataRows()"><option value="">全部数据类型</option>' + typeOptions + '</select>'
      + '<span style="font-size:.72rem;color:var(--editorial-muted);">共 ' + items.length + ' 条</span></div>'
      + '<div class="project-data-list" id="projectDataRows">' + renderRows(items, projectId) + '</div>';
    var target = targetRecordId();
    if (target) {
      var node = document.querySelector('[data-project-data-id="' + cssEscape(target) + '"]');
      if (node) setTimeout(function () { node.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    }
  }

  function stat(value, label) {
    return '<div class="project-data-stat"><strong>' + escape(value) + '</strong><span>' + escape(label) + '</span></div>';
  }

  function renderRows(items, projectId) {
    if (!items.length) return '<div class="project-data-empty">暂无索引数据，请点击“同步现有数据”或导入数据库。</div>';
    var target = targetRecordId();
    return items.map(function (item) {
      var tags = (item.tags || []).slice(0, 6).map(function (tag) { return '<span class="project-data-tag">' + escape(tag) + '</span>'; }).join('');
      var source = item.source === 'smart-renew' ? '智更平台' : (item.sourceTable ? 'SQLite · ' + item.sourceTable : item.source || '导入数据');
      return '<article class="project-data-row' + (target === item.id ? ' is-target' : '') + '" data-project-data-id="' + escape(item.id) + '" data-project-data-type="' + escape(item.dataType) + '" data-project-data-search="' + escape(JSON.stringify([item.id, item.code, item.title, item.tags, item.sourceId]).toLowerCase()) + '">'
        + '<div class="project-data-title"><strong>' + escape(item.title || '未命名数据') + '</strong><div class="project-data-id">' + escape(item.id) + '</div></div>'
        + '<div class="project-data-type">' + escape(item.dataTypeLabel || typeLabels[item.dataType] || '其他数据') + '<small>' + escape(source) + '</small></div>'
        + '<div class="project-data-tags">' + (tags || '<span class="project-data-tag">未标记</span>') + '</div>'
        + '<div class="project-data-row-actions"><button onclick="editProjectDataTags(\'' + escape(item.id) + '\',\'' + escape(projectId) + '\')">标记</button><button onclick="copyProjectDataLink(\'' + escape(item.id) + '\',\'' + escape(projectId) + '\')">复制索引</button></div>'
        + '</article>';
    }).join('');
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  window.filterProjectDataRows = function () {
    var query = String((document.getElementById('projectDataSearch') || {}).value || '').trim().toLowerCase();
    var type = String((document.getElementById('projectDataTypeFilter') || {}).value || '');
    var rows = document.querySelectorAll('[data-project-data-id]');
    for (var i = 0; i < rows.length; i++) {
      var matchesQuery = !query || String(rows[i].dataset.projectDataSearch || '').indexOf(query) >= 0;
      var matchesType = !type || rows[i].dataset.projectDataType === type;
      rows[i].style.display = matchesQuery && matchesType ? '' : 'none';
    }
  };

  window.rebuildProjectDataIndex = async function (projectId) {
    try {
      var result = await api('/api/projects/' + encodeURIComponent(projectId) + '/data-index/rebuild', { method: 'POST', body: '{}' });
      window.showToast('已同步 ' + result.rebuilt + ' 条现有项目数据', 'success');
      await window.loadProjectDataIndex(projectId);
    } catch (error) {
      window.showToast('同步失败：' + error.message, 'error');
    }
  };

  window.scheduleProjectDataIndexSync = function (projectId) {
    clearTimeout(syncTimers[projectId]);
    syncTimers[projectId] = setTimeout(async function () {
      try {
        await api('/api/projects/' + encodeURIComponent(projectId) + '/data-index/rebuild', { method: 'POST', body: '{}' });
        if (document.getElementById('projectDataIndexRoot')) await window.loadProjectDataIndex(projectId);
      } catch (error) {
        console.warn('项目数据索引同步失败', error);
      }
    }, 600);
  };

  window.editProjectDataTags = async function (id, projectId) {
    var item = recordCache[id];
    if (!item) return;
    var value = window.prompt('输入标签，多个标签用逗号分隔：', (item.tags || []).join('，'));
    if (value === null) return;
    item.tags = Array.from(new Set(value.split(/[,，]/).map(function (tag) { return tag.trim(); }).filter(Boolean))).slice(0, 30);
    try {
      await api('/api/project-data/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(item) });
      window.showToast('数据标签已保存', 'success');
      await window.loadProjectDataIndex(projectId);
    } catch (error) {
      window.showToast('标签保存失败：' + error.message, 'error');
    }
  };

  window.copyProjectDataLink = async function (id, projectId) {
    var link = window.location.href.split('#')[0] + '#project/' + encodeURIComponent(projectId) + '/data/' + encodeURIComponent(id);
    try {
      await navigator.clipboard.writeText(link);
      window.showToast('索引链接已复制', 'success');
    } catch (error) {
      window.prompt('复制下面的数据索引链接：', link);
    }
  };

  window.exportProjectDataJson = async function (projectId) {
    try {
      var envelope = await api('/api/projects/' + encodeURIComponent(projectId) + '/data-export');
      downloadBlob(new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json;charset=utf-8' }), fileName(envelope, 'json'));
      window.showToast('项目数据 JSON 已导出', 'success');
    } catch (error) {
      window.showToast('导出失败：' + error.message, 'error');
    }
  };

  window.exportProjectDataSqlite = async function (projectId) {
    try {
      var envelope = await api('/api/projects/' + encodeURIComponent(projectId) + '/data-export');
      var SQL = await loadSqlJs();
      var database = new SQL.Database();
      database.run('CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT);');
      database.run('CREATE TABLE project_data_index (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, data_type TEXT NOT NULL, source_table TEXT, source_id TEXT, code TEXT, title TEXT, status TEXT, tags_json TEXT, references_json TEXT, payload_json TEXT, created_at TEXT, updated_at TEXT);');
      var meta = database.prepare('INSERT INTO project_meta (key,value) VALUES (?,?)');
      [['format', envelope.format], ['schema_version', envelope.schemaVersion], ['exported_at', envelope.exportedAt], ['project', JSON.stringify(envelope.project)]].forEach(function (row) { meta.run(row); });
      meta.free();
      var insert = database.prepare('INSERT INTO project_data_index VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
      (envelope.records || []).forEach(function (item) {
        insert.run([item.id, String(item.projectId), item.dataType, item.sourceTable || '', item.sourceId || '', item.code || '', item.title || '', item.status || '', JSON.stringify(item.tags || []), JSON.stringify(item.references || []), JSON.stringify(item.payload || {}), item.createdAt || '', item.updatedAt || '']);
      });
      insert.free();
      downloadBlob(new Blob([database.export()], { type: 'application/vnd.sqlite3' }), fileName(envelope, 'db'));
      database.close();
      window.showToast('项目数据 SQLite 已导出', 'success');
    } catch (error) {
      window.showToast('SQLite 导出失败：' + error.message, 'error');
    }
  };

  function fileName(envelope, extension) {
    var name = String(envelope.project && envelope.project.name || 'project-data').replace(/[\\/:*?"<>|]/g, '-');
    return name + '-项目数据-' + new Date().toISOString().slice(0, 10) + '.' + extension;
  }

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  window.importProjectDataFile = async function (event, projectId) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    try {
      window.showToast('正在解析 ' + file.name, 'info');
      var records;
      if (/\.json$/i.test(file.name)) {
        var parsed = JSON.parse(await file.text());
        records = Array.isArray(parsed) ? parsed : parsed.records;
        if (!Array.isArray(records)) throw new Error('JSON 中未找到 records 数据');
        records = retargetRecords(records, projectId);
      } else {
        records = await convertSqliteFile(file, projectId);
      }
      if (!records.length) throw new Error('文件中没有可导入的数据');
      var result = await api('/api/project-data/import', {
        method: 'POST',
        body: JSON.stringify({ projectId: String(projectId), mode: 'merge', records: records })
      });
      window.showToast('已导入 ' + result.imported + ' 条数据', 'success');
      await window.loadProjectDataIndex(projectId);
    } catch (error) {
      window.showToast('导入失败：' + error.message, 'error');
    } finally {
      event.target.value = '';
    }
  };

  window.importCityHealthStandardLibrary = async function (projectId) {
    try {
      window.showToast('正在载入城市体检标准库', 'info');
      var envelope = window.CITY_HEALTH_STANDARD_LIBRARY;
      if (!envelope || !Array.isArray(envelope.records)) throw new Error('标准库文件读取失败');
      var records = retargetRecords(envelope.records || [], projectId);
      var result = await api('/api/project-data/import', {
        method: 'POST',
        body: JSON.stringify({ projectId: String(projectId), mode: 'merge', records: records })
      });
      window.showToast('已载入 ' + result.imported + ' 条标准库数据', 'success');
      await window.loadProjectDataIndex(projectId);
    } catch (error) {
      window.showToast('标准库载入失败：' + error.message, 'error');
    }
  };

  function retargetRecords(records, projectId) {
    var idMap = {};
    var normalized = records.map(function (item, index) {
      var sourceKey = (item.sourceTable || '') + ':' + (item.sourceId || item.code || item.id || index);
      var nextId = String(item.projectId) === String(projectId) && item.id ? item.id : dataId(projectId, item.dataType || 'other', sourceKey);
      if (item.id) idMap[item.id] = nextId;
      return Object.assign({}, item, { id: nextId, projectId: String(projectId), source: item.source || 'portable-import' });
    });
    normalized = normalized.map(function (item) {
      item.references = item.references || [];
      item.references = (item.references || []).map(function (ref) {
        return Object.assign({}, ref, { targetId: idMap[ref.targetId] || ref.targetId });
      });
      return item;
    });
    linkImportedRecords(normalized);
    return normalized;
  }

  async function loadSqlJs() {
    function initialize() {
      return window.initSqlJs({ locateFile: function (file) { return 'assets/vendor/sqljs/' + file; } })
        .catch(function () {
          return window.initSqlJs({ locateFile: function (file) { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/' + file; } });
        });
    }
    if (window.initSqlJs) return initialize();
    if (sqlJsPromise) return sqlJsPromise;
    sqlJsPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'assets/vendor/sqljs/sql-wasm.js';
      script.onload = function () {
        initialize().then(resolve, reject);
      };
      script.onerror = function () { reject(new Error('SQLite 解析组件加载失败，请检查网络')); };
      document.head.appendChild(script);
    });
    return sqlJsPromise;
  }

  async function convertSqliteFile(file, projectId) {
    var SQL = await loadSqlJs();
    var database = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
    var tableRows = database.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    var available = tableRows.length ? tableRows[0].values.map(function (row) { return row[0]; }) : [];
    var records = [];
    sqliteTables.filter(function (table) { return available.indexOf(table) >= 0; }).forEach(function (table) {
      var result = database.exec('SELECT * FROM "' + table.replace(/"/g, '""') + '"');
      if (!result.length) return;
      var columns = result[0].columns;
      result[0].values.forEach(function (values, index) {
        var payload = {};
        columns.forEach(function (column, columnIndex) { payload[column] = values[columnIndex]; });
        records.push(sqliteRowToRecord(table, payload, index, projectId));
      });
    });
    database.close();
    linkImportedRecords(records);
    return records;
  }

  function firstValue(payload, names) {
    for (var i = 0; i < names.length; i++) {
      if (payload[names[i]] !== undefined && payload[names[i]] !== null && payload[names[i]] !== '') return payload[names[i]];
    }
    return '';
  }

  function sqliteRowToRecord(table, payload, index, projectId) {
    var type = sqliteTypeMap[table] || 'other';
    var sourceId = String(firstValue(payload, ['编码', '编号', '项目编号', '照片编号', '批次编号', '报告编号', 'id']) || (table + '-' + index));
    var code = String(firstValue(payload, ['编码', '编号', '问题编码', '指标编码', '项目编号']) || '');
    var title = String(firstValue(payload, ['名称', '项目名称', '原始叫法', '标题', '文件名', '编号', '编码']) || (typeLabels[type] + ' ' + (index + 1)));
    var tags = ['SQLite导入', typeLabels[type], table];
    ['维度', '大类编码', '问题编码', '指标编码', '复核状态', '归类状态', '状态', '严重等级'].forEach(function (key) {
      if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') tags.push(key + ':' + payload[key]);
    });
    return {
      id: dataId(projectId, type, table + ':' + sourceId),
      projectId: String(projectId),
      dataType: type,
      sourceTable: table,
      sourceId: sourceId,
      code: code,
      title: title,
      status: String(firstValue(payload, ['复核状态', '归类状态', '状态']) || 'active'),
      tags: Array.from(new Set(tags)),
      references: [],
      source: 'colleague-sqlite',
      schemaVersion: '2.0.0',
      payload: payload
    };
  }

  function linkImportedRecords(records) {
    var lookup = {};
    records.forEach(function (record) {
      [record.sourceId, record.code].forEach(function (key) {
        if (key && !lookup[String(key)]) lookup[String(key)] = record.id;
      });
    });
    records.forEach(function (record) {
      Object.keys(record.payload || {}).forEach(function (key) {
        var value = record.payload[key];
        if (!value || !/(编码|编号|ID|Id|id)$/.test(key)) return;
        var targetId = lookup[String(value)];
        if (targetId && targetId !== record.id && !record.references.some(function (ref) { return ref.targetId === targetId; })) {
          record.references.push({ targetId: targetId, relation: key });
        }
      });
    });
  }

})();
