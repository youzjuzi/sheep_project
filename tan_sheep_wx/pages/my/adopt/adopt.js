// adopt.js - 我的羊页面
const API = require('../../../utils/api.js');

Page({
  data: {
    adoptingList: [],   // 认养中（paid）
    otherList: [],      // 已发货 + 已完成
    otherExpanded: false, // 折叠区是否展开
    loading: false
  },

  onShow: function () {
    this.loadMySheep();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      tabBar.initTabBar();
      const index = tabBar.data.list.findIndex(item => item.pagePath === "/pages/my/adopt/adopt");
      if (index > -1) tabBar.setData({ selected: index });
    }
  },

  loadMySheep: function () {
    const that = this;
    const token = wx.getStorageSync('token');
    if (!token) {
      that.setData({ adoptingList: [], otherList: [] });
      return;
    }
    that.setData({ loading: true });

    API.getMySheep(token)
      .then((res) => {
        const sheepData = res.data || res;
        const items = Array.isArray(sheepData) ? sheepData : [];
        const baseUrl = API.API_BASE_URL;

        items.forEach(item => {
          if (item.sheep && item.sheep.image) {
            const img = item.sheep.image;
            item.sheep.image = (img.startsWith('http://') || img.startsWith('https://'))
              ? img : baseUrl + img;
          }
        });

        // 按状态分组
        const adoptingList = items.filter(i => i.order_status_key === 'paid');
        const otherList = items.filter(i => i.order_status_key !== 'paid');

        that.setData({ adoptingList, otherList, loading: false });
      })
      .catch((error) => {
        console.error('[我的羊] 获取失败:', error);
        that.setData({ loading: false });
        wx.showToast({ title: '获取数据失败', icon: 'none' });
      });
  },

  toggleOther: function () {
    this.setData({ otherExpanded: !this.data.otherExpanded });
  },

  viewSheepDetail: function (e) {
    const sheepId = e.currentTarget.dataset.sheepId;
    wx.navigateTo({ url: `/packageUser/my/sheep-detail/index?id=${sheepId}` });
  },

  goHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  }
});

