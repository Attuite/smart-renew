function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const STATUS_LABELS = Object.freeze({
  queued: '已入队',
  running: '生成中',
  generated: '已生成',
  stale: '历史快照',
  failed: '生成失败'
});

export function shouldPollMapSnapshots(snapshots) {
  return (Array.isArray(snapshots) ? snapshots : [])
    .some((snapshot) => ['queued', 'running'].includes(snapshot.status));
}

export function renderMapSnapshotCards(snapshots, projectName = '') {
  const items = Array.isArray(snapshots) ? snapshots : [];
  if (!items.length) {
    return '<p class="workspace-empty">尚未生成地图快照。报告引用会冻结报告版本中的边界和问题点位。</p>';
  }
  return items.map((snapshot) => {
    const contentUrl = `/api/map-snapshots/${encodeURIComponent(snapshot.id)}/content`;
    const ready = ['generated', 'stale'].includes(snapshot.status);
    const statusLabel = STATUS_LABELS[snapshot.status] || snapshot.status || '未知状态';
    return `<article class="map-snapshot-card status-${escapeHtml(snapshot.status)}">
      <div>
        <strong>${escapeHtml(snapshot.purpose)} · ${escapeHtml(snapshot.mapStyle)}</strong>
        <span>${escapeHtml(statusLabel)} · ${snapshot.generatedAt ? new Date(snapshot.generatedAt).toLocaleString() : '等待后台生成'}</span>
        <small>${snapshot.reportId ? `报告 ${escapeHtml(snapshot.reportId)}` : '当前地图数据'} · SHA256 ${escapeHtml((snapshot.contentHash || '').slice(0, 16))}</small>
      </div>
      ${ready ? `<a href="${contentUrl}" target="_blank" rel="noopener"><img src="${contentUrl}" alt="${escapeHtml(projectName)}地图快照"><span>打开SVG快照${snapshot.status === 'stale' ? '（历史内容）' : ''}</span></a>` : ''}
      ${snapshot.status === 'failed' ? `<button type="button" data-map-snapshot-retry="${escapeHtml(snapshot.id)}">重试生成</button>` : ''}
    </article>`;
  }).join('');
}
