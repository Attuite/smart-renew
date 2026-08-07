import { updatePhotoMetadata } from './photo-metadata-service.mjs';

function batchError(message, status = 400, code = 'PHOTO_BATCH_VALIDATION_FAILED') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export async function batchUpdatePhotoMetadata(client, repository, projectId, input) {
  const updatedBy = String(input?.updatedBy || '').trim().slice(0, 120);
  if (!updatedBy) {
    throw batchError('请填写批量治理人员。', 400, 'PHOTO_BATCH_EDITOR_REQUIRED');
  }
  const items = Array.isArray(input?.items) ? input.items : [];
  if (!items.length || items.length > 200) {
    throw batchError('批量治理每次必须包含1到200张照片。', 400, 'PHOTO_BATCH_SIZE_INVALID');
  }
  const ids = items.map((item) => String(item?.photoId || '').trim());
  if (ids.some((id) => !id)) {
    throw batchError('批量清单存在空照片编号。', 400, 'PHOTO_BATCH_PHOTO_ID_REQUIRED');
  }
  if (new Set(ids).size !== ids.length) {
    throw batchError('同一批次不能重复包含同一照片。', 400, 'PHOTO_BATCH_DUPLICATE_PHOTO');
  }
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      const updated = await updatePhotoMetadata(client, repository, projectId, ids[index], {
        longitude: item.longitude,
        latitude: item.latitude,
        coordinateCrs: item.coordinateCrs || 'WGS84',
        coordinateSource: 'batch-manual',
        ...(item.capturedAt ? {
          capturedAt: item.capturedAt,
          capturedAtSource: 'batch-manual'
        } : {}),
        updatedBy,
        expectedRevision: item.expectedRevision
      });
      results.push({
        photoId: ids[index],
        status: 'updated',
        metadataRevision: updated.metadataRevision
      });
    } catch (error) {
      results.push({
        photoId: ids[index],
        status: 'failed',
        error: {
          code: error.code || 'PHOTO_BATCH_ITEM_FAILED',
          message: error.message
        }
      });
    }
  }
  const succeeded = results.filter((item) => item.status === 'updated').length;
  return {
    projectId: String(projectId),
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    updatedBy,
    results
  };
}
