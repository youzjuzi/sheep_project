// pages/my/follows/index.js - 我的关注
Page({
  data: {
    followList: []
  },

  onShow: function () {
    this.loadFollows();
  },

  loadFollows: function () {
    const list = wx.getStorageSync('followedBreeders') || [];
    this.setData({ followList: list });
  },

  // 取消关注
  unfollow: function (e) {
    const breederId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消关注',
      content: '确定取消关注该养殖户吗？',
      confirmText: '确定',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          let list = wx.getStorageSync('followedBreeders') || [];
          list = list.filter(item => item.id !== breederId);
          wx.setStorageSync('followedBreeders', list);
          this.setData({ followList: list });
          wx.showToast({ title: '已取消关注', icon: 'success' });
        }
      }
    });
  },

  // 查看养殖户详情
  viewBreeder: function (e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/breeder/my1/my1?id=${id}`
    });
  },

  goBack: function () {
    wx.navigateBack();
  }
});
