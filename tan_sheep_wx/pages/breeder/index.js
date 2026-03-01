// 在文件顶部引入API，避免在函数内部require导致路径解析问题
// 从 pages/breeder/ 到 utils/ 需要向上两级
const API = require('../../utils/api.js');

Page({
    data: {
      breeders: [], 
      currentBreeder: null, 
    },
  
    onLoad: function(options) {
      console.log('[养殖户列表] 页面onLoad被调用', options);
      console.log('[养殖户列表] 当前页面路径:', getCurrentPages());
      this.fetchBreeders();
    },
    
    onShow: function() {
      console.log('[养殖户列表] 页面显示');
      // 如果数据为空，重新加载
      if (this.data.breeders.length === 0) {
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
            breeders: processedBreeders
          }, function() {
            // setData完成后的回调
            console.log('[养殖户列表] setData完成，当前breeders数量:', that.data.breeders.length);
            console.log('[养殖户列表] 当前breeders数据:', that.data.breeders);
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
  
    redirectToNextPage: function(e) {
        const index = e.currentTarget.dataset.index;
        const breeder = this.data.breeders[index];
        
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
            this.setData({
                breeders: breeders
            });
        }
    }
});
