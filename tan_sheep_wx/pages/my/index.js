// pages/my/index.js - 重新设计版
const AUTH = require('../../utils/auth');
const API = require('../../utils/api.js');

Page({
  data: {
    userinfo: {},
    apiUserInfoMap: null,
    balance: '0.00',
    freeze: '0.00',
    score: 0,
    couponCount: 0,
    adoptedCount: 0,
    
    // 核心功能入口（2x4网格）
    coreFunctions: [
      {
        text: '我的订单',
        icon: 'orders-o',
        bgColor: '#FCE4EC',
        iconColor: '#E91E63',
        url: '/packageOrder/cart/history/index',
        type: 'order',
        badge: ''
      },
      {
        text: '优惠券',
        icon: 'coupon-o',
        bgColor: '#FFEBEE',
        iconColor: '#F44336',
        url: '/packageUser/my/youhui/youhui',
        type: 'coupon',
        badge: ''
      },
      {
        text: '个人中心',
        icon: 'user-o',
        bgColor: '#E6F5ED',
        iconColor: '#238E23',
        url: '/packageUser/my/info',
        type: 'profile',
        badge: ''
      },
      {
        text: '我的关注',
        icon: 'like-o',
        bgColor: '#FFF3E0',
        iconColor: '#FF9800',
        url: '/packageUser/my/follows/index',
        type: 'follows',
        badge: ''
      },
      {
        text: '智能问答',
        icon: 'service-o',
        bgColor: '#E0F7FA',
        iconColor: '#2196F3',
        url: '/pages/qa/index',
        type: 'qa_page',
        badge: ''
      }
    ],
    
    // 服务与工具区（列表形式）
    toolsMenus: [
      {
        text: '意见反馈',
        icon: 'chat-o',
        color: '#666666',
        url: '/pages/my/feedback',
        type: 'feedback'
      },
      {
        text: '关于我们',
        icon: 'info-o',
        color: '#666666',
        url: '',
        type: 'about'
      },
      {
        text: '设置',
        icon: 'setting-o',
        color: '#666666',
        url: '/pages/my/setting',
        type: 'setting'
      }
    ],
    
    nickShow: false,
    newNick: '',
    // 移除申请养殖户相关状态
  },

  onLoad() {
    this.loadUserData();
  },

  onShow() {
    this.loadUserData();
    this.refreshUserInfo();
    
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      // 确保tabBar已初始化
      tabBar.initTabBar();
      // 等待tabBar数据更新
      setTimeout(() => {
        if (tabBar.data.list && tabBar.data.list.length > 0) {
          const index = tabBar.data.list.findIndex(item => item.pagePath === "/pages/my/index");
          if (index > -1) {
            tabBar.setData({ selected: index });
          }
        }
      }, 100);
    }
  },

  loadUserData() {
    var balance = wx.getStorageSync('balance') || '0.00';
    var score = wx.getStorageSync('score') || 0;
    var couponCount = wx.getStorageSync('couponCount') || 0;
    var adoptedCount = wx.getStorageSync('adoptedCount') || 0;
    var apiUserInfoMap = wx.getStorageSync('apiUserInfoMap') || null;

    this.setData({
      balance: balance,
      score: score,
      couponCount: couponCount,
      adoptedCount: adoptedCount,
      apiUserInfoMap: apiUserInfoMap
    });
    this.updateCoreBadges();

    var token = wx.getStorageSync('token');
    if (token) {
      this.getUserApiInfo();
    }
  },

  async refreshUserInfo() {
    var token = wx.getStorageSync('token');
    if (token) {
      await this.getUserApiInfo();
    } else {
      this.setData({ apiUserInfoMap: null });
    }
  },

  async getUserApiInfo() {
    var token = wx.getStorageSync('token');
    if (token) {
      try {
        const res = await API.getUserInfo(token);
        if (res.code === 0) {
          const info = res.data;
          
          var userInfoMap = {
            base: {
              id: info.id || '',
              nick: info.nickname || info.username || '未设置昵称',
              avatarUrl: info.avatar_url || '',
              mobile: info.mobile || '',
              username: info.username || '',
              role: info.role || 0,
              is_verified: info.is_verified || false
            }
          };

          wx.setStorageSync('apiUserInfoMap', userInfoMap);

          var realBalance = info.balance !== undefined ? parseFloat(info.balance).toFixed(2) : '0.00';
          var realScore = info.score !== undefined ? parseInt(info.score) : 0;
          var realCouponCount = info.coupon_count !== undefined ? parseInt(info.coupon_count) : 0;
          var realAdoptedCount = info.adopted_count !== undefined ? parseInt(info.adopted_count) : 0;

          wx.setStorageSync('balance', realBalance);
          wx.setStorageSync('score', realScore);
          wx.setStorageSync('couponCount', realCouponCount);
          wx.setStorageSync('adoptedCount', realAdoptedCount);

          this.setData({
            apiUserInfoMap: userInfoMap,
            userinfo: userInfoMap.base,
            balance: realBalance,
            score: realScore,
            couponCount: realCouponCount,
            adoptedCount: realAdoptedCount
          });
          this.updateCoreBadges();
        }
      } catch (e) {
        console.error('获取用户信息失败', e);
      }
    }
  },

  updateCoreBadges() {
    var adoptedCount = parseInt(this.data.adoptedCount || 0);
    var couponCount = parseInt(this.data.couponCount || 0);
    var newCore = (this.data.coreFunctions || []).map(item => {
      var badge = item.badge || '';
      if (item.type === 'adopt') {
        badge = adoptedCount > 0 ? (adoptedCount + '') : '';
      } else if (item.type === 'coupon') {
        badge = couponCount > 0 ? (couponCount + '') : '';
      }
      return { ...item, badge };
    });
    this.setData({ coreFunctions: newCore });
  },

  handleFunctionTap(e) {
    var url = e.currentTarget.dataset.url;
    var type = e.currentTarget.dataset.type;
    
    if (url && url !== '') {
      wx.navigateTo({ url: url });
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  },

  handleToolTap(e) {
    var url = e.currentTarget.dataset.url;
    var type = e.currentTarget.dataset.type;
    
    if (type === 'about') {
      this.showAboutDialog();
    } else if (url && url !== '') {
      wx.navigateTo({ url: url });
    }
  },

  showAboutDialog() {
    wx.showModal({
      title: '关于我们',
      content: '滩羊智品小程序\n版本：1.0.0\n\n致力于提供优质的滩羊产品和服务\n\n隐私政策：本平台严格保护用户隐私，不会泄露任何个人信息。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  goAsset() {
    wx.navigateTo({
      url: "/packageWallet/asset/index"
    });
  },

  login() {
    wx.navigateTo({
      url: '/pages/login/index'
    });
  },

  async onChooseAvatar(e) {
    var avatarUrl = e.detail.avatarUrl;
    var token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在上传' });

    try {
      var extMatch = avatarUrl.match(/\.([^.]+)$/);
      var ext = extMatch ? '.' + extMatch[1].toLowerCase() : '.jpg';
      var contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

      const signRes = await API.getAvatarUploadUrl(token, ext, contentType);
      if (signRes.code !== 0) {
        throw new Error(signRes.msg || '获取上传链接失败');
      }

      const { upload_url, object_key } = signRes.data;

      const fs = wx.getFileSystemManager();
      const fileData = await new Promise((resolve, reject) => {
        fs.readFile({
          filePath: avatarUrl,
          success: (res) => resolve(res.data),
          fail: (err) => reject(new Error('读取文件失败'))
        });
      });

      await new Promise((resolve, reject) => {
        wx.request({
          url: upload_url,
          method: 'PUT',
          data: fileData,
          header: {
            'Content-Type': contentType
          },
          success: (res) => {
            if (res.statusCode === 200) resolve();
            else reject(new Error('直传 R2 失败'));
          },
          fail: (err) => reject(new Error('直传请求失败'))
        });
      });

      const confirmRes = await API.confirmAvatarUpload(token, object_key);
      if (confirmRes.code !== 0) {
        throw new Error(confirmRes.msg || '确认上传失败');
      }

      var updatedUser = confirmRes.data;
      var apiUserInfoMap = this.data.apiUserInfoMap || {};
      var updatedApiUserInfoMap = {};
      for (var key in apiUserInfoMap) {
        if (apiUserInfoMap.hasOwnProperty(key)) {
          updatedApiUserInfoMap[key] = apiUserInfoMap[key];
        }
      }
      var baseObj = apiUserInfoMap.base || {};
      updatedApiUserInfoMap.base = {};
      for (var key2 in baseObj) {
        if (baseObj.hasOwnProperty(key2)) {
          updatedApiUserInfoMap.base[key2] = baseObj[key2];
        }
      }

      updatedApiUserInfoMap.base.avatarUrl = updatedUser.avatar_url;

      this.setData({
        apiUserInfoMap: updatedApiUserInfoMap
      });
      wx.setStorageSync('apiUserInfoMap', updatedApiUserInfoMap);

      var storedInfo = wx.getStorageSync('userInfo') || {};
      storedInfo.avatar_url = updatedUser.avatar_url;
      wx.setStorageSync('userInfo', storedInfo);

      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '上传失败', icon: 'none' });
      console.error('头像上传错误:', error);
    }
  },

  copyUid() {
    wx.setClipboardData({
      data: this.data.apiUserInfoMap.base.id + '',
      success: () => {
        wx.showToast({
          title: '用户ID已复制',
          icon: 'success'
        });
      }
    });
  },

  editNick() {
    this.setData({
      nickShow: true,
      newNick: this.data.apiUserInfoMap.base.nick || ''
    });
  },

  onNickInput(e) {
    this.setData({
      newNick: e.detail.value
    });
  },

  onNickBlur(e) {
    if (e.detail.value) {
      this.setData({
        newNick: e.detail.value
      });
    }
  },

  async saveNick() {
    var newNick = this.data.newNick.trim();
    if (!newNick) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      return;
    }

    var token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中' });

    try {
      const res = await API.updateUserInfo(token, newNick);
      if (res.code !== 0) {
        throw new Error(res.msg || '更新昵称失败');
      }

      var updatedUser = res.data;
      var apiUserInfoMap = this.data.apiUserInfoMap || {};

      var updatedApiUserInfoMap = {};
      for (var key in apiUserInfoMap) {
        if (apiUserInfoMap.hasOwnProperty(key)) {
          updatedApiUserInfoMap[key] = apiUserInfoMap[key];
        }
      }
      var baseObj = apiUserInfoMap.base || {};
      updatedApiUserInfoMap.base = {};
      for (var key2 in baseObj) {
        if (baseObj.hasOwnProperty(key2)) {
          updatedApiUserInfoMap.base[key2] = baseObj[key2];
        }
      }

      updatedApiUserInfoMap.base.nick = updatedUser.nickname;

      this.setData({
        apiUserInfoMap: updatedApiUserInfoMap,
        userinfo: updatedApiUserInfoMap.base,
        nickShow: false,
        newNick: ''
      });

      wx.setStorageSync('apiUserInfoMap', updatedApiUserInfoMap);

      var storedInfo = wx.getStorageSync('userInfo') || {};
      storedInfo.nickname = updatedUser.nickname;
      wx.setStorageSync('userInfo', storedInfo);

      wx.hideLoading();
      wx.showToast({ title: '昵称已更新', icon: 'success' });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '保存失败', icon: 'none' });
    }
  },

  cancelEditNick() {
    this.setData({
      nickShow: false,
      newNick: ''
    });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('uid');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('apiUserInfoMap');

          this.setData({
            apiUserInfoMap: null,
            userinfo: {}
          });

          wx.showToast({ title: '已退出登录', icon: 'success' });
        }
      }
    });
  }
});

