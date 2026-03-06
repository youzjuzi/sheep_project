const app = getApp()
const WXAPI = require('apifm-wxapi')
const API = require('../../utils/api.js')
const AUTH = require('../../utils/auth')

var sliderWidth = 96; // 需要设置slider的宽度，用于计算中间位置

Page({

  /**
   * 页面的初始数据
   */
  data: {
    balance: 0.00,  
    freeze: 0, 
    score: 0,   
    score_sign_continuous: 0,
    cashlogs: [],  
    tabs: ["资金明细", "提现记录", "押金记录"],
    activeIndex: 0,
    sliderOffset: 0,
    sliderLeft: 0,
    withDrawlogs: [],
    depositlogs: [],
    rechargeOpen: false
  },

  onLoad(options) {
    const withdrawal = wx.getStorageSync('withdrawal')
    if (withdrawal == '1') {
      this.setData({
        withdrawal,
        tabs: ["资金明细", "提现记录", "押金记录"]
      })
    } else {
      this.setData({
        tabs: ["资金明细", "押金记录"]
      })
    }
    AUTH.checkHasLogined().then(isLogined => {
      if (isLogined) {
        this.initData()
      } else {
        getApp().loginOK = () => {
          this.initData()
        }
      }
    })
  },

  onShow() {
    this.showBlance();  // 调用 showBlance() 前，确保它已经被定义
  },

  showBlance() {
    const localBalance = wx.getStorageSync('balance');
    this.setData({ balance: localBalance });
  },

  initData() {
    const _this = this
    const token = wx.getStorageSync('token')

    // 从我们自己的后端获取最新余额
    API.getUserInfo(token).then(function (res) {
      if (res.code === 0) {
        const newBalance = parseFloat(res.data.balance).toFixed(2);
        _this.setData({ balance: newBalance });
        wx.setStorageSync('balance', newBalance);
      }
    }).catch(function () {
      // 静默失败，保留缓存余额
    })
    this.fetchTabData(this.data.activeIndex)
  },

  fetchTabData(activeIndex) {
    if (activeIndex == 0) {
      this.cashLogs()
    }
    if (activeIndex == 1) {
      this.withDrawlogs()
    }
    if (activeIndex == 2) {
      this.depositlogs()
    }
  },

  // 资金明细
  cashLogs() {
    const _this = this
    WXAPI.cashLogsV2({
      token: wx.getStorageSync('token'),
      page: 1
    }).then(res => {
      if (res.code == 0) {
        _this.setData({
          cashlogs: res.data.result || []
        })
      }
    })
  },

  // 提现记录
  withDrawlogs() {
    const _this = this
    WXAPI.withDrawLogs({
      token: wx.getStorageSync('token'),
      page: 1,
      pageSize: 50
    }).then(res => {
      if (res.code == 0) {
        _this.setData({
          withDrawlogs: res.data || []
        })
      }
    })
  },

  //押金记录
  depositlogs() {
    const _this = this
    WXAPI.depositList({
      token: wx.getStorageSync('token'),
      page: 1,
      pageSize: 50
    }).then(res => {
      if (res.code == 0) {
        _this.setData({
          depositlogs: res.data.result || []
        })
      }
    })
  },

  // 充值
  recharge: function (e) {
    wx.navigateTo({
      url: "/pages/recharge/index"
    })
  },

  // 提现
  withdraw: function (e) {
    wx.navigateTo({
      url: "/pages/withdraw/index"
    })
  },

  // 预存
  payDeposit: function (e) {
    wx.navigateTo({
      url: "/pages/deposit/pay"
    })
  },

  // 切换标签
  tabClick: function (e) {
    this.setData({
      activeIndex: e.detail.index
    });
    this.fetchTabData(e.detail.index)
  },

  cancelLogin() {
    wx.switchTab({
      url: '/pages/my/index'
    })
  },
})
