// pages/search/search-content.js
Page({
  data: {
    keyword: '',
    searchHistory: [],
    hotKeywords: ['滩羊', '羊肉', '羊只', '领养', '定制']
  },

  onLoad(options) {
    if (options.keyword) {
      this.setData({
        keyword: options.keyword
      });
    }
    this.loadHistory();
  },

  // 加载搜索历史
  loadHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({
      searchHistory: history.slice(0, 10)
    });
  },

  // 搜索
  search(e) {
    const keyword = e.detail || this.data.keyword;
    if (!keyword.trim()) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }
    // 跳转到搜索结果页面
    wx.redirectTo({
      url: `/pages/search/index?keyword=${encodeURIComponent(keyword)}`
    });
  },

  // 点击历史记录
  go(e) {
    const index = e.currentTarget.dataset.idx;
    const keyword = this.data.searchHistory[index];
    wx.redirectTo({
      url: `/pages/search/index?keyword=${encodeURIComponent(keyword)}`
    });
  },

  // 删除历史记录
  onClose(e) {
    const index = e.currentTarget.dataset.idx;
    let history = [...this.data.searchHistory];
    history.splice(index, 1);
    wx.setStorageSync('searchHistory', history);
    this.setData({
      searchHistory: history
    });
    wx.showToast({
      title: '已删除',
      icon: 'success'
    });
  },

  // 扫码搜索
  searchscan() {
    wx.scanCode({
      success: (res) => {
        const keyword = res.result;
        wx.redirectTo({
          url: `/pages/search/index?keyword=${encodeURIComponent(keyword)}`
        });
      },
      fail: (err) => {
        console.error('扫码失败:', err);
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  }
});
