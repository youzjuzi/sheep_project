Page({
  data: {
    order: null,
    orderId: null
  },

  onLoad(options) {
    const orderId = options.order_id ? Number(options.order_id) : null;
    const cached = wx.getStorageSync('currentOrderDetail');

    if (!cached || !cached.id) {
      wx.showToast({ title: '订单信息不存在', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }

    if (orderId && Number(cached.id) !== orderId) {
      wx.showToast({ title: '订单信息已失效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1200);
      return;
    }

    this.setData({
      order: cached,
      orderId: orderId || cached.id
    });
  }
});
