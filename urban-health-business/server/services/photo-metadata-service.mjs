function clean(value, maxLength = 2000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function photoError(message, status = 400, code = 'PHOTO_METADATA_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function activeCommunities(project) {
  return (Array.isArray(project?.residentialInventory?.items) ? project.residentialInventory.items : [])
    .filter((item) => item.status !== 'deleted');
}

export async function updatePhotoMetadata(client, repository, projectId, photoId, input, options = {}) {
  const [project, photos, existing] = await Promise.all([
    client.getProject(projectId),
    client.listPhotos({ projectId }),
    repository.get(photoId)
  ]);
  const photo = photos.items.find((item) => String(item.id) === String(photoId));
  if (!photo) throw photoError('照片不属于当前项目或已不存在。', 404, 'PHOTO_NOT_FOUND');
  const currentRevision = Math.max(0, Number(existing?.metadataRevision) || 0);
  if (input?.expectedRevision !== undefined && Number(input.expectedRevision) !== currentRevision) {
    throw photoError('照片治理信息已被其他操作修改，请刷新后重试。', 409, 'PHOTO_METADATA_REVISION_CONFLICT');
  }
  const communities = activeCommunities(project);
  const communityId = clean(input?.communityId ?? existing?.communityId ?? photo.communityId, 120);
  const community = communities.find((item) => String(item.id || item.sourceId) === communityId);
  if (!community) throw photoError('所选小区不存在或已停用。', 400, 'COMMUNITY_NOT_FOUND');
  const buildingId = clean(input?.buildingId ?? existing?.buildingId ?? photo.buildingId, 120);
  const buildings = (Array.isArray(community.buildings) ? community.buildings : [])
    .filter((item) => item.status !== 'deleted');
  const building = buildingId ? buildings.find((item) => String(item.id) === buildingId) : null;
  if (buildingId && !building) throw photoError('所选楼栋不属于该小区或已停用。', 400, 'BUILDING_NOT_FOUND');
  const status = clean(input?.status ?? existing?.status ?? 'active', 20);
  if (!['active', 'inactive'].includes(status)) {
    throw photoError('照片状态必须为active或inactive。', 400, 'INVALID_PHOTO_STATUS');
  }
  const hasLongitude = input?.longitude !== undefined && input?.longitude !== '';
  const hasLatitude = input?.latitude !== undefined && input?.latitude !== '';
  if (hasLongitude !== hasLatitude) throw photoError('经纬度必须同时填写或同时留空。', 400, 'PHOTO_COORDINATES_INCOMPLETE');
  let coordinates = existing?.coordinates || null;
  if (hasLongitude && hasLatitude) {
    const longitude = Number(input.longitude);
    const latitude = Number(input.latitude);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw photoError('照片经度无效。', 400, 'INVALID_LONGITUDE');
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw photoError('照片纬度无效。', 400, 'INVALID_LATITUDE');
    }
    coordinates = [longitude, latitude];
  } else if (input?.clearCoordinates === true) {
    coordinates = null;
  }
  const updatedBy = clean(input?.updatedBy, 120);
  if (!updatedBy) throw photoError('请填写照片治理人员。', 400, 'PHOTO_METADATA_EDITOR_REQUIRED');
  const capturedAtWasProvided = input?.capturedAt !== undefined;
  const coordinateSource = coordinates
    ? clean(
        input?.coordinateSource
        || (hasLongitude && hasLatitude ? 'manual' : existing?.coordinateSource)
        || 'manual',
        40
      )
    : null;
  const capturedAtSource = clean(
    input?.capturedAtSource
    || (capturedAtWasProvided ? 'manual' : existing?.capturedAtSource)
    || 'legacy',
    40
  );
  const now = options.now || new Date().toISOString();
  return repository.put({
    photoId: String(photo.id),
    projectId: String(project.id),
    displayName: clean(input?.displayName ?? existing?.displayName ?? photo.name, 240),
    communityId,
    communityName: community.name || '',
    buildingId: buildingId || null,
    buildingName: building?.name || '',
    capturedAt: clean(input?.capturedAt ?? existing?.capturedAt ?? photo.capturedAt, 80) || null,
    capturedAtSource,
    coordinates,
    coordinateCrs: coordinates ? clean(input?.coordinateCrs ?? existing?.coordinateCrs, 20) || 'WGS84' : null,
    coordinateSource,
    notes: clean(input?.notes ?? existing?.notes, 2000),
    status,
    metadataRevision: currentRevision + 1,
    updatedBy,
    updatedAt: now,
    schemaVersion: '1.0.0'
  });
}

export function mergePhotoMetadata(photos, metadata, includeInactive = false) {
  const overlays = new Map(metadata.map((item) => [String(item.photoId), item]));
  return photos
    .map((photo) => {
      const overlay = overlays.get(String(photo.id));
      return overlay ? {
        ...photo,
        name: overlay.displayName || photo.name,
        communityId: overlay.communityId,
        communityName: overlay.communityName,
        buildingId: overlay.buildingId,
        buildingName: overlay.buildingName,
        capturedAt: overlay.capturedAt,
        capturedAtSource: overlay.capturedAtSource,
        coordinates: overlay.coordinates,
        coordinateCrs: overlay.coordinateCrs,
        coordinateSource: overlay.coordinateSource,
        governanceNotes: overlay.notes,
        governanceStatus: overlay.status,
        metadataRevision: overlay.metadataRevision
      } : {
        ...photo,
        governanceStatus: 'active',
        metadataRevision: 0
      };
    })
    .filter((photo) => includeInactive || photo.governanceStatus !== 'inactive');
}
