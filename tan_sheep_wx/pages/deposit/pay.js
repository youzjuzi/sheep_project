const API = require('../../utils/api.js');

Page({
  data: {
    amount: '',    // 充值金额（input 绑定）
    balance: '0.00', // 当前余额
    loading: false,
  },

  onLoad: function () {
    // 先从本地缓存展示余额，onShow 时会从服务端刷新
    const balance = wx.getStorageSync('balance') || '0.00';
    this.setData({ balance });
  },

  onShow: async function () {
    // 每次显示时从服务端拉取最新余额
    const token = wx.getStorageSync('token');
    if (!token) return;
    try {
      const res = await API.getUserInfo(token);
      if (res.code === 0) {
        const newBalance = parseFloat(res.data.balance).toFixed(2);
        this.setData({ balance: newBalance });
        wx.setStorageSync('balance', newBalance);
      }
    } catch (e) {
      // 静默失败，使用缓存余额
    }
  },

  bindSave: async function (e) {
    const amount = parseFloat(e.detail.value.amount);

    if (!amount || amount <= 0) {
      wx.showModal({ title: '错误', content: '请输入有效的充值金额', showCancel: false });
      return;
    }
    if (amount > 9999) {
      wx.showModal({ title: '错误', content: '单次充值金额不能超过 9999 元', showCancel: false });
      return;
    }

    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showModal({ title: '提示', content: '请先登录', showCancel: false });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await API.recharge(token, amount);
      if (res.code === 0) {
        const newBalance = parseFloat(res.data.balance).toFixed(2);
        this.setData({ balance: newBalance, amount: '' });
        wx.setStorageSync('balance', newBalance);
        wx.showModal({ title: '成功', content: '充值成功，当前余额 ¥' + newBalance, showCancel: false });
      } else {
        wx.showModal({ title: '充值失败', content: res.msg || '请稍后重试', showCancel: false });
      }
    } catch (err) {
      wx.showModal({ title: '请求失败', content: '充值失败，请稍后再试', showCancel: false });
    } finally {
      this.setData({ loading: false });
    }
  },
});
