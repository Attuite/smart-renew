export function findSelectedOrFirst(items, selectedId) {
  const source = Array.isArray(items) ? items : [];
  const selected = source.find((item) => String(item?.id) === String(selectedId || ''))
    || source[0]
    || null;
  return {
    selected,
    selectedId: selected ? String(selected.id) : ''
  };
}
