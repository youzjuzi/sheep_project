const API = require('../../utils/api.js');

Page({
  data: {
    checkoutItems: [],  // 要结算的羊只列表
    totalPrice: '0.00',
    originalTotalPrice: '0.00',
    discountAmount: '0.00',
    payableAmount: '0.00',
    couponTip: '',
    userCouponId: null, // 提交给后端的用户优惠券ID
    selectedCouponId: null, // 前端当前选中的优惠券ID
    availableCoupons: [],
    couponLoading: false,

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
    const items = wx.getStorageSync('checkoutItems') || [];
    const totalPrice = this.calculateItemsTotal(items);
    const preferredCouponId = options.user_coupon_id ? Number(options.user_coupon_id) : null;

    this.setData({
      checkoutItems: items,
      originalTotalPrice: totalPrice.toFixed(2),
      payableAmount: totalPrice.toFixed(2),
      totalPrice: totalPrice.toFixed(2),
      discountAmount: '0.00',
      couponTip: ''
    });

    await this.loadAvailableCoupons(preferredCouponId);

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
      }).catch(() => { });
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

  getCouponDisplayText(coupon) {
    if (coupon.coupon_type === 'discount') {
      return `满${coupon.min_purchase_amount}减${coupon.discount_amount}`;
    }
    if (coupon.coupon_type === 'percentage') {
      const rate = Math.round((parseFloat(coupon.discount_rate) || 0) * 100);
      return `${rate}折优惠`;
    }
    if (coupon.coupon_type === 'cash') {
      return `${coupon.discount_amount}元现金券`;
    }
    return coupon.name || '优惠券';
  },

  async loadAvailableCoupons(preferredCouponId = null) {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ couponTip: '登录后可使用优惠券' });
      return;
    }

    const orderTotal = parseFloat(this.data.originalTotalPrice || 0);
    this.setData({ couponLoading: true, couponTip: '正在加载可用优惠券...' });

    try {
      const res = await API.getUserCoupons(token);
      if (res.code !== 0 || !Array.isArray(res.data)) {
        this.setData({ availableCoupons: [], couponLoading: false, couponTip: '优惠券加载失败，请稍后重试' });
        return;
      }

      const usableCoupons = res.data
        .filter(coupon => coupon.status === 'unused')
        .map(coupon => {
          const preview = this.calculateCouponDiscount(coupon, this.data.checkoutItems, orderTotal);
          return {
            ...coupon,
            displayText: this.getCouponDisplayText(coupon),
            previewDiscount: Number(preview.discount.toFixed(2)),
            previewTip: preview.tip
          };
        })
        .filter(coupon => coupon.previewDiscount > 0)
        .sort((a, b) => b.previewDiscount - a.previewDiscount);

      this.setData({
        availableCoupons: usableCoupons,
        couponLoading: false,
        couponTip: usableCoupons.length ? '请选择一张优惠券' : '当前订单暂无可用优惠券'
      });

      if (usableCoupons.length === 0) {
        this.clearCouponSelection(false);
        return;
      }

      const defaultCoupon = preferredCouponId
        ? usableCoupons.find(c => Number(c.id) === Number(preferredCouponId))
        : null;

      if (defaultCoupon) {
        this.applyCouponSelection(defaultCoupon.id, false);
      } else {
        this.clearCouponSelection(false);
      }
    } catch (err) {
      this.setData({ availableCoupons: [], couponLoading: false, couponTip: '优惠券加载失败，请稍后重试' });
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
      return { discount: 0, payable: orderTotal, tip: '当前商品不符合该优惠券使用范围' };
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

  applyCouponSelection(couponId, showToast = false) {
    const coupon = this.data.availableCoupons.find(c => Number(c.id) === Number(couponId));
    if (!coupon) {
      return;
    }

    const orderTotal = parseFloat(this.data.originalTotalPrice || 0);
    const preview = this.calculateCouponDiscount(coupon, this.data.checkoutItems, orderTotal);

    this.setData({
      selectedCouponId: coupon.id,
      userCouponId: coupon.id,
      discountAmount: preview.discount.toFixed(2),
      payableAmount: preview.payable.toFixed(2),
      totalPrice: preview.payable.toFixed(2),
      couponTip: `已选「${coupon.name}」，优惠 ¥${preview.discount.toFixed(2)}`
    });

    if (showToast) {
      wx.showToast({ title: `已优惠¥${preview.discount.toFixed(2)}`, icon: 'none' });
    }
  },

  clearCouponSelection(showToast = true) {
    const orderTotal = parseFloat(this.data.originalTotalPrice || 0);
    this.setData({
      selectedCouponId: null,
      userCouponId: null,
      discountAmount: '0.00',
      payableAmount: orderTotal.toFixed(2),
      totalPrice: orderTotal.toFixed(2),
      couponTip: this.data.availableCoupons.length ? '未使用优惠券' : '当前订单暂无可用优惠券'
    });

    if (showToast) {
      wx.showToast({ title: '已取消优惠券', icon: 'none' });
    }
  },

  onCouponTap(e) {
    const couponId = Number(e.currentTarget.dataset.id);
    if (!couponId) return;

    if (Number(this.data.selectedCouponId) === couponId) {
      this.clearCouponSelection(true);
      return;
    }

    this.applyCouponSelection(couponId, true);
  },

  onClearCouponTap() {
    this.clearCouponSelection(true);
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
      fail: () => { }
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
          }, userCouponId);

          if (res.code === 0) {
            wx.setStorageSync('lastShippingInfo', {
              receiverName, receiverPhone, shippingAddress
            });
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
