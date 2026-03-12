// 在文件顶部引入API，避免在函数内部require导致路径解析问题
// 从 pages/breeder/ 到 utils/ 需要向上两级
const API = require('../../utils/api.js');

Page({
    data: {
      allBreeders: [],
      breeders: [],
      currentBreeder: null,
      currentPage: 1,
      pageSize: 4,
      totalPages: 1,
      visiblePageNumbers: []
    },

    onLoad: function(options) {
      console.log('[养殖户列表] 页面onLoad被调用', options);
      console.log('[养殖户列表] 当前页面路径:', getCurrentPages());
      this.fetchBreeders();
    },

    onShow: function() {
      console.log('[养殖户列表] 页面显示');
      // 如果数据为空，重新加载
      if (this.data.allBreeders.length === 0) {
        console.log('[养殖户列表] 数据为空，重新加载');
        this.fetchBreeders();
      }
    },

    fetchBreeders: function() {
      var that = this;
      console.log('[养殖户列表] fetchBreeders 函数被调用');
      wx.showLoading({ title: '加载中...', mask: true });

      console.log('[养殖户列表] 准备发送请求: /api/breeders');
      const apiConfig = require('../../utils/api-config.js');
      console.log('[养殖户列表] API_BASE_URL:', apiConfig.getApiBaseUrl());
      console.log('[养殖户列表] 完整URL:', apiConfig.getApiBaseUrl() + '/api/breeders');

      API.request('/api/breeders', 'GET')
        .then(function(res) {
          console.log('[养殖户列表] 获取数据:', res);
          console.log('[养殖户列表] 完整响应:', JSON.stringify(res, null, 2));
          console.log('[养殖户列表] 数据类型:', typeof res, Array.isArray(res));

          // 处理返回的数据（可能是数组或包含data字段的对象）
          let breedersData = res;
          if (res && res.data) {
            breedersData = res.data;
          }

          // 确保是数组
          if (!Array.isArray(breedersData)) {
            console.warn('[养殖户列表] 返回数据不是数组:', breedersData);
            breedersData = [];
          }

          console.log('[养殖户列表] 处理后的数据数量:', breedersData.length);

          // 处理数据并设置
          const apiBaseUrl = (apiConfig.getApiBaseUrl() || '').replace(/\/$/, '');
          const normalizeAvatarUrl = (url) => {
            if (!url || typeof url !== 'string') return '';
            if (url.startsWith('http://') || url.startsWith('https://')) return url;
            if (url.startsWith('/')) return `${apiBaseUrl}${url}`;
            return `${apiBaseUrl}/${url}`;
          };

          const processedBreeders = breedersData.map(item => {
            // 优先使用用户自身头像，没有则使用默认头像
            const defaultIconPath = '/images/icons/function/f8.png';
            return {
              ...item,
              displayAvatar: normalizeAvatarUrl(item.avatar_url || item.avatarUrl) || defaultIconPath
            };
          });

          console.log('[养殖户列表] 处理后的数据:', processedBreeders);

          that.setData({
            allBreeders: processedBreeders,
            currentPage: 1
          }, function() {
            that.updatePagedBreeders();
            // setData完成后的回调
            console.log('[养殖户列表] setData完成，当前allBreeders数量:', that.data.allBreeders.length);
          });

          if (breedersData.length === 0) {
            wx.showToast({
              title: '暂无养殖户数据',
              icon: 'none',
              duration: 2000
            });
          } else {
            console.log('[养殖户列表] 成功加载', breedersData.length, '个养殖户');
          }
        })
        .catch(function(error) {
          console.error('[养殖户列表] 请求失败', error);
          wx.showToast({
            title: '加载失败: ' + (error.message || '未知错误'),
            icon: 'none',
            duration: 3000
          });
        })
        .finally(function() {
          // 确保任何情况下都关闭Loading
          try {
            wx.hideLoading();
          } catch (e) {
            // ignore
          }
        });
    },

    updatePagedBreeders: function () {
      const list = this.data.allBreeders || [];
      const pageSize = this.data.pageSize || 4;
      const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
      let currentPage = this.data.currentPage || 1;

      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize;
      const paged = list.slice(start, end);

      this.setData({
        currentPage: currentPage,
        totalPages: totalPages,
        breeders: paged,
        visiblePageNumbers: this.buildVisiblePages(currentPage, totalPages)
      });
    },

    // 最多显示4个页码按钮
    buildVisiblePages: function (currentPage, totalPages) {
      const maxVisible = 4;
      if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      let start = Math.max(1, currentPage - 1);
      let end = start + maxVisible - 1;

      if (end > totalPages) {
        end = totalPages;
        start = end - maxVisible + 1;
      }

      const pages = [];
      for (let i = start; i <= end; i++) pages.push(i);
      return pages;
    },

    goPrevPage: function () {
      if (this.data.currentPage <= 1) return;
      this.setData({ currentPage: this.data.currentPage - 1 });
      this.updatePagedBreeders();
    },

    goNextPage: function () {
      if (this.data.currentPage >= this.data.totalPages) return;
      this.setData({ currentPage: this.data.currentPage + 1 });
      this.updatePagedBreeders();
    },

    goToPage: function (e) {
      const page = parseInt(e.currentTarget.dataset.page, 10);
      if (!page || page === this.data.currentPage) return;
      this.setData({ currentPage: page });
      this.updatePagedBreeders();
    },

    redirectToNextPage: function(e) {
        const index = e.currentTarget.dataset.index;
        const breeder = this.data.breeders[index];
        if (!breeder) return;

        wx.navigateTo({
          url: `/pages/breeder/my1/my1?id=${breeder.id}`
        });
    },

    // 图片加载失败处理
    onImageError: function(e) {
        const index = e.currentTarget.dataset.index;
        const breeders = this.data.breeders;
        if (breeders[index]) {
          breeders[index].displayAvatar = '/images/icons/function/f8.png';
          this.setData({ breeders: breeders });
        }
    }
});
