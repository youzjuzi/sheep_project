// 引入API工具
const API = require('../../utils/api.js');

Page({
    data: {
      markers: [],
      latitude: 37.784595,  // 默认中心点：盐池县
      longitude: 107.40541,
      farmers: [],
      selectedFarmer: null,
      loading: false
    },
  
    onLoad: function (options) {
      // 如果从其他页面传入坐标，使用传入的坐标
      if (options.latitude && options.longitude) {
        this.setData({
          latitude: parseFloat(options.latitude),
          longitude: parseFloat(options.longitude)
        });
      } else {
        // 否则获取当前位置
        this.getCurrentLocation();
      }
      
      // 加载养殖户数据
      this.fetchFarmers();
    },

    /**
     * 获取当前位置
     */
    getCurrentLocation: function() {
      const that = this;
      wx.getLocation({
        type: 'gcj02',
        success: function(res) {
          that.setData({
            latitude: res.latitude,
            longitude: res.longitude
          });
        },
        fail: function(err) {
          console.log('获取位置失败，使用默认位置', err);
          // 使用默认位置（盐池县）
        }
      });
    },

    /**
     * 从API获取养殖户数据
     */
    fetchFarmers: function() {
      const that = this;
      this.setData({ loading: true });
      
      wx.showLoading({ title: '加载中...', mask: true });
      
      console.log('[地图] 开始获取养殖户数据...');
      
      API.request('/api/breeders', 'GET')
        .then(function(res) {
          wx.hideLoading();
          console.log('[地图] API返回数据:', res);
          console.log('[地图] 数据类型:', Array.isArray(res) ? '数组' : typeof res);
          console.log('[地图] 数据长度:', Array.isArray(res) ? res.length : '非数组');
          
          // 确保res是数组
          const breedersList = Array.isArray(res) ? res : (res.data || []);
          
          console.log('[地图] 处理后的数据:', breedersList);
          console.log('[地图] 前3条数据详情:', breedersList.slice(0, 3).map(f => ({
            id: f.id,
            name: f.name,
            latitude: f.latitude,
            longitude: f.longitude
          })));
          
          // 过滤出有位置信息的养殖户
          const farmersWithLocation = breedersList.filter(farmer => {
            const hasLocation = farmer.latitude != null && farmer.longitude != null && 
                               farmer.latitude !== '' && farmer.longitude !== '';
            if (!hasLocation) {
              console.log('[地图] 养殖户缺少位置信息:', {
                id: farmer.id,
                name: farmer.name,
                latitude: farmer.latitude,
                longitude: farmer.longitude
              });
            }
            return hasLocation;
          });
          
          console.log('[地图] 有位置信息的养殖户数量:', farmersWithLocation.length);
          console.log('[地图] 有位置信息的养殖户列表:', farmersWithLocation.map(f => ({
            id: f.id,
            name: f.name,
            lat: f.latitude,
            lng: f.longitude
          })));
          
          that.setData({
            farmers: farmersWithLocation,
            loading: false
          });
          
          // 添加地图标记
          that.addFarmerMarkers();
          
          // 如果有养殖户数据，调整地图中心点
          if (farmersWithLocation.length > 0) {
            const avgLat = farmersWithLocation.reduce((sum, f) => sum + parseFloat(f.latitude), 0) / farmersWithLocation.length;
            const avgLng = farmersWithLocation.reduce((sum, f) => sum + parseFloat(f.longitude), 0) / farmersWithLocation.length;
            console.log('[地图] 调整地图中心点:', avgLat, avgLng);
            that.setData({
              latitude: avgLat,
              longitude: avgLng
            });
          } else {
            console.warn('[地图] 没有有位置信息的养殖户，使用默认中心点');
            wx.showToast({
              title: '暂无位置数据，请先添加养殖户位置信息',
              icon: 'none',
              duration: 3000
            });
          }
        })
        .catch(function(error) {
          wx.hideLoading();
          console.error('[地图] 获取养殖户数据失败:', error);
          console.error('[地图] 错误详情:', JSON.stringify(error));
          wx.showToast({
            title: '加载失败: ' + (error.message || error.errMsg || '未知错误'),
            icon: 'none',
            duration: 3000
          });
          that.setData({ loading: false });
        });
    },
  
    addFarmerMarkers: function() {
      const { farmers } = this.data;
      console.log('准备添加标记，养殖户数量:', farmers.length);
      
      const markers = farmers
        .filter(farmer => {
          const hasLocation = farmer.latitude && farmer.longitude;
          if (!hasLocation) {
            console.log('养殖户缺少位置信息:', farmer.id, farmer.name);
          }
          return hasLocation;
        })
        .map((farmer, index) => {
          console.log(`添加标记 ${index + 1}:`, farmer.name, farmer.latitude, farmer.longitude);
          return {
            id: Number(farmer.id), 
            latitude: parseFloat(farmer.latitude),
            longitude: parseFloat(farmer.longitude),
            width: 30,
            height: 30,
            // 不指定iconPath，使用默认标记样式
            callout: {
              content: farmer.name,
              color: '#333',
              fontSize: 12,
              borderRadius: 4,
              bgColor: '#fff',
              padding: 5,
              display: 'BYCLICK'  // 点击时显示
            }
          };
        });
      
      console.log('最终标记数量:', markers.length);
      console.log('标记数据:', markers);
      
      this.setData({ markers });
      
      if (markers.length === 0) {
        wx.showToast({
          title: '暂无位置信息',
          icon: 'none',
          duration: 2000
        });
      }
    },
  
    onMarkerTap: function (e) {
      const markerId = e.detail.markerId;
      const farmer = this.data.farmers.find(f => f.id === Number(markerId));  
      if (farmer) {
        this.setData({
          selectedFarmer: farmer
        });
        // 点击标记时，将地图中心移动到该位置
        this.setData({
          latitude: farmer.latitude,
          longitude: farmer.longitude
        });
      }
    },
  
    closeModal: function () {
      this.setData({
        selectedFarmer: null
      });
    },

    /**
     * 导航到指定位置
     */
    navigateToLocation: function() {
      const { selectedFarmer } = this.data;
      if (!selectedFarmer) {
        wx.showToast({
          title: '请先选择农户',
          icon: 'none'
        });
        return;
      }

      // 跳转到导航页面，传递终点坐标
      wx.navigateTo({
        url: `/pages/map/navigatePage/navigatePage?end=${selectedFarmer.name}&endLat=${selectedFarmer.latitude}&endLng=${selectedFarmer.longitude}`
      });
    },

    /**
     * 打开导航页面（通用入口）
     */
    openNavigation: function() {
      wx.navigateTo({
        url: '/pages/map/navigatePage/navigatePage'
      });
    },

    /**
     * 地图区域变化事件
     */
    onRegionChange: function(e) {
      // 可以在这里实现地图拖动后的逻辑
      // 例如：重新加载可见区域内的养殖户
    },

    /**
     * 下拉刷新
     */
    onPullDownRefresh: function() {
      this.fetchFarmers();
      setTimeout(() => {
        wx.stopPullDownRefresh();
      }, 1000);
    }
  });