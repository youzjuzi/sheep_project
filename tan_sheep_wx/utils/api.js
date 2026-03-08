/**
 * API请求工具
 * 直接调用后端API
 */

// 后端API地址配置
const { getApiBaseUrl } = require('./api-config.js')
const API_BASE_URL = getApiBaseUrl()

/**
 * 发起请求
 */
function request(url, method = 'GET', data = {}) {
  const fullUrl = API_BASE_URL + url
  console.log(`[API请求] ${method} ${fullUrl}`, data)

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json'
      },
      success: function (res) {
        console.log(`[API响应] ${fullUrl}`, res)
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          // 尝试从响应中提取错误信息
          let errorMsg = `请求失败: HTTP ${res.statusCode}`
          if (res.data && res.data.msg) {
            errorMsg = res.data.msg
          } else if (res.data && typeof res.data === 'string') {
            errorMsg = res.data
          }
          const error = new Error(errorMsg)
          error.statusCode = res.statusCode
          error.response = res.data
          console.error('[API错误]', error.message, res)
          reject(error)
        }
      },
      fail: function (err) {
        console.error('[API请求失败]', fullUrl, err)
        const error = new Error(`网络请求失败: ${err.errMsg || '未知错误'}`)
        reject(error)
      }
    })
  })
}

/**
 * 微信登录（仅使用 code，不获取手机号）
 * @param {string} code 微信登录code
 */
function login(code) {
  return request('/api/auth/login', 'POST', { code })
}

/**
 * 手机号登录（微信小程序一键登录）
 * @param {string} code 微信登录code（用于换取openid）
 * @param {string} phoneCode 手机号授权code（用于解密手机号）
 */
function loginWithPhone(data) {
  return request('/api/auth/login_by_phone', 'POST', {
    code: data.code,
    phoneCode: data.phoneCode
  })
}

/**
 * 账号密码登录
 * @param {string} username 用户名
 * @param {string} password 密码
 */
function loginWithPassword(username, password) {
  return request('/api/auth/login_password', 'POST', { username: username, password: password })
}

/**
 * 用户注册
 * @param {string} username 用户名
 * @param {string} password 密码
 * @param {string} mobile 手机号（可选）
 * @param {string} nickname 昵称（可选）
 */
function register(username, password, mobile, nickname) {
  var data = {
    username: username,
    password: password
  };
  if (mobile) {
    data.mobile = mobile;
  }
  if (nickname) {
    data.nickname = nickname;
  }
  return request('/api/auth/register', 'POST', data)
}

/**
 * 验证token
 * @param {string} token 
 */
function checkToken(token) {
  return request('/check_token', 'POST', { token })
}

/**
 * 获取用户基础信息
 * @param {string} token 
 */
function getUserInfo(token) {
  return request('/api/user/info?token=' + token, 'GET')
}

/**
 * 余额充值
 * @param {string} token
 * @param {number} amount 充值金额
 */
function recharge(token, amount) {
  return request('/api/user/recharge', 'POST', { token, amount })
}

/**
 * 获取详细用户资料（含简介等）
 * @param {string} token 
 */
function getUserProfile(token) {
  return request('/api/user/profile?token=' + token, 'GET')
}

/**
 * 更新用户详细资料
 * @param {string} token 
 * @param {object} data (nickname, gender, mobile, description, birthday)
 */
function updateUserInfo(token, data) {
  // 保持向前兼容旧只传 nickname 的情况
  let postData = { token: token }
  if (typeof data === 'string') {
    postData.nickname = data
  } else {
    postData = { ...postData, ...data }
  }
  return request('/api/user/profile_update', 'POST', postData)
}

/**
 * 申请成为养殖户
 * @param {string} token 
 * @param {string} mobile 
 */
function applyBreeder(token, mobile) {
  return request('/api/user/apply_breeder', 'POST', {
    token: token,
    mobile: mobile
  })
}

/**
 * 获取购物车列表
 * @param {string} token 
 */
function getCart(token) {
  // 通过请求头传递token（更安全）
  const fullUrl = API_BASE_URL + '/api/cart'
  console.log(`[API请求] GET ${fullUrl}`, { token: token ? '***' : 'missing' })

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method: 'GET',
      data: { token: token },
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      success: function (res) {
        console.log(`[API响应] ${fullUrl}`, res)
        if (res.statusCode === 200) {
          resolve(res.data)
        } else {
          const error = new Error(`请求失败: HTTP ${res.statusCode}`)
          console.error('[API错误]', error.message, res)
          reject(error)
        }
      },
      fail: function (err) {
        console.error('[API请求失败]', fullUrl, err)
        const error = new Error(`网络请求失败: ${err.errMsg || '未知错误'}`)
        reject(error)
      }
    })
  })
}

