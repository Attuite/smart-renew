import { sourceOfTruthFor } from './source-of-truth.mjs';

function keyed(items) {
  return (Array.isArray(items) ? items : []).filter((item) => item?.id !== undefined && item?.id !== null);
}

export function mergePrimaryReadModel(entity, input = {}) {
  const rule = sourceOfTruthFor(entity);
  if (!rule) {
    const error = new Error(`未登记主数据源：${entity}`);
    error.status = 500;
    error.code = 'SOURCE_OF_TRUTH_NOT_REGISTERED';
    throw error;
  }

  const businessItems = keyed(input.businessItems);
  const legacyItems = keyed(input.legacyItems);
  const sources = rule.primary === 'business'
    ? [legacyItems, businessItems]
    : [businessItems, legacyItems];
  const merged = new Map();
  for (const items of sources) {
    for (const item of items) merged.set(String(item.id), item);
  }
  return [...merged.values()];
}
