const API = require('../../utils/api.js');

Page({
  data: {
    checkoutItems: [],  // 要结算的羊只列表
    totalPrice: 0,
    userCouponId: null, // 优惠券ID

    // 收货信息
    receiverName: '',
    receiverPhone: '',
    shippingAddress: '',

    // 支付
    balance: '0.00',
    payMethod: 'balance',
    loading: false,
  },

  onLoad(options) {
    // 获取传递的优惠券ID
    if (options.user_coupon_id) {
        this.setData({ userCouponId: options.user_coupon_id });
        // 注意：前端目前无法直接计算优惠后的价格，因为逻辑在后端。
        // 这里可以调用后端预结算接口，但后端暂时没有。
        // 所以我们先按原价显示，或者提示用户“将在下单时自动抵扣”。
        wx.showToast({
            title: '已选择优惠券，下单自动抵扣',
            icon: 'none',
            duration: 2500
        });
    }

    // 读取购物车传过来的选中商品
    const items = wx.getStorageSync('checkoutItems') || [];
    const totalPrice = items.reduce((sum, item) => sum + (item.total_price || item.price || 0), 0);
    this.setData({ checkoutItems: items, totalPrice: totalPrice.toFixed(2) });

    // 读取上次填写的收货信息
    const lastAddress = wx.getStorageSync('lastShippingInfo') || {};
    this.setData({
      receiverName: lastAddress.receiverName || '',
      receiverPhone: lastAddress.receiverPhone || '',
      shippingAddress: lastAddress.shippingAddress || '',
    });

    // 拉取最新余额
    const token = wx.getStorageSync('token');
    if (token) {
      API.getUserInfo(token).then(res => {
        if (res.code === 0) {
          this.setData({ balance: parseFloat(res.data.balance).toFixed(2) });
        }
      }).catch(() => {});
    }
  },

  // 使用微信选择地址
  chooseAddress() {
    wx.chooseAddress({
      success: (res) => {
        const addr = `${res.provinceName}${res.cityName}${res.countyName}${res.detailInfo}`;
        this.setData({
          receiverName: res.userName,
          receiverPhone: res.telNumber,
          shippingAddress: addr,
        });
      },
      fail: () => {}
    });
  },

  onNameInput(e) { this.setData({ receiverName: e.detail.value }); },
  onPhoneInput(e) { this.setData({ receiverPhone: e.detail.value }); },
  onAddressInput(e) { this.setData({ shippingAddress: e.detail.value }); },

  // 提交订单
  async submitOrder() {
    const { receiverName, receiverPhone, shippingAddress, totalPrice, payMethod, userCouponId } = this.data;

    if (!receiverName.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' }); return;
    }
    if (!receiverPhone.trim() || receiverPhone.length < 11) {
      wx.showToast({ title: '请填写正确的手机号', icon: 'none' }); return;
    }
    if (!shippingAddress.trim()) {
      wx.showToast({ title: '请填写收货地址', icon: 'none' }); return;
    }

    const token = wx.getStorageSync('token');
    if (!token) { wx.showToast({ title: '请先登录', icon: 'none' }); return; }

    wx.showModal({
      title: '确认下单',
      content: userCouponId ? `订单将自动抵扣优惠券，确认支付吗？` : `共 ¥${totalPrice}，使用余额支付，确认吗？`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return;

        this.setData({ loading: true });
        try {
          const res = await API.checkout(token, payMethod, {
            receiver_name: receiverName.trim(),
            receiver_phone: receiverPhone.trim(),
            shipping_address: shippingAddress.trim(),
          }, userCouponId); // 传递优惠券ID

          if (res.code === 0) {
            // 保存收货信息方便下次使用
            wx.setStorageSync('lastShippingInfo', {
              receiverName, receiverPhone, shippingAddress
            });
            // 更新余额缓存
            if (res.data && res.data.user_balance !== undefined) {
              wx.setStorageSync('balance', parseFloat(res.data.user_balance).toFixed(2));
            }
            wx.removeStorageSync('checkoutItems');
            wx.showToast({ title: '下单成功！', icon: 'success', duration: 1800 });
            setTimeout(() => {
              wx.navigateBack();
            }, 1800);
          } else {
            wx.showModal({ title: '下单失败', content: res.msg || '请稍后重试', showCancel: false });
          }
        } catch (err) {
          wx.showModal({ title: '网络错误', content: err.message || '请稍后重试', showCancel: false });
        } finally {
          this.setData({ loading: false });
        }
      }
    });
  },
});