// 引入API工具
const API = require('../../utils/api.js');

Page({
    data: {
      markers: [],
      polygons: [],
      latitude: 37.852274,   // 两点中心
      longitude: 107.392028,
      scale: 11,             // 覆盖约 45km 范围
      farmers: [],
      selectedFarmer: null,
      loading: false
    },

    onLoad: function (options) {
      // 若外部传入坐标则以传入坐标为中心，否则使用固定区域中心
      if (options.latitude && options.longitude) {
        this.setData({
          latitude: parseFloat(options.latitude),
          longitude: parseFloat(options.longitude),
          scale: 14
        });
      }
      // 加载养殖户数据
      this.fetchFarmers();
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

          // 添加养殖户标记（会合并固定坐标点）
          that.addFarmerMarkers();
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

      // 养殖户标记
      const farmerMarkers = farmers
        .filter(farmer => farmer.latitude && farmer.longitude)
        .map(farmer => ({
          id: Number(farmer.id),
          latitude: parseFloat(farmer.latitude),
          longitude: parseFloat(farmer.longitude),
          width: 30, height: 30,
          callout: { content: farmer.name, color: '#333', fontSize: 12, borderRadius: 4, bgColor: '#fff', padding: 5, display: 'BYCLICK' }
        }));

      this.setData({ markers: farmerMarkers });
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
     * 选择地图应用并拉起
     */
    chooseMapAppAndOpen: function (options) {
      var latitude = parseFloat(options.latitude);
      var longitude = parseFloat(options.longitude);
      var name = options.name || '目的地';
      var address = options.address || '';

      if (isNaN(latitude) || isNaN(longitude)) {
        wx.showToast({
          title: '目的地坐标无效',
          icon: 'none'
        });
        return;
      }

      var appList = ['高德地图', '腾讯地图'];
      var that = this;

      wx.showActionSheet({
        itemList: appList,
        success: function (res) {
          var appName = appList[res.tapIndex] || '地图应用';
          that.openLocationApp(latitude, longitude, name, address, appName);
        },
        fail: function (err) {
          // 用户取消选择不提示
          if (err && err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
            return;
          }
          wx.showToast({
            title: '无法选择地图应用',
            icon: 'none'
          });
        }
      });
    },

    /**
     * 拉起手机地图应用
     */
    openLocationApp: function (latitude, longitude, name, address, appName) {
      wx.openLocation({
        latitude: latitude,
        longitude: longitude,
        name: name,
        address: address,
        scale: 18,
        success: function () {
          console.log('[地图] 已拉起地图应用:', appName, latitude, longitude);
        },
        fail: function (err) {
          console.error('[地图] 拉起地图失败:', err);
          wx.showToast({
            title: '打开地图失败',
            icon: 'none'
          });
        }
      });
    },

    /**
     * 打开选中农户位置（地图应用）
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

      this.chooseMapAppAndOpen({
        latitude: selectedFarmer.latitude,
        longitude: selectedFarmer.longitude,
        name: selectedFarmer.name || '养殖户位置',
        address: selectedFarmer.address || ''
      });
    },

    /**
     * 通用入口：打开当前地图中心点（地图应用）
     */
    openNavigation: function() {
      var target = this.data.selectedFarmer || {
        latitude: this.data.latitude,
        longitude: this.data.longitude,
        name: '盐池县地图中心',
        address: ''
      };

      this.chooseMapAppAndOpen({
        latitude: target.latitude,
        longitude: target.longitude,
        name: target.name || '目的地',
        address: target.address || ''
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
