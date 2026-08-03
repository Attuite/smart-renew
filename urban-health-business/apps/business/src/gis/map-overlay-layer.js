export class MapOverlayLayer {
  constructor(options = {}) {
    this.name = String(options.name || 'layer');
    this.map = options.map;
    this.visible = options.visible !== false;
    this.clusterThreshold = Math.max(1, Number(options.clusterThreshold) || Infinity);
    this.createCluster = typeof options.createCluster === 'function'
      ? options.createCluster
      : null;
    this.clusterOptions = options.clusterOptions || {};
    this.overlays = [];
    this.cluster = null;
    this.selectedId = '';
    this.mounted = false;
    this.destroyed = false;
  }

  setData(overlays) {
    if (this.destroyed) return false;
    this.clear();
    this.overlays = (Array.isArray(overlays) ? overlays : []).filter(Boolean);
    if (
      this.createCluster
      && this.overlays.length >= this.clusterThreshold
    ) {
      this.cluster = this.createCluster(
        this.visible ? this.map : null,
        this.overlays,
        this.clusterOptions
      );
      this.mounted = this.visible;
    } else {
      this.mount();
    }
    return true;
  }

  mount() {
    if (this.destroyed || !this.visible || this.mounted || !this.overlays.length) return false;
    if (this.cluster) this.cluster.setMap?.(this.map);
    else this.map?.add?.(this.overlays);
    this.mounted = true;
    return true;
  }

  unmount() {
    if (!this.mounted) return false;
    if (this.cluster) this.cluster.setMap?.(null);
    else if (this.overlays.length) this.map?.remove?.(this.overlays);
    this.mounted = false;
    return true;
  }

  setVisible(visible) {
    if (this.destroyed) return false;
    this.visible = Boolean(visible);
    if (this.visible) this.mount();
    else this.unmount();
    return true;
  }

  setSelected(selectedId) {
    if (this.destroyed) return false;
    this.selectedId = String(selectedId || '');
    return true;
  }

  clear() {
    if (this.destroyed) return false;
    this.unmount();
    this.cluster = null;
    this.overlays = [];
    return true;
  }

  destroy() {
    if (this.destroyed) return;
    this.clear();
    this.destroyed = true;
    this.map = null;
    this.selectedId = '';
  }
}
