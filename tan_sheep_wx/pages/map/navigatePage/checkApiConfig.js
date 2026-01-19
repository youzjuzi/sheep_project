/**
 * 百度地图API配置检查工具
 * 用于检查API密钥是否有效
 */

// 当前使用的API密钥
const BAIDU_MAP_AK = 'vVURIWCDRuHFMtFGxttSepBIgvm4OWGn';

/**
 * 检查API密钥是否有效
 * @param {string} ak - API密钥
 * @returns {Promise<{valid: boolean, message: string, status?: number}>}
 */
function checkApiKey(ak = BAIDU_MAP_AK) {
  return new Promise((resolve) => {
    // 使用一个简单的API调用来测试
    wx.request({
      url: 'https://api.map.baidu.com/place/v2/search',
      data: {
        query: '测试',
        region: '北京',
        output: 'json',
        ak: ak,
        page_size: 1
      },
      success: (res) => {
        if (res.data) {
          if (res.data.status === 0) {
            resolve({
              valid: true,
              message: 'API密钥有效'
            });
          } else if (res.data.status === 240) {
            resolve({
              valid: false,
              message: 'APP 服务被禁用',
              status: 240,
              reason: 'API密钥可能无效、服务未启用或配额已用完'
            });
          } else if (res.data.status === 200 || res.data.status === 1) {
            resolve({
              valid: false,
              message: res.data.message || 'API服务不可用',
              status: res.data.status,
              reason: '可能是配额用完或服务被禁用'
            });
          } else {
            resolve({
              valid: false,
              message: res.data.message || 'API调用失败',
              status: res.data.status
            });
          }
        } else {
          resolve({
            valid: false,
            message: 'API返回数据异常'
          });
        }
      },
      fail: (err) => {
        resolve({
          valid: false,
          message: '网络请求失败：' + (err.errMsg || '未知错误')
        });
      }
    });
  });
}

/**
 * 获取API状态信息
 */
async function getApiStatus() {
  const result = await checkApiKey();
  return result;
}

module.exports = {
  checkApiKey,
  getApiStatus,
  BAIDU_MAP_AK
};

