const config = require('../config');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.apiBaseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 20000,
      header: {
        'content-type': 'application/json',
        ...(options.header || {})
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data || {});
          return;
        }
        reject(new Error(response.data?.message || `请求失败（${response.statusCode}）`));
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络连接失败'));
      }
    });
  });
}

module.exports = {
  get(path) {
    return request(path);
  },
  post(path, data, timeout) {
    return request(path, { method: 'POST', data, timeout });
  }
};
