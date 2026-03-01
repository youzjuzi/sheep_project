/**
 * API配置
 * 根据环境自动选择API地址
 */

// 开发/生产统一走本地环回地址（按需在真机调试配合内网穿透/反代）
const API_CONFIG = {
  development: 'http://127.0.0.1:8000',
  production: 'http://127.0.0.1:8000',
  current: 'development'
}

// 获取当前API地址
function getApiBaseUrl() {
  return API_CONFIG[API_CONFIG.current] || API_CONFIG.development
}

module.exports = {
  API_CONFIG,
  getApiBaseUrl
}

