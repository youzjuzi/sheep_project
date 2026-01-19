// pages/feature6/feature6.js
const videoStream = require('../../utils/videoStream.js');

Page({
  data: {
    // 监控列表
    monitors: [
      {
        id: 'monitor1',
        name: '一号监控',
        location: '一号羊圈',
        status: 'online', // online, offline, error
        sheepCount: 150,
        lastUpdate: '2024-03-15 10:30',
        icon: '/images/icons/function/f6.png'
      },
      {
        id: 'monitor2',
        name: '二号监控',
        location: '二号羊圈',
        status: 'online',
        sheepCount: 150,
        lastUpdate: '2024-03-15 10:28',
        icon: '/images/icons/function/f6.png'
      },
      {
        id: 'monitor3',
        name: '三号监控',
        location: '三号羊圈',
        status: 'online',
        sheepCount: 120,
        lastUpdate: '2024-03-15 10:25',
        icon: '/images/icons/function/f6.png'
      },
      {
        id: 'monitor4',
        name: '四号监控',
        location: '四号羊圈',
        status: 'offline',
        sheepCount: 180,
        lastUpdate: '2024-03-15 09:45',
        icon: '/images/icons/function/f6.png'
      }
    ],
    // 统计信息
    statistics: {
      totalMonitors: 4,
      onlineMonitors: 3,
      totalSheep: 600,
      lastUpdateTime: '2024-03-15 10:30'
    }
  },

  onLoad() {
    // 检查监控状态
    this.checkMonitorStatus();
    // 加载统计信息
    this.loadStatistics();
  },

  onShow() {
    // 页面显示时刷新状态
    this.checkMonitorStatus();
  },

  /**
   * 检查监控状态
   */
  async checkMonitorStatus() {
    const monitors = this.data.monitors;
    
    // 检查每个监控的配置是否存在
    for (let i = 0; i < monitors.length; i++) {
      const config = videoStream.getStreamConfig(monitors[i].id);
      if (config && config.enabled) {
        monitors[i].status = 'online';
      } else {
        monitors[i].status = 'offline';
      }
    }
    
    // 更新在线监控数量
    const onlineCount = monitors.filter(m => m.status === 'online').length;
    this.setData({
      monitors: monitors,
      'statistics.onlineMonitors': onlineCount
    });
  },

  /**
   * 加载统计信息
   */
  loadStatistics() {
    // 可以从后端API获取实时统计
    // const API = require('../../utils/api.js');
    // API.request('/api/monitor/statistics', 'GET')
    //   .then(res => {
    //     if (res.code === 0) {
    //       this.setData({
    //         statistics: res.data
    //       });
    //     }
    //   });
    
    // 目前使用本地计算
    const monitors = this.data.monitors;
    const totalSheep = monitors.reduce((sum, m) => sum + m.sheepCount, 0);
    
    this.setData({
      'statistics.totalSheep': totalSheep,
      'statistics.totalMonitors': monitors.length
    });
  },

  /**
   * 跳转到监控详情
   */
  goToMonitor(e) {
    const monitorId = e.currentTarget.dataset.id;
    const monitor = this.data.monitors.find(m => m.id === monitorId);
    
    if (!monitor) {
      wx.showToast({
        title: '监控不存在',
        icon: 'none'
      });
      return;
    }

    // 根据监控ID跳转到对应页面
    const pageMap = {
      'monitor1': '/pages/monitor/monitor1/monitor1',
      'monitor2': '/pages/monitor/monitor2/monitor2',
      'monitor3': '/pages/monitor/monitor3/monitor3',
      'monitor4': '/pages/monitor/monitor4/monitor4'
    };

    const url = pageMap[monitorId];
    if (url) {
      wx.navigateTo({
        url: url + '?monitorId=' + monitorId
      });
    }
  },

  /**
   * 刷新数据
   */
  refreshData() {
    wx.showLoading({
      title: '刷新中...',
      mask: true
    });

    Promise.all([
      this.checkMonitorStatus(),
      this.loadStatistics()
    ]).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    });
  },

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      'online': '在线',
      'offline': '离线',
      'error': '故障'
    };
    return statusMap[status] || '未知';
  },

  /**
   * 获取状态颜色
   */
  getStatusColor(status) {
    const colorMap = {
      'online': '#52c41a',
      'offline': '#999',
      'error': '#ff4d4f'
    };
    return colorMap[status] || '#999';
  }
});
