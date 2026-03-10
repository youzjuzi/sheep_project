const API = require('../../utils/api')

Page({
  data: {
    avatarUrl: '',
    nickname: '',
    description: '',
    birthday: '',
    gender: '',
    genderArray: ['保密', '男性', '女性'],
    genderIndex: 0,
    mobile: '',
    isUploadingAvatar: false
  },

  onLoad() {
    this.fetchUserProfile()
  },

  bindMobile() {
    this.setData({
      bindMobileShow: true
    })
  },

  bindMobileOk(e) {
    console.log('绑定手机号完成:', e.detail);
    this.setData({
      bindMobileShow: false
    })
    this.fetchUserProfile()
  },

  bindMobileCancel() {
    this.setData({
      bindMobileShow: false
    })
  },

  async fetchUserProfile() {
    const token = wx.getStorageSync('token');
    if (!token) return;
    try {
      const res = await API.getUserProfile(token);
      if (res.code === 0) {
        const info = res.data;
        this.setData({
          avatarUrl: info.avatar_url,
          nickname: info.nickname || '',
          description: info.description || '',
          birthday: info.birthday || '',
          genderIndex: info.gender || 0,
          gender: this.data.genderArray[info.gender || 0],
          mobile: info.mobile || ''
        });

        // 基础信息兜底
        let storedInfo = wx.getStorageSync('userInfo') || {};
        storedInfo.nickname = info.nickname;
        storedInfo.gender = info.gender;
        storedInfo.avatar_url = info.avatar_url;
        wx.setStorageSync('userInfo', storedInfo);
      }
    } catch (e) {
      console.error(e);
    }
  },

  async onChooseAvatar(e) {
    const avatarUrl = e.detail.avatarUrl;
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在上传' });
    this.setData({ isUploadingAvatar: true });

    try {
      // 1. 获取预签名 URL
      const extMatch = avatarUrl.match(/\.([^.]+)$/);
      const ext = extMatch ? '.' + extMatch[1].toLowerCase() : '.jpg';
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

      const signRes = await API.getAvatarUploadUrl(token, ext, contentType);
      if (signRes.code !== 0) throw new Error(signRes.msg || '获取上传链接失败');

      const { upload_url, object_key } = signRes.data;

      // 2. 读取文件
      const fs = wx.getFileSystemManager();
      const fileData = await new Promise((resolve, reject) => {
        fs.readFile({
          filePath: avatarUrl,
          success: (res) => resolve(res.data),
          fail: (err) => reject(new Error('读取文件失败'))
        });
      });

      // 3. PUT 请求直传到 R2
      await new Promise((resolve, reject) => {
        wx.request({
          url: upload_url,
          method: 'PUT',
          data: fileData,
          header: { 'Content-Type': contentType },
          success: (res) => {
            if (res.statusCode === 200) resolve();
            else reject(new Error('直传失败, 状态码: ' + res.statusCode));
          },
          fail: (err) => reject(new Error('上传请求失败'))
        });
      });

      // 4. 确认上传并更新个人资料
      const confirmRes = await API.confirmAvatarUpload(token, object_key);
      if (confirmRes.code !== 0) throw new Error(confirmRes.msg || '确认上传失败');

      // 5. 更新页面
      this.setData({ avatarUrl: confirmRes.data.avatar_url });

      let storedInfo = wx.getStorageSync('userInfo') || {};
      storedInfo.avatar_url = confirmRes.data.avatar_url;
      wx.setStorageSync('userInfo', storedInfo);

      // 更新我的页面使用的 apiUserInfoMap.base.avatarUrl
      let apiUserMap = wx.getStorageSync('apiUserInfoMap') || { base: {} };
      if (!apiUserMap.base) apiUserMap.base = {};
      apiUserMap.base.avatarUrl = confirmRes.data.avatar_url;
      wx.setStorageSync('apiUserInfoMap', apiUserMap);

      wx.hideLoading();
      wx.showToast({ title: '头像已更新', icon: 'success' });

    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '上传失败', icon: 'none' });
    } finally {
      this.setData({ isUploadingAvatar: false });
    }
  },

  onNickInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onNickBlur(e) {
    if (e.detail.value) {
      this.setData({ nickname: e.detail.value });
    }
  },

  onDescInput(e) {
    this.setData({ description: e.detail.value });
  },

  onDescBlur(e) {
    this.setData({ description: e.detail.value });
  },

  bindBirthdayChange(e) {
    this.setData({ birthday: e.detail.value });
  },

  bindPickerChange(e) {
    const idx = parseInt(e.detail.value, 10);
    this.setData({
      genderIndex: idx,
      gender: this.data.genderArray[idx]
    });
  },

  async saveProfile() {
    const token = wx.getStorageSync('token');
    const { nickname, genderIndex, description, birthday } = this.data;

    wx.showLoading({ title: '保存中' });
    try {
      const res = await API.updateUserInfo(token, {
        nickname: nickname,
        gender: genderIndex,
        description: description,
        birthday: birthday
      });

      if (res.code !== 0) throw new Error(res.msg || '保存失败');

      // 同步到本地缓存
      let storedInfo = wx.getStorageSync('userInfo') || {};
      storedInfo.nickname = res.data.nickname;
      storedInfo.gender = res.data.gender;
      wx.setStorageSync('userInfo', storedInfo);

      let apiUserMap = wx.getStorageSync('apiUserInfoMap') || { base: {} };
      if (!apiUserMap.base) apiUserMap.base = {};
      apiUserMap.base.nick = res.data.nickname;
      apiUserMap.base.gender = res.data.gender;
      wx.setStorageSync('apiUserInfoMap', apiUserMap);

      wx.hideLoading();
      wx.showToast({ title: '资料已保存', icon: 'success' });

      setTimeout(() => {
        wx.navigateBack();
      }, 1000);

    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '保存报错', icon: 'none' });
    }
  }
})