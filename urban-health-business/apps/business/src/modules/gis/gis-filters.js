import { hasPointGeometry } from './gis-geometry.js';

export function issueBindingFilterStatus(issue) {
  if (!hasPointGeometry(issue)) return 'unlocated';
  if (issue.spatialBinding?.status === 'pending') return 'pending';
  return 'located';
}

export function filterOfficialIssues(issues, filters = {}) {
  const search = String(filters.search || '').trim().toLowerCase();
  return (Array.isArray(issues) ? issues : []).filter((issue) => {
    if (filters.issueRisk && filters.issueRisk !== 'all' && issue.severity !== filters.issueRisk) {
      return false;
    }
    const issueStatus = String(issue.status || 'active');
    const stale = issueStatus === 'stale' || Boolean(issue.staleReasons?.length);
    if (filters.issueStatus && filters.issueStatus !== 'all' && issueStatus !== filters.issueStatus) {
      return false;
    }
    if (filters.staleStatus === 'stale' && !stale) return false;
    if (filters.staleStatus === 'current' && stale) return false;
    const type = issue.categoryCode || issue.categoryName || '';
    if (filters.issueType && filters.issueType !== 'all' && String(type) !== String(filters.issueType)) {
      return false;
    }
    if (
      filters.bindingStatus
      && filters.bindingStatus !== 'all'
      && issueBindingFilterStatus(issue) !== filters.bindingStatus
    ) return false;
    if (!search) return true;
    return [
      issue.id,
      issue.title,
      issue.categoryCode,
      issue.categoryName,
      issue.communityName,
      issue.buildingName,
      issue.originalPhotoId
    ].some((value) => String(value || '').toLowerCase().includes(search));
  });
}
