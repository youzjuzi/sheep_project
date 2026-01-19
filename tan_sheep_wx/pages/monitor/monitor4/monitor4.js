// pages/feature6/monitor4/monitor4.js
const videoStream = require('../../../utils/videoStream.js');

Page({
  data: {
    monitorId: 'monitor4',
    monitorName: '四号监控',
    streamUrl: '', // 视频流地址
    streamConfig: null, // 视频流配置
    isLoading: true, // 是否正在加载
    loadError: false, // 是否加载错误
    errorMessage: '', // 错误信息
    videoContext: null, // 视频上下文
    // 羊圈信息
    sheepInfo: {
      total: 180,
      ageDistribution: {
        newborn: { label: '新生羔羊（0 - 3 个月）', percentage: 12 },
        young: { label: '年轻成年羊（3 - 12 个月）', percentage: 38 },
        adult: { label: '成年羊（1 - 5 岁）', percentage: 38 },
        old: { label: '老年羊（5 岁以上）', percentage: 12 }
      },
      health: '羊只健康状况良好，无异常',
      activity: '羊群活动正常，进食良好',
      environment: '温度适宜，湿度正常，通风良好',
      breeding: '有部分母羊处于怀孕期，需要特别关注'
    }
  },

  onLoad(options) {
    // 从options获取监控ID，如果没有则使用默认值
    const monitorId = options.monitorId || 'monitor4';
    this.setData({
      monitorId: monitorId
    });
    
    // 加载视频流
    this.loadVideoStream();
    
    // 加载羊圈信息（可以从后端API获取）
    this.loadSheepInfo();
  },

  onReady() {
    // 创建视频上下文
    this.videoContext = wx.createVideoContext('monitor-video', this);
  },

  onShow() {
    // 页面显示时，如果视频已加载，尝试播放
    if (this.data.streamUrl && !this.data.loadError) {
      this.playVideo();
    }
  },

  onHide() {
    // 页面隐藏时暂停视频
    this.pauseVideo();
  },

  onUnload() {
    // 页面卸载时停止视频
    this.stopVideo();
  },

  /**
   * 加载视频流
   */
  async loadVideoStream() {
    try {
      this.setData({
        isLoading: true,
        loadError: false,
        errorMessage: ''
      });

      // 获取视频流配置
      const config = await videoStream.fetchStreamFromAPI(this.data.monitorId);
      if (!config) {
        throw new Error('未找到监控配置');
      }

      this.setData({
        monitorName: config.name,
        streamConfig: config
      });

      // 获取可用的视频流地址
      const streamUrl = await videoStream.getAvailableStreamUrl(this.data.monitorId);
      const formattedUrl = videoStream.formatStreamUrl(streamUrl);

      this.setData({
        streamUrl: formattedUrl,
        isLoading: false,
        loadError: false
      });

      console.log('视频流加载成功:', formattedUrl);
      
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

  /**
   * 加载羊圈信息（可以从后端API获取）
   */
  async loadSheepInfo() {
    try {
      // 这里可以从后端API获取实时数据
      // const API = require('../../../utils/api.js');
      // const res = await API.request(`/api/monitor/info/${this.data.monitorId}`, 'GET');
      // if (res.code === 0) {
      //   this.setData({
      //     sheepInfo: res.data
      //   });
      // }
      
      // 目前使用模拟数据
      console.log('羊圈信息加载完成');
    } catch (error) {
      console.error('加载羊圈信息失败:', error);
    }
  },

  /**
   * 播放视频
   */
  playVideo() {
    if (this.videoContext) {
      this.videoContext.play();
    }
  },

  /**
   * 暂停视频
   */
  pauseVideo() {
    if (this.videoContext) {
      this.videoContext.pause();
    }
  },

  /**
   * 停止视频
   */
  stopVideo() {
    if (this.videoContext) {
      this.videoContext.stop();
    }
  },

  /**
   * 视频播放事件
   */
  onVideoPlay() {
    console.log('视频开始播放');
    this.setData({
      isLoading: false
    });
  },

  /**
   * 视频错误事件
   */
  onVideoError(e) {
    console.error('视频播放错误:', e.detail);
    
    // 检查是否是HTTP协议问题
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
    
    // 尝试使用fallback地址
    this.tryFallbackStream();
  },

  /**
   * 尝试使用fallback视频流
   */
  async tryFallbackStream() {
    try {
      const config = this.data.streamConfig;
      if (!config || !config.fallbackUrls || config.fallbackUrls.length === 0) {
        return;
      }

      // 尝试下一个fallback地址
      for (let i = 0; i < config.fallbackUrls.length; i++) {
        const url = config.fallbackUrls[i];
        const formattedUrl = videoStream.formatStreamUrl(url);
        
        // 检查是否可用
        const available = await videoStream.checkStreamAvailable(formattedUrl);
        if (available) {
          this.setData({
            streamUrl: formattedUrl,
            loadError: false,
            errorMessage: ''
          });
          console.log('使用fallback视频流:', formattedUrl);
          return;
        }
      }
    } catch (error) {
      console.error('尝试fallback视频流失败:', error);
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

    // 重新加载视频流和羊圈信息
    Promise.all([
      this.loadVideoStream(),
      this.loadSheepInfo()
    ]).then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
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
   * 视频加载中
   */
  onVideoWaiting() {
    console.log('视频加载中...');
    this.setData({
      isLoading: true
    });
  },

  /**
   * 视频加载完成
   */
  onVideoLoaded() {
    console.log('视频加载完成');
    this.setData({
      isLoading: false
    });
  }
});
