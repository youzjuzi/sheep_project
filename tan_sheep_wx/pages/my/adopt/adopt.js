// adopt.js - 我的羊页面（展示已结算购买的羊）
const API = require('../../../utils/api.js');

Page({
  data: {
    mySheepList: [],  // 从后端订单获取的已购买的羊
    loading: false
  },

  onShow: function () {
    // 每次显示页面时从后端刷新数据
    this.loadMySheep();

    // 设置 TabBar 选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      tabBar.initTabBar();
      const index = tabBar.data.list.findIndex(item => item.pagePath === "/pages/my/adopt/adopt");
      if (index > -1) {
        tabBar.setData({ selected: index });
      }
    }
  },

  // 从后端加载已购买的羊（通过订单）
  loadMySheep: function () {
    const that = this;
    const token = wx.getStorageSync('token');

    if (!token) {
      that.setData({ mySheepList: [] });
      return;
    }

    that.setData({ loading: true });

    API.getMySheep(token)
      .then((res) => {
        console.log('[我的羊] API返回:', res);
        // 后端返回 { code: 0, data: [...] } 格式
        const sheepData = res.data || res;
        const items = Array.isArray(sheepData) ? sheepData : [];

        // 转换图片为绝对 URL
        const baseUrl = API.API_BASE_URL;
        items.forEach(item => {
          if (item.sheep && item.sheep.image) {
            const img = item.sheep.image;
            item.sheep.image = (img.startsWith('http://') || img.startsWith('https://'))
              ? img
              : baseUrl + img;
          }
        });

        that.setData({
          mySheepList: items,
          loading: false
        });
      })
      .catch((error) => {
        console.error('[我的羊] 获取失败:', error);
        that.setData({ loading: false });
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      });
  },

  viewSheepDetail: function (e) {
    const sheepId = e.currentTarget.dataset.sheepId;
    wx.navigateTo({
      url: `/pages/my/sheep-detail/index?id=${sheepId}`
    });
  },

  goHome: function () {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
