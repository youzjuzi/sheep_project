// pages/search/index.js
const API = require('../../utils/api.js');

Page({
  data: {
    searchKeyword: '', // 搜索关键词
    isFocus: false, // 是否聚焦搜索框
    hasSearched: false, // 是否已搜索
    historyList: [], // 历史搜索记录
    hotKeywords: ['滩羊', '羊肉', '羊只', '领养', '定制'], // 热门搜索关键词
    resultList: [], // 搜索结果列表
    showFilterPopup: false, // 是否显示筛选弹窗
    // 筛选选项
    genderOptions: [
      { label: '全部', value: '' },
      { label: '雄性', value: '雄性' },
      { label: '雌性', value: '雌性' }
    ],
    priceRanges: [
      { label: '全部', value: '' },
      { label: '0-300元', value: '0-300' },
      { label: '300-500元', value: '300-500' },
      { label: '500-800元', value: '500-800' },
      { label: '800元以上', value: '800-' }
    ],
    selectedGender: '', // 选中的性别
    selectedPriceRange: '', // 选中的价格区间
    originalResults: [] // 原始搜索结果（用于筛选）
  },

  onLoad(options) {
    // 如果有传入关键词，直接搜索
    if (options.keyword) {
      this.setData({
        searchKeyword: options.keyword,
        isFocus: true
      });
      this.performSearch(options.keyword);
    } else {
      // 加载历史搜索记录
      this.loadHistory();
    }
  },

  onShow() {
    // 每次显示页面时，如果不是搜索状态，重新加载历史记录
    if (!this.data.hasSearched) {
      this.loadHistory();
    }
  },

  // 加载历史搜索记录
  loadHistory() {
    const history = wx.getStorageSync('searchHistory') || [];
    this.setData({
      historyList: history.slice(0, 10) // 最多显示10条
    });
  },

  // 输入框输入事件
  onInput(e) {
    const value = e.detail.value;
    this.setData({
      searchKeyword: value
    });
  },

  // 清除输入
  clearInput() {
    this.setData({
      searchKeyword: '',
      hasSearched: false,
      resultList: []
    });
  },

  // 搜索
  onSearch(e) {
    const keyword = e.detail.value || this.data.searchKeyword;
    if (!keyword.trim()) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      });
      return;
    }
    this.performSearch(keyword);
  },

  // 执行搜索
  performSearch(keyword) {
    if (!keyword.trim()) return;

    // 保存搜索历史
    this.saveHistory(keyword);

    // 显示加载
    wx.showLoading({
      title: '搜索中...',
      mask: true
    });

    // 调用搜索API
    API.request('/search_goods', 'GET', {
      keyword: keyword.trim()
    })
    .then((res) => {
      wx.hideLoading();
      const results = Array.isArray(res) ? res : [];
      this.setData({
        resultList: results,
        originalResults: results,
        hasSearched: true,
        searchKeyword: keyword
      });
    })
    .catch((err) => {
      wx.hideLoading();
      console.error('搜索请求失败:', err);
      
      // 如果后端服务未启动，使用模拟数据
      this.setData({
        resultList: this.getMockResults(keyword),
        originalResults: this.getMockResults(keyword),
        hasSearched: true,
        searchKeyword: keyword
      });
    });
  },

  // 获取模拟搜索结果（用于测试）
  getMockResults(keyword) {
    const mockData = [
      {
        id: 1,
        name: '优质滩羊',
        title: '优质滩羊',
        gender: '雄性',
        weight: 45.5,
        height: 65,
        length: 95,
        price: 380,
        image: '/images/default.png',
        description: '健康优质的滩羊，适合领养'
      },
      {
        id: 2,
        name: '标准滩羊',
        title: '标准滩羊',
        gender: '雌性',
        weight: 42.3,
        height: 62,
        length: 90,
        price: 350,
        image: '/images/default.png',
        description: '标准体型滩羊，性格温顺'
      },
      {
        id: 3,
        name: '大型滩羊',
        title: '大型滩羊',
        gender: '雄性',
        weight: 48.2,
        height: 68,
        length: 98,
        price: 420,
        image: '/images/default.png',
        description: '体型较大的滩羊，适合大型养殖'
      }
    ];

    // 根据关键词过滤
    if (keyword) {
      return mockData.filter(item => 
        item.name.includes(keyword) || 
        item.description.includes(keyword) ||
        item.gender.includes(keyword)
      );
    }
    return mockData;
  },

  // 通过历史记录搜索
  searchByHistory(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({
      searchKeyword: keyword,
      isFocus: true
    });
    this.performSearch(keyword);
  },

  // 保存搜索历史
  saveHistory(keyword) {
    let history = wx.getStorageSync('searchHistory') || [];
    // 移除重复项
    history = history.filter(item => item !== keyword);
    // 添加到开头
    history.unshift(keyword);
    // 最多保存20条
    history = history.slice(0, 20);
    wx.setStorageSync('searchHistory', history);
    this.setData({
      historyList: history.slice(0, 10)
    });
  },

  // 清除历史记录
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清除所有搜索历史吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('searchHistory');
          this.setData({
            historyList: []
          });
          wx.showToast({
            title: '已清除',
            icon: 'success'
          });
        }
      }
    });
  },

  // 取消搜索
  onCancel() {
    wx.navigateBack();
  },

  // 显示筛选弹窗
  showFilter() {
    this.setData({
      showFilterPopup: true
    });
  },

  // 关闭筛选弹窗
  closeFilter() {
    this.setData({
      showFilterPopup: false
    });
  },

  // 选择性别
  selectGender(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      selectedGender: value
    });
  },

  // 选择价格区间
  selectPriceRange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      selectedPriceRange: value
    });
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      selectedGender: '',
      selectedPriceRange: ''
    });
    this.applyFilter();
  },

  // 应用筛选
  applyFilter() {
    // 使用 slice() 复制数组，避免使用扩展运算符
    var originalResults = this.data.originalResults || [];
    var results = originalResults.slice(0);

    // 性别筛选
    if (this.data.selectedGender) {
      results = results.filter(function(item) {
        return item.gender === this.data.selectedGender;
      }.bind(this));
    }

    // 价格区间筛选
    if (this.data.selectedPriceRange) {
      var range = this.data.selectedPriceRange;
      if (range.indexOf('-') !== -1) {
        // 使用 split 后再取数组元素，避免数组解构
        var parts = range.split('-');
        var min = parts[0];
        var max = parts[1];
        results = results.filter(function(item) {
          var price = item.price || 0;
          return price >= parseFloat(min) && (max ? price <= parseFloat(max) : true);
        });
      } else if (range.charAt(range.length - 1) === '-') {
        var min = parseFloat(range.replace('-', ''));
        results = results.filter(function(item) {
          return (item.price || 0) >= min;
        });
      }
    }

    this.setData({
      resultList: results,
      showFilterPopup: false
    });
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type || 'sheep';
    
    let url = '';
    if (type === 'sheep') {
      // 跳转到羊只详情页
      url = `/pages/goodsdetail/goodsdetail?id=${id}`;
    } else if (type === 'breeder') {
      // 跳转到养殖户详情页
      url = `/pages/breeder/my3/my3?id=${id}`;
    } else if (type === 'activity') {
      // 跳转到优惠活动页面
      url = `/pages/promotion/index`;
    } else if (type === 'coupon') {
      // 跳转到优惠券页面
      url = `/pages/promotion/index`;
    } else {
      // 默认跳转到羊只详情页
      url = `/pages/goodsdetail/goodsdetail?id=${id}`;
    }
    
    wx.navigateTo({
      url: url
    });
  }
});

