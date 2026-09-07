export function buildGisLayerLegend(mapView, visibleIssueFeatures, visibleLayers = {}) {
  const issues = Array.isArray(visibleIssueFeatures) ? visibleIssueFeatures : [];
  const pendingIssueCount = issues.filter((feature) =>
    feature.properties?.bindingStatus === 'pending'
  ).length;
  const photos = mapView?.photos?.items || [];
  const manualPhotoCount = photos.filter((feature) => {
    const source = String(feature.properties?.coordinateSource || '').toLowerCase();
    return source.includes('manual') || source.includes('batch');
  }).length;
  const selectedRun = mapView?.spatialAnalyses?.items?.[0];
  const poiItems = selectedRun?.result?.accepted || selectedRun?.result?.items || [];
  const excludedPoiCount = poiItems.filter((item) => item.reviewStatus === 'excluded').length;
  const items = [
    ['boundary', '项目边界', mapView?.boundary ? 1 : 0],
    ['boundaryHistory', '历史边界', mapView?.boundaryHistory?.items?.length || 0],
    ['issues', '正式问题', issues.length - pendingIssueCount],
    ['pendingIssues', '待确认点位', pendingIssueCount],
    ['photos', '现场照片', photos.length - manualPhotoCount],
    ['manualPhotos', '人工补绑照片', manualPhotoCount],
    ['routes', '踏勘路线', mapView?.routes?.items?.length || 0],
    ['stops', '停留节点', mapView?.stops?.items?.length || 0],
    ['poi', 'POI设施', poiItems.length - excludedPoiCount],
    ['excludedPoi', '已排除POI', excludedPoiCount],
    ['analysisRange', '分析范围', selectedRun ? 1 : 0],
    ['distanceLines', '距离连线', selectedRun?.result?.distances?.length || 0]
  ].filter(([layer]) => visibleLayers[layer] !== false);
  return {
    items,
    objectCount: items.reduce((sum, item) => sum + item[2], 0),
    issueCount: issues.length
  };
}

export function applyGisLayerVisibility(controller, visibleLayers = {}) {
  if (!controller) return 0;
  let applied = 0;
  for (const [layer, visible] of Object.entries(visibleLayers)) {
    if (controller.setLayerVisibility(layer, visible)) applied += 1;
  }
  return applied;
}
