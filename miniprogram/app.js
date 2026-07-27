App({
  globalData: {
    collectorId: ''
  },

  onLaunch() {
    let collectorId = wx.getStorageSync('smartRenewCollectorId');
    if (!collectorId) {
      const account = wx.getAccountInfoSync();
      const appId = account?.miniProgram?.appId || 'local';
      collectorId = `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      wx.setStorageSync('smartRenewCollectorId', collectorId);
    }
    this.globalData.collectorId = collectorId;
  }
});
