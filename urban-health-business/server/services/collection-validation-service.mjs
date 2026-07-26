import { mergePhotoMetadata } from './photo-metadata-service.mjs';

const ACTIVE_UPLOAD_STATUSES = new Set(['ready', 'uploading', 'queued', 'processing']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function activeCommunities(project) {
  return asArray(project?.residentialInventory?.items).filter((item) => item?.status !== 'deleted');
}

function check(code, label, required, passed, message, details = {}) {
  return {
    code,
    label,
    required,
    status: passed ? 'passed' : required ? 'failed' : 'warning',
    message,
    details
  };
}

export function assessCollection(input = {}, options = {}) {
  const project = input.project || null;
  const photos = asArray(input.photos).filter((item) => item?.governanceStatus !== 'inactive');
  const uploadSessions = asArray(input.uploadSessions);
  const assets = asArray(input.assets);
  const fieldRecords = asArray(input.fieldRecords);
  const communities = activeCommunities(project);
  const communityMap = new Map(
    communities.map((community) => [String(community.id || community.sourceId || ''), community])
  );
  const activeUploads = uploadSessions.filter((item) => ACTIVE_UPLOAD_STATUSES.has(String(item?.status || '').toLowerCase()));
  const failedUploads = uploadSessions.filter((item) => String(item?.status || '').toLowerCase() === 'failed');
  const invalidBindings = photos.filter((photo) => {
    const community = communityMap.get(String(photo.communityId || ''));
    if (!community) return true;
    if (!photo.buildingId) return false;
    return !asArray(community.buildings).some(
      (building) => building?.status !== 'deleted' && String(building.id) === String(photo.buildingId)
    );
  });
  const locatedPhotos = photos.filter(
    (photo) => Array.isArray(photo.coordinates)
      && photo.coordinates.length >= 2
      && Number.isFinite(Number(photo.coordinates[0]))
      && Number.isFinite(Number(photo.coordinates[1]))
  );
  const activeBuildings = communities.flatMap((community) =>
    asArray(community.buildings).filter((building) => building?.status !== 'deleted')
  );
  const boundary = asArray(project?.scopeBoundary);

  const checks = [
    check(
      'PROJECT_PROFILE_READY',
      '项目档案',
      true,
      Boolean(String(project?.name || '').trim()),
      project ? '项目名称已登记。' : '尚未选择或建立项目。'
    ),
    check(
      'ACTIVE_COMMUNITY_REQUIRED',
      '有效小区',
      true,
      communities.length > 0,
      communities.length ? `已有 ${communities.length} 个使用中小区。` : '至少需要建立一个使用中小区。',
      { count: communities.length }
    ),
    check(
      'PROJECT_BOUNDARY_REQUIRED',
      '项目边界',
      true,
      boundary.length >= 3,
      boundary.length >= 3 ? `项目边界已登记 ${boundary.length} 个点。` : '尚未登记可用于空间分析的项目边界。',
      { pointCount: boundary.length }
    ),
    check(
      'ACTIVE_PHOTO_REQUIRED',
      '现场照片',
      true,
      photos.length > 0,
      photos.length ? `已有 ${photos.length} 张使用中照片。` : '至少需要一张使用中的真实现场照片。',
      { count: photos.length }
    ),
    check(
      'PHOTO_BINDINGS_VALID',
      '照片空间归属',
      true,
      photos.length > 0 && invalidBindings.length === 0,
      photos.length && invalidBindings.length === 0
        ? '所有使用中照片均绑定到有效小区/楼栋。'
        : `${invalidBindings.length || photos.length} 张照片缺少有效空间归属。`,
      { invalidPhotoIds: invalidBindings.map((item) => String(item.id)) }
    ),
    check(
      'UPLOAD_QUEUE_SETTLED',
      '上传队列',
      true,
      activeUploads.length === 0,
      activeUploads.length ? `仍有 ${activeUploads.length} 个上传会话未结束。` : '当前没有未结束的上传会话。',
      { activeUploadIds: activeUploads.map((item) => String(item.id)) }
    ),
    check(
      'PHOTO_COORDINATES_RECOMMENDED',
      '照片位置',
      false,
      photos.length > 0 && locatedPhotos.length === photos.length,
      photos.length && locatedPhotos.length === photos.length
        ? '所有使用中照片均有真实坐标。'
        : `${Math.max(0, photos.length - locatedPhotos.length)} 张使用中照片尚无坐标。`,
      { locatedCount: locatedPhotos.length, photoCount: photos.length }
    ),
    check(
      'BUILDING_INVENTORY_RECOMMENDED',
      '楼栋台账',
      false,
      activeBuildings.length > 0,
      activeBuildings.length ? `已有 ${activeBuildings.length} 栋使用中楼栋。` : '尚未建立楼栋台账。',
      { count: activeBuildings.length }
    ),
    check(
      'SUPPORTING_RECORDS_RECOMMENDED',
      '辅助资料',
      false,
      assets.length + fieldRecords.length > 0,
      assets.length + fieldRecords.length
        ? `已有 ${assets.length + fieldRecords.length} 条外业或资料记录。`
        : '尚无外业记录或通用资料资产。',
      { assetCount: assets.length, fieldRecordCount: fieldRecords.length }
    ),
    check(
      'FAILED_UPLOADS_REVIEW_RECOMMENDED',
      '失败上传治理',
      false,
      failedUploads.length === 0,
      failedUploads.length ? `有 ${failedUploads.length} 个失败上传会话待复核或取消。` : '没有失败上传会话。',
      { failedUploadIds: failedUploads.map((item) => String(item.id)) }
    )
  ];
  const requiredChecks = checks.filter((item) => item.required);
  const passedRequired = requiredChecks.filter((item) => item.status === 'passed').length;
  const warnings = checks.filter((item) => !item.required && item.status === 'warning').length;
  const computedAt = options.computedAt || new Date().toISOString();

  return {
    projectId: String(project?.id || input.projectId || ''),
    status: passedRequired === requiredChecks.length ? 'complete' : 'incomplete',
    completenessPercent: requiredChecks.length
      ? Math.round((passedRequired / requiredChecks.length) * 100)
      : 0,
    passedRequired,
    requiredCount: requiredChecks.length,
    warningCount: warnings,
    checks,
    sourceSnapshot: {
      projectRevision: Number(project?.revision || 0),
      activePhotoIds: photos.map((item) => String(item.id)),
      uploadSessionIds: uploadSessions.map((item) => String(item.id)),
      assetCount: assets.length,
      fieldRecordCount: fieldRecords.length
    },
    computedAt
  };
}

export async function getCollectionValidation(
  client,
  projectId,
  uploadSessionRepository = null,
  photoMetadataRepository = null,
  sourceAssetRepository = null,
  options = {}
) {
  const [project, collections, uploadSessions, photoMetadata, businessAssets] = await Promise.all([
    client.getProject(projectId),
    client.projectCollections(projectId),
    uploadSessionRepository ? uploadSessionRepository.list(projectId) : [],
    photoMetadataRepository ? photoMetadataRepository.list(projectId) : [],
    sourceAssetRepository ? sourceAssetRepository.list(projectId) : []
  ]);
  return assessCollection({
    projectId,
    project,
    photos: mergePhotoMetadata(collections.photos.items, photoMetadata),
    uploadSessions,
    assets: [
      ...collections.projectData.items.filter((item) => item?.dataType === 'sourceAsset' || item?.type === 'sourceAsset'),
      ...businessAssets.filter((item) => item.status === 'active' && item.uploadStatus === 'completed')
    ],
    fieldRecords: collections.fieldRecords.items
  }, options);
}
