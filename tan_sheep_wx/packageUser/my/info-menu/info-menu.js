// personal-profile.js
const app = getApp();

Page({
  /**
   * 页面的初始数据
   */
  data: {
    statusBarHeight: app.globalData.statusBarHeight,
    userInfo: {
      avatarUrl: '',
      nickName: '',
      bio: '',
      birthday: '',
      gender: '',
      address: '',
    },
    genders: ['男', '女', '其他'],
    provinces: [], // 省份列表
    cities: [], // 城市列表
    counties: [], // 区县列表
    selectedProvince: '',
    selectedCity: '',
    selectedCounty: '',
    detailAddress: '',
    completeAddress: '',
    historyAddresses: [], // 历史地址列表
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 从本地存储读取用户信息
    const userInfo = wx.getStorageSync('userInfo') || {
      avatarUrl: '',
      nickName: '',
      bio: '',
      birthday: '',
      gender: '',
      address: '',
    };
    const historyAddresses = wx.getStorageSync('historyAddresses') || [];
    this.setData({
      userInfo,
      historyAddresses,
    });

    // 初始化省份数据
    this.initProvinces();
  },

  /**
   * 初始化省份列表（可以根据实际需求从API获取）
   */
  initProvinces() {
    const provinces = [
      '北京市',
      '上海市',
      '广东省',
      // ...其他省份
    ];
    this.setData({
      provinces,
    });
  },

  /**
   * 省份选择改变事件
   */
  onProvinceChange(e) {
    const province = this.data.provinces[e.detail.value];
    this.setData({
      selectedProvince: province,
      selectedCity: '',
      selectedCounty: '',
      cities: [],
      counties: [],
      completeAddress: '',
    });
    // 根据省份获取城市列表（模拟）
    const cities = this.getCitiesByProvince(province);
    this.setData({
      cities,
    });
  },

  /**
   * 获取城市列表（根据省份）
   */
  getCitiesByProvince(province) {
    const cityData = {
      '北京市': ['北京市'],
      '上海市': ['上海市'],
      '广东省': ['广州市', '深圳市', '珠海市'],
      // ...其他省份的城市
    };
    return cityData[province] || [];
  },

  /**
   * 城市选择改变事件
   */
  onCityChange(e) {
    const city = this.data.cities[e.detail.value];
    this.setData({
      selectedCity: city,
      selectedCounty: '',
      counties: [],
      completeAddress: '',
    });
    // 根据城市获取区县列表（模拟）
    const counties = this.getCountiesByCity(city);
    this.setData({
      counties,
    });
  },

  /**
   * 获取区县列表（根据城市）
   */
  getCountiesByCity(city) {
    const countyData = {
      '北京市': ['东城区', '西城区', '朝阳区', '海淀区'],
      '上海市': ['黄浦区', '徐汇区', '长宁区', '静安区'],
      '广州市': ['天河区', '越秀区', '海珠区'],
      '深圳市': ['福田区', '罗湖区', '南山区'],
      '珠海市': ['香洲区', '斗门区'],
      // ...其他城市的区县
    };
    return countyData[city] || [];
  },

  /**
   * 区县选择改变事件
   */
  onCountyChange(e) {
    const county = this.data.counties[e.detail.value];
    this.setData({
      selectedCounty: county,
    });
    this.updateCompleteAddress();
  },

  /**
   * 详细地址输入事件
   */
  onDetailInput(e) {
    const detailAddress = e.detail.value;
    this.setData({
      detailAddress,
    });
    this.updateCompleteAddress();
  },

  /**
   * 更新完整地址
   */
  updateCompleteAddress() {
    const { selectedProvince, selectedCity, selectedCounty, detailAddress } = this.data;
    if (selectedProvince && selectedCity && selectedCounty && detailAddress) {
      const completeAddress = `${selectedProvince} ${selectedCity} ${selectedCounty} ${detailAddress}`;
      this.setData({
        completeAddress,
      });
    } else {
      this.setData({
        completeAddress: '',
      });
    }
  },

  /**
   * 选择历史地址事件
   */
  onSelectHistoryAddress(e) {
    const index = e.detail.value;
    const selectedAddress = this.data.historyAddresses[index];
    this.setData({
      userInfo: {
        ...this.data.userInfo,
        address: selectedAddress,
      },
      selectedProvince: '',
      selectedCity: '',
      selectedCounty: '',
      cities: [],
      counties: [],
      detailAddress: '',
      completeAddress: selectedAddress,
    });
  },

  /**
   * 头像选择事件
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'userInfo.avatarUrl': avatarUrl,
    });
  },

  /**
   * 昵称输入事件
   */
  onNicknameInput(e) {
    const nickName = e.detail.value;
    this.setData({
      'userInfo.nickName': nickName,
    });
  },

  /**
   * 个人简介输入事件
   */
  onBioInput(e) {
    const bio = e.detail.value;
    this.setData({
      'userInfo.bio': bio,
    });
  },

  /**
   * 生日选择改变事件
   */
  onBirthdayChange(e) {
    const birthday = e.detail.value;
    this.setData({
      'userInfo.birthday': birthday,
    });
  },

  /**
   * 性别选择改变事件
   */
  onGenderChange(e) {
    const gender = this.data.genders[e.detail.value];
    this.setData({
      'userInfo.gender': gender,
    });
  },

  /**
   * 保存地址事件
   */
  saveAddress() {
    const { completeAddress } = this.data;
    if (!completeAddress) {
      wx.showToast({
        title: '请完善地址信息',
        icon: 'none',
      });
      return;
    }

    // 更新用户地址
    this.setData({
      'userInfo.address': completeAddress,
    });

    // 添加到历史地址（避免重复）
    let historyAddresses = this.data.historyAddresses;
    if (!historyAddresses.includes(completeAddress)) {
      historyAddresses.unshift(completeAddress);
      // 保持历史地址不超过10个
      if (historyAddresses.length > 10) {
        historyAddresses.pop();
      }
      this.setData({
        historyAddresses,
      });
      wx.setStorageSync('historyAddresses', historyAddresses);
    }

    wx.setStorageSync('userInfo', this.data.userInfo);

    wx.showToast({
      title: '地址已保存',
      icon: 'success',
    });
  },

  /**
   * 提交个人资料事件
   */
  submitProfile() {
    const { userInfo } = this.data;
    if (!userInfo.nickName) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none',
      });
      return;
    }
    if (!userInfo.address) {
      wx.showToast({
        title: '地址不能为空',
        icon: 'none',
      });
      return;
    }

    // 保存用户信息到本地存储
    wx.setStorageSync('userInfo', userInfo);

    wx.showToast({
      title: '个人资料已保存',
      icon: 'success',
    });
  },
});
