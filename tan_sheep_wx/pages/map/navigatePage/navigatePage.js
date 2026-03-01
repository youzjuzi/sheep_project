// pages/map/navigatePage/navigatePage.js
var QQMapWX = require('../../../utils/qqmap-wx-jssdk.js');

// 腾讯地图API配置
// 申请地址：https://lbs.qq.com/dev/console/application/mine
// 需要开启 WebServiceAPI 并在 "授权IP" 或 "域名白名单" 中添加 servicewechat.com
var TENCENT_MAP_KEY = 'IXHBZ-BHHKU-DHWVZ-BMAHF-BSXU3-YNBA3';

var qqmapsdk = new QQMapWX({ key: TENCENT_MAP_KEY });

Page({
  data: {
    longitude: 0,
    latitude: 0,
    polyline: [],
    markers: [],
    startText: '',
    endText: '',
    startLocation: null,
    endLocation: null,
    routeInfo: null,
    isLoading: false,
    travelMode: 'driving' // driving / walking / bicycling / transit
  },

  onLoad(options) {
    this.mapContext = wx.createMapContext('map', this);
    this.getCurrentLocation();

    if (options.start) {
      this.setData({ startText: decodeURIComponent(options.start) });
    }

    if (options.end) {
      var endName = decodeURIComponent(options.end);
      this.setData({ endText: endName });

      if (options.endLat && options.endLng) {
        this.setData({
          endLocation: {
            lat: parseFloat(options.endLat),
            lng: parseFloat(options.endLng),
            name: endName
          }
        });
        var that = this;
        setTimeout(function () { that.planRoute(); }, 500);
      } else {
        var that = this;
        setTimeout(function () { that.searchAndPlan(); }, 500);
      }
    }
  },

  /**
   * 获取当前位置
   */
  getCurrentLocation() {
    var that = this;
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: function (res) {
        that.setData({
          longitude: res.longitude,
          latitude: res.latitude
        });
        if (!that.data.startText) {
          that.setData({
            startText: '我的位置',
            startLocation: { lng: res.longitude, lat: res.latitude, name: '我的位置' }
          });
        }
        that.reverseGeocode(res.latitude, res.longitude);
      },
      fail: function () {
        wx.getLocation({
          type: 'gcj02',
          success: function (res) {
            that.setData({
              longitude: res.longitude,
              latitude: res.latitude
            });
            if (!that.data.startText) {
              that.setData({
                startText: '我的位置',
                startLocation: { lng: res.longitude, lat: res.latitude, name: '我的位置' }
              });
            }
          },
          fail: function () {
            that.setData({ longitude: 107.40541, latitude: 37.784595 });
            wx.showToast({ title: '定位失败，使用默认位置', icon: 'none' });
          }
        });
      }
    });
  },

  /**
   * 逆地理编码 - 坐标转地址
   */
  reverseGeocode(lat, lng) {
    var that = this;
    qqmapsdk.reverseGeocoder({
      location: lat + ',' + lng,
      success: function (res) {
        if (res.result && res.result.address) {
          console.log('当前地址:', res.result.address);
        }
      },
      fail: function (err) {
        console.warn('逆地理编码失败:', err);
      }
    });
  },

  /**
   * 搜索终点并规划路线
   */
  searchAndPlan() {
    var that = this;
    var endText = this.data.endText;
    if (!endText) {
      wx.showToast({ title: '请输入终点', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '搜索中...', mask: true });
    qqmapsdk.search({
      keyword: endText,
      region: '盐池县',
      success: function (res) {
        wx.hideLoading();
        if (res.data && res.data.length > 0) {
          var loc = res.data[0].location;
          that.setData({
            endLocation: { lat: loc.lat, lng: loc.lng, name: res.data[0].title }
          });
          that.planRoute();
        } else {
          wx.showToast({ title: '未找到终点', icon: 'none' });
        }
      },
      fail: function (err) {
        wx.hideLoading();
        console.error('搜索失败:', err);
        wx.showToast({ title: '搜索失败，请手动选择', icon: 'none' });
      }
    });
  },

  /**
   * 路线规划（腾讯地图API）
   */
  planRoute() {
    var that = this;
    var start = this.data.startLocation;
    var end = this.data.endLocation;
    
    if (!start || !end) {
      wx.showToast({ title: '请设置起点和终点', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true });
    wx.showLoading({ title: '规划路线中...', mask: true });

    var from = start.lat + ',' + start.lng;
    var to = end.lat + ',' + end.lng;

    qqmapsdk.direction({
      from: from,
      to: to,
      policy: 'LEAST_TIME',
      success: function (res) {
        wx.hideLoading();
        that.setData({ isLoading: false });

        if (!res.result || !res.result.routes || res.result.routes.length === 0) {
          wx.showToast({ title: '未找到路线', icon: 'none' });
          return;
        }

        var route = res.result.routes[0];
        var polyline = [];

        // 解码腾讯地图polyline（加密坐标）
        if (route.polyline && route.polyline.length > 0) {
          var coors = route.polyline;
          var pl = [];

          // 解码算法：腾讯地图使用了特殊的编码方式
          for (var i = 2; i < coors.length; i++) {
            coors[i] = coors[i - 2] + coors[i] / 1e6;
          }

          for (var i = 0; i < coors.length; i += 2) {
            pl.push({
              latitude: coors[i],
              longitude: coors[i + 1]
            });
          }

          polyline = [{
            points: pl,
            color: '#238E23',
            width: 6,
            arrowLine: true
          }];
        }

        that.setData({
          polyline: polyline,
          markers: [
            {
              id: 0,
              latitude: start.lat,
              longitude: start.lng,
              iconPath: '/images/icons/map/start.png',
              width: 30,
              height: 30,
              callout: {
                content: start.name,
                color: '#333',
                fontSize: 12,
                borderRadius: 4,
                bgColor: '#fff',
                padding: 8,
                display: 'ALWAYS'
              }
            },
            {
              id: 1,
              latitude: end.lat,
              longitude: end.lng,
              iconPath: '/images/icons/map/end.png',
              width: 30,
              height: 30,
              callout: {
                content: end.name,
                color: '#333',
                fontSize: 12,
                borderRadius: 4,
                bgColor: '#fff',
                padding: 8,
                display: 'ALWAYS'
              }
            }
          ],
          routeInfo: {
            distance: that.formatDistance(route.distance),
            duration: that.formatDuration(route.duration),
            distanceMeters: route.distance
          }
        });

        wx.showToast({ title: '路线规划成功', icon: 'success', duration: 1500 });
      },
      fail: function (err) {
        wx.hideLoading();
        that.setData({ isLoading: false });
        console.error('路线规划失败:', err);
        wx.showModal({
          title: '路线规划失败',
          content: '无法规划路线：' + (err.message || '未知错误') + '\n\n可点击"直接导航"按钮使用微信导航',
          confirmText: '直接导航',
          cancelText: '取消',
          success: function (res) {
            if (res.confirm) {
              that.directNavigation();
            }
          }
        });
      }
    });
  },

  /**
   * 直接导航（微信地图）
   */
  directNavigation() {
    var end = this.data.endLocation;
    if (!end) {
      wx.showToast({ title: '请先设置终点', icon: 'none' });
      return;
    }

    var systemInfo = wx.getSystemInfoSync();
    var isDevTools = systemInfo.platform === 'devtools';

    if (isDevTools) {
      wx.showModal({
        title: '开发者工具提示',
        content: '开发者工具无法打开真实导航。请在真机上测试。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    wx.openLocation({
      latitude: end.lat,
      longitude: end.lng,
      name: end.name || '目的地',
      address: end.name || '',
      scale: 18
    });
  },

  /**
   * 处理起点输入变化
   */
  handleStartInputChange(e) {
    this.setData({ startText: e.detail.value });
  },

  /**
   * 处理终点输入变化
   */
  handleEndInputChange(e) {
    this.setData({ endText: e.detail.value });
  },

  /**
   * 搜索地点并规划路线
   */
  searchLocations() {
    var that = this;
    var startText = this.data.startText.trim();
    var endText = this.data.endText.trim();

    if (!startText && !this.data.startLocation) {
      wx.showToast({ title: '请设置起点', icon: 'none' });
      return;
    }

    if (!endText && !this.data.endLocation) {
      wx.showToast({ title: '请设置终点', icon: 'none' });
      return;
    }

    // 如果已有坐标，直接规划路线
    if (this.data.startLocation && this.data.endLocation) {
      this.planRoute();
      return;
    }

    // 否则进行搜索
    this.searchAndPlan();
  },

  /**
   * 使用我的位置作为起点
   */
  useMyLocationAsStart() {
    var that = this;
    wx.showLoading({ title: '获取位置中...', mask: true });
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        wx.hideLoading();
        that.setData({
          startText: '我的位置',
          startLocation: { lng: res.longitude, lat: res.latitude, name: '我的位置' }
        });
        wx.showToast({ title: '已设置为起点', icon: 'success', duration: 1500 });
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '定位失败', icon: 'none' });
      }
    });
  },

  /**
   * 回到我的位置
   */
  backToMyLocation() {
    var that = this;
    wx.showLoading({ title: '定位中...', mask: true });
    wx.getLocation({
      type: 'gcj02',
      success: function (res) {
        wx.hideLoading();
        that.setData({
          longitude: res.longitude,
          latitude: res.latitude
        });
        if (that.mapContext) {
          that.mapContext.moveToLocation();
        }
        wx.showToast({ title: '已回到我的位置', icon: 'success', duration: 1500 });
      },
      fail: function () {
        wx.hideLoading();
        wx.showToast({ title: '定位失败', icon: 'none' });
      }
    });
  },

  /**
   * 选择起点位置
   */
  selectStartLocation() {
    var that = this;
    wx.chooseLocation({
      success: function (res) {
        that.setData({
          startText: res.name || res.address,
          startLocation: { lat: res.latitude, lng: res.longitude, name: res.name || '选择的位置' }
        });
        wx.showToast({ title: '起点已设置', icon: 'success', duration: 1500 });
      },
      fail: function (err) {
        console.error('选择位置失败:', err);
        wx.showToast({ title: '选择位置失败', icon: 'none' });
      }
    });
  },

  /**
   * 选择终点位置
   */
  selectEndLocation() {
    var that = this;
    wx.chooseLocation({
      success: function (res) {
        that.setData({
          endText: res.name || res.address,
          endLocation: { lat: res.latitude, lng: res.longitude, name: res.name || '选择的位置' }
        });
        wx.showToast({ title: '终点已设置', icon: 'success', duration: 1500 });
      },
      fail: function (err) {
        console.error('选择位置失败:', err);
        wx.showToast({ title: '选择位置失败', icon: 'none' });
      }
    });
  },

  /**
   * 清空路线
   */
  clearRoute() {
    this.setData({
      polyline: [],
      markers: [],
      routeInfo: null,
      startText: '',
      endText: '',
      startLocation: null,
      endLocation: null
    });
  },

  /**
   * 格式化距离
   */
  formatDistance(meters) {
    if (!meters) return '';
    if (meters < 1000) return meters + '米';
    return (meters / 1000).toFixed(2) + '公里';
  },

  /**
   * 格式化时间
   */
  formatDuration(seconds) {
    if (!seconds) return '';
    if (seconds < 60) return seconds + '秒';
    if (seconds < 3600) return Math.floor(seconds / 60) + '分钟';
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    return h + '小时' + m + '分钟';
  },

  /**
   * 拉下刷新
   */
  onPullDownRefresh() {
    this.getCurrentLocation();
    wx.stopPullDownRefresh();
  }
});
