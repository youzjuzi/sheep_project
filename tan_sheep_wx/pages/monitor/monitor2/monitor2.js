// pages/feature6/monitor2/monitor2.js
const videoStream = require('../../../utils/videoStream.js');

Page({
  data: {
    monitorId: 'monitor2',
    monitorName: '二号监控',
    streamUrl: '',
    streamConfig: null,
    isLoading: true,
    loadError: false,
    errorMessage: '',
    videoContext: null,
    sheepInfo: {
      total: 150,
      ageDistribution: {
        newborn: { label: '新生羔羊（0 - 3 个月）', percentage: 10 },
        young: { label: '年轻成年羊（3 - 12 个月）', percentage: 40 },
        adult: { label: '成年羊（1 - 5 岁）', percentage: 40 },
        old: { label: '老年羊（5 岁以上）', percentage: 10 }
      },
      health: '大部分羊只健康状况良好',
      activity: '羊群在羊圈内自由活动',
      environment: '温度适宜，通风良好',
      breeding: '有几只母羊处于怀孕期'
    }
  },

  onLoad(options) {
    const monitorId = options.monitorId || 'monitor2';
    this.setData({ monitorId: monitorId });
    this.loadVideoStream();
    this.loadSheepInfo();
  },

  onReady() {
    this.videoContext = wx.createVideoContext('monitor-video', this);
  },

  onShow() {
    if (this.data.streamUrl && !this.data.loadError) {
      this.playVideo();
    }
  },

  onHide() {
    this.pauseVideo();
  },

  onUnload() {
    this.stopVideo();
  },

  async loadVideoStream() {
    try {
      this.setData({ isLoading: true, loadError: false, errorMessage: '' });
      const config = await videoStream.fetchStreamFromAPI(this.data.monitorId);
      if (!config) throw new Error('未找到监控配置');
      this.setData({ monitorName: config.name, streamConfig: config });
      const streamUrl = await videoStream.getAvailableStreamUrl(this.data.monitorId);
      const formattedUrl = videoStream.formatStreamUrl(streamUrl);
      this.setData({ streamUrl: formattedUrl, isLoading: false, loadError: false });
      
      // 检查是否是HTTP协议
      if (formattedUrl.startsWith('http://')) {
        console.warn('警告：视频流使用HTTP协议，正式环境需要HTTPS');
        wx.showModal({
          title: '协议提示',
          content: '当前视频流使用HTTP协议，正式环境需要HTTPS。\n\n在开发者工具中，请开启"不校验合法域名"来测试。',
          showCancel: false
        });
      }
    } catch (error) {
      console.error('视频流加载失败:', error);
      let errorMsg = error.message || '视频流加载失败，请检查网络连接';
      
      if (errorMsg.includes('HTTP') || errorMsg.includes('协议')) {
        errorMsg = '视频流加载失败\n\n原因：视频流使用HTTP协议\n\n解决方案：\n1. 将视频流服务器配置为HTTPS\n2. 或在开发者工具中开启"不校验合法域名"';
      }
      
      this.setData({
        isLoading: false,
        loadError: true,
        errorMessage: errorMsg
      });
    }
  },

  async loadSheepInfo() {
    // 可以从后端API获取实时数据
  },

  playVideo() {
    if (this.videoContext) this.videoContext.play();
  },

  pauseVideo() {
    if (this.videoContext) this.videoContext.pause();
  },

  stopVideo() {
    if (this.videoContext) this.videoContext.stop();
  },

  onVideoPlay() {
    this.setData({ isLoading: false });
  },

  onVideoError(e) {
    console.error('视频播放错误:', e.detail);
    const streamUrl = this.data.streamUrl || '';
    let errorMsg = '视频播放失败，请检查视频流地址或网络连接';
    
    if (streamUrl.startsWith('http://')) {
      errorMsg = '视频流使用HTTP协议，微信小程序不支持\n\n解决方案：\n1. 将视频流服务器配置为HTTPS\n2. 或在开发者工具中开启"不校验合法域名"\n3. 当前地址：' + streamUrl;
    }
    
    this.setData({
      loadError: true,
      errorMessage: errorMsg,
      isLoading: false
    });
    this.tryFallbackStream();
  },

  async tryFallbackStream() {
    try {
      const config = this.data.streamConfig;
      if (!config || !config.fallbackUrls || config.fallbackUrls.length === 0) return;
      for (let i = 0; i < config.fallbackUrls.length; i++) {
        const url = config.fallbackUrls[i];
        const formattedUrl = videoStream.formatStreamUrl(url);
        const available = await videoStream.checkStreamAvailable(formattedUrl);
        if (available) {
          this.setData({ streamUrl: formattedUrl, loadError: false, errorMessage: '' });
          return;
        }
      }
    } catch (error) {
      console.error('尝试fallback视频流失败:', error);
    }
  },

  refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true });
    Promise.all([this.loadVideoStream(), this.loadSheepInfo()]).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '刷新成功', icon: 'success' });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '刷新失败', icon: 'none' });
    });
  },

  onVideoWaiting() {
    this.setData({ isLoading: true });
  },

  onVideoLoaded() {
    this.setData({ isLoading: false });
  }
});
