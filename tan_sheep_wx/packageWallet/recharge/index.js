const API = require('../../utils/api.js');

Page({
  data: {
    amount: '',
    loading: false,
    rechargeSendRules: [
      { confine: 50,  send: 0 },
      { confine: 100, send: 5 },
      { confine: 200, send: 15 },
      { confine: 500, send: 50 },
      { confine: 1000, send: 120 },
    ],
  },

  onLoad() {},
  onShow() {},

  /** 点击快捷金额 */
  rechargeAmount(e) {
    const amount = e.currentTarget.dataset.confine;
    this.setData({ amount: String(amount) });
  },

  /** 点击立即充值 */
  async bindSave() {
    const amount = parseFloat(this.data.amount);
    if (!amount || amount <= 0) {
      wx.showModal({ title: '提示', content: '请填写正确的充值金额', showCancel: false });
      return;
    }
    if (amount > 9999) {
      wx.showModal({ title: '提示', content: '单次充值金额不能超过 9999 元', showCancel: false });
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
        // 更新本地缓存余额，我的页面 onShow 会读取
        const newBalance = parseFloat(res.data.balance).toFixed(2);
        wx.setStorageSync('balance', newBalance);

        wx.showToast({ title: '充值成功', icon: 'success', duration: 1500 });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/my/index' });
        }, 1500);
      } else {
        wx.showModal({ title: '充值失败', content: res.msg || '请稍后重试', showCancel: false });
      }
    } catch (e) {
      wx.showModal({ title: '充值失败', content: e.message || '网络错误，请稍后重试', showCancel: false });
    } finally {
      this.setData({ loading: false });
    }
  },
});

