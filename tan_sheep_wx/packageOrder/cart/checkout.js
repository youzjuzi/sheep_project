const API = require('../../utils/api.js');

Page({
  data: {
    checkoutItems: [],  // 要结算的羊只列表
    totalPrice: '0.00',
    originalTotalPrice: '0.00',
    discountAmount: '0.00',
    payableAmount: '0.00',
    couponTip: '',
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

  async onLoad(options) {
    // 读取购物车传过来的选中商品
    const items = wx.getStorageSync('checkoutItems') || [];
    const totalPrice = this.calculateItemsTotal(items);
    const userCouponId = options.user_coupon_id ? Number(options.user_coupon_id) : null;

    this.setData({
      checkoutItems: items,
      userCouponId,
      originalTotalPrice: totalPrice.toFixed(2),
      payableAmount: totalPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      discountAmount: '0.00',
      couponTip: userCouponId ? '正在计算优惠券抵扣...' : ''
    });

    if (userCouponId) {
      await this.loadCouponPreview(userCouponId, items, totalPrice);
    }

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

  getItemAmount(item) {
    const amount = item && item.total_price !== undefined && item.total_price !== null
      ? parseFloat(item.total_price)
      : (parseFloat(item && item.price) || 0) * (parseInt(item && item.quantity, 10) || 1);
    return Number.isFinite(amount) ? amount : 0;
  },

  calculateItemsTotal(items) {
    return (items || []).reduce((sum, item) => sum + this.getItemAmount(item), 0);
  },

  async loadCouponPreview(userCouponId, items, orderTotal) {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ couponTip: '登录后可校验优惠券抵扣金额' });
      return;
    }

    try {
      const res = await API.getUserCoupons(token);
      if (res.code !== 0 || !Array.isArray(res.data)) {
        this.setData({ couponTip: '优惠券信息加载失败，下单后由系统自动校验' });
        return;
      }

      const coupon = res.data.find(c => String(c.id) === String(userCouponId) && c.status === 'unused');
      if (!coupon) {
        this.setData({ couponTip: '未找到可用优惠券，下单时将不抵扣' });
        return;
      }

      const preview = this.calculateCouponDiscount(coupon, items, orderTotal);
      this.setData({
        discountAmount: preview.discount.toFixed(2),
        payableAmount: preview.payable.toFixed(2),
        totalPrice: preview.payable.toFixed(2),
        couponTip: preview.tip
      });
    } catch (err) {
      this.setData({ couponTip: '优惠券预估失败，下单后由系统自动校验' });
    }
  },

  calculateCouponDiscount(coupon, items, orderTotal) {
    const ownerId = coupon.owner && coupon.owner.id ? Number(coupon.owner.id) : null;
    const eligibleItems = ownerId
      ? (items || []).filter(item => item.sheep && Number(item.sheep.owner_id) === ownerId)
      : (items || []);

    const eligibleAmount = this.calculateItemsTotal(eligibleItems);
    const minPurchase = parseFloat(coupon.min_purchase_amount) || 0;
    if (eligibleAmount <= 0) {
      return { discount: 0, payable: orderTotal, tip: '当前商品不符合该优惠券的使用范围' };
    }
    if (eligibleAmount < minPurchase) {
      return { discount: 0, payable: orderTotal, tip: `未满足优惠门槛（满${minPurchase}元可用）` };
    }

    let discount = 0;
    if (coupon.coupon_type === 'discount' || coupon.coupon_type === 'cash') {
      discount = parseFloat(coupon.discount_amount) || 0;
    } else if (coupon.coupon_type === 'percentage') {
      const rate = parseFloat(coupon.discount_rate);
      if (Number.isFinite(rate) && rate > 0 && rate < 1) {
        discount = eligibleAmount * (1 - rate);
      }
      const maxDiscount = parseFloat(coupon.max_discount_amount);
      if (Number.isFinite(maxDiscount) && maxDiscount > 0) {
        discount = Math.min(discount, maxDiscount);
      }
    }

    discount = Math.max(0, Math.min(discount, eligibleAmount, orderTotal));
    const payable = Math.max(0, orderTotal - discount);
    const tip = discount > 0 ? `预计可优惠 ¥${discount.toFixed(2)}` : '该优惠券本单未产生抵扣';
    return { discount, payable, tip };
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
    const { receiverName, receiverPhone, shippingAddress, payMethod, userCouponId, payableAmount, discountAmount } = this.data;

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

    const payText = parseFloat(payableAmount || 0).toFixed(2);
    const discountText = parseFloat(discountAmount || 0).toFixed(2);
    const hasDiscount = parseFloat(discountText) > 0;

    wx.showModal({
      title: '确认下单',
      content: hasDiscount
        ? `已优惠 ¥${discountText}，应付 ¥${payText}，确认支付吗？`
        : `共 ¥${payText}，使用余额支付，确认吗？`,
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
