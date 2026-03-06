Page({
  data: {
    searchId: '',
    sheepInfo: null,
    noDataFound: false,
    isLoading: false,
    now: '',
    // 概览卡片
    overview: null,
    // 生长表格分页
    allTableData: [],
    pagedTableData: [],
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    // 喂养记录分页
    feedStats: null,
    allFeedData: [],
    feedPagedData: [],
    feedCurrentPage: 1,
    feedTotalPages: 1,
    feedPageSize: 20,
  },

  onInputChange(e) {
    this.setData({
      searchId: e.detail.value
    });
  },

  onSearch: function() {
    const { searchId } = this.data;
    if (!searchId) {
      wx.showToast({
        title: '请输入羊的ID',
        icon: 'none'
      });
      return;
    }

    // 清空之前的数据
    this.setData({
      sheepInfo: null,
      overview: null,
      allTableData: [],
      pagedTableData: [],
      currentPage: 1,
      feedStats: null,
      allFeedData: [],
      feedPagedData: [],
      feedCurrentPage: 1,
      noDataFound: false,
      isLoading: true,
    });

    wx.showLoading({
      title: '查询中...',
      mask: true
    });

    const API = require('../../utils/api.js');
    
    API.request(`/api/growth/sheep/${searchId}`, 'GET')
      .then((res) => {
        wx.hideLoading();
        console.log('[生长周期] API返回数据:', res);
        
        if (res && res.id) {
          // 确保数据格式正确
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          
          const sheepInfo = {
            id: res.id,
            gender: res.gender || '',
            weight: parseFloat(res.weight || 0).toFixed(1),
            height: parseFloat(res.height || 0).toFixed(1),
            length: parseFloat(res.length || 0).toFixed(1),
            growth_records: (res.growth_records || []).map(record => ({
              ...record,
              weight: parseFloat(record.weight || 0).toFixed(1),
              height: parseFloat(record.height || 0).toFixed(1),
              length: parseFloat(record.length || 0).toFixed(1)
            })),
            feeding_records: res.feeding_records || [],
            vaccination_records: (res.vaccination_records || []).map(record => ({
              ...record,
              is_valid: record.expiry_date && record.expiry_date >= todayStr
            }))
          };
          
          this.setData({
            sheepInfo: sheepInfo,
            noDataFound: false,
            isLoading: false,
          }, () => {
            this._computeDerivedData();
            this._computeFeedingData();
          });

        } else {
          this.setData({
            sheepInfo: null,
            noDataFound: true,
            isLoading: false
          });
          wx.showToast({
            title: '未找到数据',
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('[生长周期] 请求失败', err);
        this.setData({
          sheepInfo: null,
          noDataFound: true,
          isLoading: false
        });
        wx.showToast({
          title: err.message || '网络错误',
          icon: 'none',
          duration: 2000
        });
      });
  },

  onReady() {},
  
  onLoad() {
    // 页面加载时初始化
    console.log('[生长周期] 页面加载');
    // 设置当前日期
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({
      now: dateStr
    });
  },

  // ── 生长派生数据：概览 + 表格 ───────────────────────────────────
  _computeDerivedData() {
    const { sheepInfo } = this.data;
    if (!sheepInfo || !sheepInfo.growth_records || sheepInfo.growth_records.length === 0) return;

    // 按日期升序排列
    const sorted = [...sheepInfo.growth_records].sort(
      (a, b) => new Date(a.record_date) - new Date(b.record_date)
    );
    const first = sorted[0];
    const last  = sorted[sorted.length - 1];

    // 概览数据
    const rawGain  = (parseFloat(last.weight) - parseFloat(first.weight)).toFixed(1);
    const totalGain = parseFloat(rawGain) >= 0 ? `+${rawGain}` : rawGain;
    const overview = {
      id:           sheepInfo.id,
      gender:       sheepInfo.gender,
      latestWeight: last.weight,
      totalGain,
      latestHeight: last.height,
      latestLength: last.length,
    };

    // 表格数据（最新在前），计算每行较上期增重
    const allTableData = sorted.map((rec, i) => {
      const prev = sorted[i - 1];
      let weightDiff = '--';
      let weightDiffPositive = false;
      if (prev) {
        const diff = (parseFloat(rec.weight) - parseFloat(prev.weight)).toFixed(1);
        weightDiff = parseFloat(diff) >= 0 ? `+${diff}` : `${diff}`;
        weightDiffPositive = parseFloat(diff) >= 0;
      }
      return { ...rec, weightDiff, weightDiffPositive };
    }).reverse(); // 最新在前

    const pageSize   = this.data.pageSize;
    const totalPages = Math.max(1, Math.ceil(allTableData.length / pageSize));
    this.setData({
      overview,
      allTableData,
      currentPage: 1,
      totalPages,
      pagedTableData: allTableData.slice(0, pageSize),
    });
  },

  prevPage() {
    const { currentPage, pageSize, allTableData } = this.data;
    if (currentPage <= 1) return;
    const newPage = currentPage - 1;
    const start   = (newPage - 1) * pageSize;
    this.setData({
      currentPage: newPage,
      pagedTableData: allTableData.slice(start, start + pageSize),
    });
  },

  nextPage() {
    const { currentPage, totalPages, pageSize, allTableData } = this.data;
    if (currentPage >= totalPages) return;
    const newPage = currentPage + 1;
    const start   = (newPage - 1) * pageSize;
    this.setData({
      currentPage: newPage,
      pagedTableData: allTableData.slice(start, start + pageSize),
    });
  },

  // ── 喂养派生数据 ─────────────────────────────────────────────────
  _computeFeedingData() {
    const { sheepInfo } = this.data;
    const raw = (sheepInfo && sheepInfo.feeding_records) || [];
    if (raw.length === 0) return;

    // 饲料类型 → CSS class 映射
    const FEED_COLOR = {
      '青草':    'feed-grass',
      '玉米秸秆': 'feed-corn',
      '精饲料':  'feed-pellet',
      '燕麦干草': 'feed-hay',
      '豆粕':    'feed-soybean',
      '麦麸':    'feed-bran',
      '胡萝卜':  'feed-carrot',
      '盐砖':    'feed-salt',
    };

    // 统计各饲料使用次数，找出最常用
    const freqMap = {};
    raw.forEach(r => { freqMap[r.feed_type] = (freqMap[r.feed_type] || 0) + 1; });
    const topFeed = Object.keys(freqMap).sort((a, b) => freqMap[b] - freqMap[a])[0] || '--';

    const feedStats = {
      totalDays:     raw.length,
      topFeed,
      feedTypeCount: Object.keys(freqMap).length,
    };

    const allFeedData = raw.map(r => ({
      ...r,
      colorClass: FEED_COLOR[r.feed_type] || 'feed-default',
    }));

    const feedPageSize   = this.data.feedPageSize;
    const feedTotalPages = Math.max(1, Math.ceil(allFeedData.length / feedPageSize));
    this.setData({
      feedStats,
      allFeedData,
      feedCurrentPage: 1,
      feedTotalPages,
      feedPagedData: allFeedData.slice(0, feedPageSize),
    });
  },

  prevFeedPage() {
    const { feedCurrentPage, feedPageSize, allFeedData } = this.data;
    if (feedCurrentPage <= 1) return;
    const newPage = feedCurrentPage - 1;
    const start   = (newPage - 1) * feedPageSize;
    this.setData({
      feedCurrentPage: newPage,
      feedPagedData: allFeedData.slice(start, start + feedPageSize),
    });
  },

  nextFeedPage() {
    const { feedCurrentPage, feedTotalPages, feedPageSize, allFeedData } = this.data;
    if (feedCurrentPage >= feedTotalPages) return;
    const newPage = feedCurrentPage + 1;
    const start   = (newPage - 1) * feedPageSize;
    this.setData({
      feedCurrentPage: newPage,
      feedPagedData: allFeedData.slice(start, start + feedPageSize),
    });
  },

  onUnload() {},
});
