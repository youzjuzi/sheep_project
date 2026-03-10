const app = getApp()
const WXAPI = require('apifm-wxapi')
const AUTH = require('../../utils/auth')

Page({

  /**
   * 页面的初始数据
   */
  data: {
    growth: 0.00,
    cashlogs: [],  // 用来存储已关注的农户信息
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
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
  
  /**
   * 页面显示时调用
   */
  onShow: function () {
    this.loadFollowedBreeders()  // 每次进入页面时加载已关注农户
  },

  /**
   * 加载已关注农户信息
   */
  loadFollowedBreeders: function () {
    const followedBreeders = wx.getStorageSync('followedBreeders') || []
    this.setData({
      cashlogs: followedBreeders  // 将已关注的农户信息赋给 cashlogs
    })
  },

  /**
   * 初始化数据
   */
  initData: function () {
    const _this = this
    const token = wx.getStorageSync('token')
    WXAPI.userAmount(token).then(function (res) {
      if (res.code == 0) {
        _this.setData({
          growth: res.data.growth
        });
      } else {
        wx.showToast({
          title: res.msg,
          icon: 'none'
        })
      }
    })

    // 读取积分明细
    WXAPI.growthLogs({
      token: token,
      page: 1,
      pageSize: 50
    }).then(res => {
      if (res.code == 0) {
        _this.setData({
          cashlogs: res.data.result
        })
      }
    })
  },

  /**
   * 充值
   */
  recharge: function (e) {
    wx.navigateTo({
      url: "/packageWallet/recharge/index"
    })
  },

  /**
   * 提现
   */
  withdraw: function (e) {
    wx.showToast({
      title: "提现功能暂未开放",
      icon: "none"
    })
  }
})