/**
 * 添加商品到购物车
 * @param {string} token 
 * @param {number} sheepId 羊只ID
 * @param {number} quantity 数量（可选，默认1）
 * @param {number} price 单价（可选，会根据体重自动计算）
 */
function addToCart(token, sheepId, quantity = 1, price = 0) {
  return request('/api/cart', 'POST', {
    token: token,
    sheep_id: sheepId,
    quantity: quantity,
    price: price
  })
}

/**
 * 删除购物车商品
 * @param {string} token 
 * @param {number} cartItemId 购物车商品ID
 */
function removeFromCart(token, cartItemId) {
  return request(`/api/cart/${cartItemId}?token=${encodeURIComponent(token)}`, 'DELETE')
}

/**
 * 更新购物车商品数量
 * @param {string} token 
 * @param {number} cartItemId 购物车商品ID
 * @param {number} quantity 新数量
 */
function updateCartItem(token, cartItemId, quantity) {
  return request(`/api/cart/${cartItemId}?token=${encodeURIComponent(token)}`, 'PUT', {
    token: token,
    quantity: quantity
  })
}

/**
 * 获取头像上传预签名 URL
 * @param {string} token 
 * @param {string} fileExt 文件扩展名，如 .jpg
 * @param {string} contentType MIME 类型
 */
function getAvatarUploadUrl(token, fileExt, contentType) {
  return request('/api/user/avatar/upload-url', 'POST', {
    token: token,
    file_ext: fileExt || '.jpg',
    content_type: contentType || 'image/jpeg'
  })
}

/**
 * 确认头像上传完成
 * @param {string} token 
 * @param {string} objectKey R2 中的对象 key
 */
function confirmAvatarUpload(token, objectKey) {
  return request('/api/user/avatar/confirm', 'POST', {
    token: token,
    object_key: objectKey
  })
}

/**
 * 购物车结算（生成订单）
 * @param {string} token 
 * @param {string} paymentMethod 支付方式（'balance' 或 'wechat'）
 * @param {object} addressInfo { receiver_name, receiver_phone, shipping_address }
 * @param {number} userCouponId 用户优惠券ID（可选）
 */
function checkout(token, paymentMethod = 'balance', addressInfo = {}, userCouponId = null) {
  const data = {
    token: token,
    payment_method: paymentMethod,
    ...addressInfo
  };
  if (userCouponId) {
    data.user_coupon_id = userCouponId;
  }
  return request('/api/cart/checkout', 'POST', data)
}

/**
 * 获取用户已购买的羊（结算后的）
 * @param {string} token 
 */
function getMySheep(token) {
  return request('/api/my/sheep?token=' + token, 'GET')
}

/**
 * 获取用户订单历史
 * @param {string} token 
 */
function getOrderHistory(token) {
  return request('/api/orders?token=' + token, 'GET')
}

/**
 * 获取优惠活动列表
 */
function getPromotionActivities(status) {
  var url = '/api/promotions/activities'
  if (status) {
    url += '?status=' + status
  }
  return request(url, 'GET')
}

/**
 * 获取可领取的优惠券列表
 */
function getAvailableCoupons() {
  return request('/api/promotions/coupons', 'GET')
}

/**
 * 获取用户已领取的优惠券
 */
function getUserCoupons(token) {
  return request('/api/promotions/coupons?token=' + token, 'GET')
}

/**
 * 领取优惠券
 */
function claimCoupon(token, couponId) {
  return request('/api/promotions/coupons/claim', 'POST', {
    token: token,
    coupon_id: couponId
  })
}

module.exports = {
  request,
  login,
  loginWithPhone,
  loginWithPassword,
  register,
  checkToken,
  getUserInfo,
  recharge,
  updateUserInfo,
  getUserProfile,
  applyBreeder,
  getCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  getAvatarUploadUrl,
  confirmAvatarUpload,
  checkout,
  getMySheep,
  getOrderHistory,
  getPromotionActivities,
  getAvailableCoupons,
  getUserCoupons,
  claimCoupon,
  API_BASE_URL
}
