// pages/my/follows/index.js - 我的关注
const API = require('../../../../utils/api.js');

Page({
  data: {
    followList: []
  },

  onShow: function () {
    this.syncLegacyFollowsIfNeeded().finally(() => {
      this.loadFollows();
    });
  },

  // 将历史本地关注数据迁移到后端（仅执行一次）
  syncLegacyFollowsIfNeeded: function () {
    const token = wx.getStorageSync('token');
    if (!token) return Promise.resolve();

    const migrated = wx.getStorageSync('legacyFollowMigrated');
    if (migrated) return Promise.resolve();

    const localList = wx.getStorageSync('followedBreeders') || [];
    if (!Array.isArray(localList) || localList.length === 0) {
      wx.setStorageSync('legacyFollowMigrated', true);
      return Promise.resolve();
    }

    const tasks = localList
      .filter(item => item && item.id)
      .map(item => API.followBreeder(token, item.id, true).catch(() => null));

    return Promise.all(tasks).finally(() => {
      wx.setStorageSync('legacyFollowMigrated', true);
    });
  },

  loadFollows: function () {
    const token = wx.getStorageSync('token');
    if (!token) {
      this.setData({ followList: [] });
      return;
    }

    API.getFollowedBreeders(token)
      .then((res) => {
        if (res && res.code === 0) {
          const list = (res.data || []).map(item => ({
            ...item,
            avatarUrl: item.avatar_url || item.avatarUrl || ''
          }));
          this.setData({ followList: list });
        } else {
          this.setData({ followList: [] });
          wx.showToast({ title: (res && res.msg) || '加载失败', icon: 'none' });
        }
      })
      .catch((error) => {
        console.error('加载关注列表失败:', error);
        this.setData({ followList: [] });
        wx.showToast({ title: '加载失败', icon: 'none' });
      });
  },

  // 取消关注
  unfollow: function (e) {
    const breederId = e.currentTarget.dataset.id;
    const token = wx.getStorageSync('token');

    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '取消关注',
      content: '确定取消关注该养殖户吗？',
      confirmText: '确定',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;

        API.followBreeder(token, breederId, false)
          .then((resp) => {
            if (resp && resp.code === 0) {
              this.loadFollows();
              wx.showToast({ title: '已取消关注', icon: 'success' });
            } else {
              wx.showToast({ title: (resp && resp.msg) || '操作失败', icon: 'none' });
            }
          })
          .catch((error) => {
            console.error('取消关注失败:', error);
            wx.showToast({ title: '操作失败', icon: 'none' });
          });
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
