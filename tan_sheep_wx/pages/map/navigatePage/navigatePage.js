// pages/feature3/navigatePage/navigatePage.js
const app = getApp();

// 百度地图API配置
// ⚠️ 重要：如果API被禁用，请检查以下配置
// 1. 登录 https://lbsyun.baidu.com/ 检查API密钥状态
// 2. 确认服务已启用（Place API、Geocoding API、Direction API）
// 3. 检查白名单配置（添加 servicewechat.com）
// 4. 查看配额是否用完
// 5. 如果问题持续，申请自己的API密钥并替换下面的AK
const BAIDU_MAP_AK = 'vVURIWCDRuHFMtFGxttSepBIgvm4OWGn';

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
    routeInfo: null, // 路线信息（距离、时间等）
    isLoading: false,
    mapContext: null,
    apiDisabled: true // 默认禁用API，直接使用微信导航（避免频繁错误提示）
  },

  onLoad(options) {
    // 创建地图上下文
    this.mapContext = wx.createMapContext('map', this);
    
    // 获取当前位置
    this.getCurrentLocation();
    
    // 如果从其他页面传入参数
    if (options.start) {
      this.setData({
        startText: decodeURIComponent(options.start)
      });
    }
    
    // 处理终点参数（可能是名称或坐标）
    if (options.end) {
      const endName = decodeURIComponent(options.end);
      this.setData({
        endText: endName
      });
      
      // 如果传入了坐标，直接设置
      if (options.endLat && options.endLng) {
        this.setData({
          endLocation: {
            lat: parseFloat(options.endLat),
            lng: parseFloat(options.endLng),
            name: endName
          }
        });
        // 自动规划路线
        setTimeout(() => {
          this.getRoute();
        }, 500);
      } else {
        // 只有名称，需要搜索
        setTimeout(() => {
          this.searchLocations();
        }, 500);
      }
    }
  },

  /**
   * 获取当前位置（高精度定位）
   */
  getCurrentLocation() {
    wx.showLoading({
      title: '定位中...',
      mask: true
    });
    
    wx.getLocation({
      type: 'gcj02',
      altitude: false, // 不需要海拔，提高定位速度
      isHighAccuracy: true, // 开启高精度定位
      highAccuracyExpireTime: 5000, // 高精度定位超时时间（增加到5秒）
      success: (res) => {
        wx.hideLoading();
        console.log('定位成功:', res);
        
        // 检查定位精度
        const accuracy = res.accuracy || 0;
        if (accuracy > 100) {
          console.warn('定位精度较低:', accuracy, '米');
          wx.showToast({
            title: `定位精度${accuracy}米，可能不准确`,
            icon: 'none',
            duration: 2000
          });
        }
        
        this.setData({
          longitude: res.longitude,
          latitude: res.latitude
        });
        
        // 将当前位置设为默认起点
        if (!this.data.startText) {
          this.setData({
            startText: '我的位置',
            startLocation: {
              lng: res.longitude,
              lat: res.latitude,
              name: '我的位置'
            }
          });
        }
        
        // 如果精度信息可用，记录精度
        if (res.accuracy) {
          console.log('定位精度:', res.accuracy, '米');
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('获取位置失败:', err);
        
        // 如果高精度定位失败，尝试普通定位
        if (err.errMsg && err.errMsg.includes('timeout')) {
          console.log('高精度定位超时，尝试普通定位');
          wx.getLocation({
            type: 'gcj02',
            isHighAccuracy: false,
            success: (res) => {
              this.setData({
                longitude: res.longitude,
                latitude: res.latitude,
                startLocation: {
                  lng: res.longitude,
                  lat: res.latitude,
                  name: '我的位置'
                }
              });
              if (!this.data.startText) {
                this.setData({
                  startText: '我的位置'
                });
              }
              wx.showToast({
                title: '定位成功（普通模式）',
                icon: 'success',
                duration: 1500
              });
            },
            fail: () => {
              wx.showToast({
                title: '获取位置失败，请检查权限',
                icon: 'none',
                duration: 2000
              });
              // 使用默认位置（盐池县）
              this.setData({
                longitude: 107.40541,
                latitude: 37.784595
              });
            }
          });
        } else {
          wx.showToast({
            title: '获取位置失败，请检查权限',
            icon: 'none',
            duration: 2000
          });
          // 使用默认位置（盐池县）
          this.setData({
            longitude: 107.40541,
            latitude: 37.784595
          });
        }
      }
    });
  },

  /**
   * 获取"我的位置"（实时定位）
   */
  getMyCurrentLocation(type) {
    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: '获取当前位置...',
        mask: true
      });

      wx.getLocation({
        type: 'gcj02',
        altitude: false,
        isHighAccuracy: true,
        highAccuracyExpireTime: 5000,
        success: (res) => {
          wx.hideLoading();
          console.log('获取我的位置成功:', res);
          
          // 检查定位精度
          const accuracy = res.accuracy || 0;
          if (accuracy > 100) {
            console.warn('定位精度较低:', accuracy, '米');
          }
          
          const location = {
            lng: res.longitude,
            lat: res.latitude,
            name: '我的位置',
            accuracy: accuracy
          };
          
          this.setData({
            [`${type}Location`]: location,
            [`${type}Text`]: '我的位置'
          });
          
          // 如果是起点，同时更新地图中心
          if (type === 'start') {
            this.setData({
              longitude: res.longitude,
              latitude: res.latitude
            });
          }
          
          resolve();
        },
        fail: (err) => {
          wx.hideLoading();
          console.error('获取位置失败:', err);
          
          // 检查是否是开发者工具环境
          const systemInfo = wx.getSystemInfoSync();
          const isDevTools = systemInfo.platform === 'devtools';
          
          if (isDevTools) {
            // 开发者工具无法获取真实位置，使用模拟位置
            wx.showModal({
              title: '开发者工具提示',
              content: '开发者工具无法获取真实GPS位置。\n\n请使用📍按钮手动选择位置，或在真机上测试。',
              confirmText: '使用模拟位置',
              cancelText: '手动选择',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 使用盐池县的模拟位置
                  const mockLocation = {
                    lng: 107.40541,
                    lat: 37.784595,
                    name: '我的位置（模拟）',
                    accuracy: 0
                  };
                  this.setData({
                    [`${type}Location`]: mockLocation,
                    [`${type}Text`]: '我的位置（模拟）'
                  });
                  if (type === 'start') {
                    this.setData({
                      longitude: mockLocation.lng,
                      latitude: mockLocation.lat
                    });
                  }
                  resolve();
                } else {
                  // 提示手动选择
                  wx.showToast({
                    title: '请点击📍按钮选择位置',
                    icon: 'none',
                    duration: 2000
                  });
                  reject(new Error('用户选择手动定位'));
                }
              }
            });
          } else {
            // 真机环境，尝试普通定位
            if (err.errMsg && err.errMsg.includes('timeout')) {
              console.log('高精度定位超时，尝试普通定位');
              wx.getLocation({
                type: 'gcj02',
                isHighAccuracy: false,
                success: (res) => {
                  const location = {
                    lng: res.longitude,
                    lat: res.latitude,
                    name: '我的位置',
                    accuracy: res.accuracy || 0
                  };
                  this.setData({
                    [`${type}Location`]: location,
                    [`${type}Text`]: '我的位置'
                  });
                  if (type === 'start') {
                    this.setData({
                      longitude: res.longitude,
                      latitude: res.latitude
                    });
                  }
                  resolve();
                },
                fail: () => {
                  wx.showModal({
                    title: '定位失败',
                    content: '无法获取当前位置，请检查：\n1. 是否授权位置权限\n2. 是否开启GPS\n3. 网络连接是否正常\n\n或使用📍按钮手动选择位置',
                    confirmText: '手动选择',
                    cancelText: '取消',
                    success: (modalRes) => {
                      if (modalRes.confirm) {
                        // 调用手动选择
                        if (type === 'start') {
                          this.selectStartLocation();
                        } else {
                          this.selectEndLocation();
                        }
                      }
                    }
                  });
                  reject(new Error('定位失败'));
                }
              });
            } else {
              wx.showModal({
                title: '定位失败',
                content: '无法获取当前位置，请检查：\n1. 是否授权位置权限\n2. 是否开启GPS\n3. 网络连接是否正常\n\n或使用📍按钮手动选择位置',
                confirmText: '手动选择',
                cancelText: '取消',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    if (type === 'start') {
                      this.selectStartLocation();
                    } else {
                      this.selectEndLocation();
                    }
                  }
                }
              });
              reject(new Error('定位失败'));
            }
          }
        }
      });
    });
  },

  /**
   * 重新定位
   */
  /**
   * 回到我的位置（地图回到当前位置）
   * 注意：微信小程序的地图组件使用的是腾讯地图，不是百度地图
   * 百度地图API只用于地点搜索、路线规划等服务，地图显示是腾讯地图
   */
  backToMyLocation() {
    wx.showLoading({
      title: '定位中...',
      mask: true
    });
    
    // 获取当前位置
    wx.getLocation({
      type: 'gcj02',
      altitude: false,
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: (res) => {
        wx.hideLoading();
        
        // 更新地图中心到当前位置（通过setData更新，兼容开发者工具）
        this.setData({
          longitude: res.longitude,
          latitude: res.latitude,
          scale: 16 // 设置合适的缩放级别
        });
        
        // 尝试使用 moveToLocation API（真机支持，开发者工具不支持）
        if (this.mapContext) {
          // 在开发者工具中，moveToLocation 会失败，但 setData 已经更新了地图中心
          // 在真机上，moveToLocation 会正常工作
          this.mapContext.moveToLocation({
            longitude: res.longitude,
            latitude: res.latitude,
            success: () => {
              wx.showToast({
                title: '已回到我的位置',
                icon: 'success',
                duration: 1500
              });
            },
            fail: (err) => {
              // 开发者工具中会失败，但地图已经通过 setData 更新了
              console.log('moveToLocation API 不支持（开发者工具限制），已通过更新地图中心点实现');
              wx.showToast({
                title: '已回到我的位置',
                icon: 'success',
                duration: 1500
              });
            }
          });
        } else {
          // 如果没有地图上下文，只通过 setData 更新
          wx.showToast({
            title: '已回到我的位置',
            icon: 'success',
            duration: 1500
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('定位失败:', err);
        wx.showToast({
          title: '定位失败，请检查定位权限',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  refreshLocation() {
    wx.showLoading({
      title: '重新定位中...',
      mask: true
    });
    
    // 重新获取当前位置并更新起点
    this.getMyCurrentLocation('start').then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '定位成功',
        icon: 'success',
        duration: 1500
      });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  /**
   * 直接导航（不依赖百度地图API，使用微信导航）
   */
  directNavigation() {
    const { startLocation, endLocation } = this.data;
    
    // 如果没有终点，提示用户
    if (!endLocation) {
      wx.showToast({
        title: '请先设置终点',
        icon: 'none'
      });
      return;
    }

    // 检查是否在开发者工具中
    const systemInfo = wx.getSystemInfoSync();
    const isDevTools = systemInfo.platform === 'devtools';

    if (isDevTools) {
      wx.showModal({
        title: '开发者工具提示',
        content: '开发者工具无法打开真实导航。\n\n在真机上，此功能会：\n1. 打开微信内置地图\n2. 显示目的地位置\n3. 可选择使用第三方导航应用\n\n请在真机上测试导航功能。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // 如果有起点，可以显示路线选择
    if (startLocation) {
      wx.showActionSheet({
        itemList: ['导航到终点', '查看终点位置', '复制坐标'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 导航到终点（使用微信导航）
            this.openWeChatNavigation();
          } else if (res.tapIndex === 1) {
            // 查看终点位置
            wx.openLocation({
              latitude: endLocation.lat,
              longitude: endLocation.lng,
              name: endLocation.name || '目的地',
              address: endLocation.address || endLocation.name || '',
              scale: 18,
              success: () => {
                console.log('打开位置成功');
              },
              fail: (err) => {
                console.error('打开位置失败:', err);
                wx.showModal({
                  title: '打开位置失败',
                  content: '请在真机上测试此功能',
                  showCancel: false
                });
              }
            });
          } else if (res.tapIndex === 2) {
            // 复制坐标
            const coord = `${endLocation.lat},${endLocation.lng}`;
            wx.setClipboardData({
              data: coord,
              success: () => {
                wx.showToast({
                  title: '坐标已复制',
                  icon: 'success'
                });
              }
            });
          }
        }
      });
    } else {
      // 直接导航到终点
      this.openWeChatNavigation();
    }
  },

  /**
   * 起点输入变化
   */
  handleStartInputChange(e) {
    this.setData({
      startText: e.detail.value
    });
  },

  /**
   * 起点输入框失焦
   */
  onStartInputBlur(e) {
    const value = e.detail.value.trim();
    // 如果输入的是"我的位置"或为空，自动获取当前位置
    if (value === '我的位置' || value === '') {
      if (!this.data.startLocation) {
        this.useMyLocationAsStart();
      }
    }
  },

  /**
   * 使用我的位置作为起点
   */
  useMyLocationAsStart() {
    wx.showLoading({
      title: '获取位置中...',
      mask: true
    });
    
    this.getMyCurrentLocation('start').then(() => {
      wx.hideLoading();
      wx.showToast({
        title: '已设置为起点',
        icon: 'success',
        duration: 1500
      });
    }).catch(() => {
      wx.hideLoading();
    });
  },

  /**
   * 终点输入变化
   */
  handleEndInputChange(e) {
    this.setData({
      endText: e.detail.value
    });
  },

  /**
   * 搜索地点并规划路线
   */
  searchLocations() {
    const { startText, endText, apiDisabled, startLocation, endLocation } = this.data;
    
    // 如果API已被禁用，直接使用微信导航（不弹窗，静默处理）
    if (apiDisabled) {
      // 检查是否有终点
      if (!endLocation) {
        wx.showToast({
          title: '请先点击📍选择终点',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      // 有终点，直接使用微信导航，不弹窗
      this.directNavigation();
      return;
    }
    
    // 检查起点和终点
    const hasStart = startText.trim() || startLocation;
    const hasEnd = endText.trim() || endLocation;
    
    if (!hasStart || !hasEnd) {
      wx.showToast({
        title: '请设置起点和终点',
        icon: 'none'
      });
      return;
    }

    this.setData({
      isLoading: true
    });

    wx.showLoading({
      title: '正在规划路线...',
      mask: true
    });

    // 先进行地点搜索，获取坐标
    const startPromise = startLocation ? 
      Promise.resolve() : // 如果已有起点位置，跳过搜索
      this.searchLocation(startText || '我的位置', 'start');
    
    const endPromise = endLocation ? 
      Promise.resolve() : // 如果已有终点位置，跳过搜索
      this.searchLocation(endText, 'end');

    Promise.all([startPromise, endPromise])
      .then(() => {
        // 确保起点和终点都有位置信息
        if (!this.data.startLocation) {
          throw new Error('起点位置获取失败');
        }
        if (!this.data.endLocation) {
          throw new Error('终点位置获取失败');
        }
        // 两个地点都搜索成功后，规划路线
        this.getRoute();
      })
      .catch((err) => {
        console.error('搜索地点失败:', err);
        wx.hideLoading();
        this.setData({
          isLoading: false
        });
        
        // 如果搜索失败，提示使用直接导航
        wx.showModal({
          title: '搜索失败',
          content: `地点搜索失败：${err.message || '未知错误'}\n\n✅ 建议使用"🗺️ 直接导航"功能`,
          confirmText: '使用直接导航',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm && this.data.endLocation) {
              this.directNavigation();
            } else if (res.confirm && !this.data.endLocation) {
              wx.showToast({
                title: '请先设置终点',
                icon: 'none'
              });
            }
          }
        });
      });
  },

  /**
   * 搜索地点（使用多种方法提高准确性）
   */
  searchLocation(keyword, type) {
    return new Promise((resolve, reject) => {
      // 如果是"我的位置"，使用实时定位
      if (keyword === '我的位置' || keyword.trim() === '') {
        this.getMyCurrentLocation(type).then(resolve).catch(reject);
        return;
      }

      // 方法1: 使用百度地图地点搜索API（更精确）
      this.searchPlaceAPI(keyword, type)
        .then(resolve)
        .catch(() => {
          // 方法2: 如果失败，尝试地理编码API
          this.geocodeLocation(keyword, type)
            .then(resolve)
            .catch(() => {
              // 方法3: 如果都失败，提示用户手动选择
              this.showLocationPicker(keyword, type, resolve, reject);
            });
        });
    });
  },

  /**
   * 使用百度地图地点搜索API（更精确的搜索）
   */
  searchPlaceAPI(keyword, type) {
    return new Promise((resolve, reject) => {
      const ak = BAIDU_MAP_AK;
      
      // 先尝试使用suggestion API获取建议（更准确）
      wx.request({
        url: 'https://api.map.baidu.com/place/v2/suggestion',
        data: {
          query: keyword,
          region: '盐池县',
          city_limit: true, // 限制在城市内
          output: 'json',
          ak: ak,
          ret_coordtype: 'gcj02ll'
        },
        success: (res) => {
          if (res.data && res.data.status === 0 && res.data.result && res.data.result.length > 0) {
            // 使用第一个建议结果
            const result = res.data.result[0];
            if (result.location) {
              this.setData({
                [`${type}Location`]: {
                  lng: result.location.lng,
                  lat: result.location.lat,
                  name: result.name || keyword
                }
              });
              resolve();
              return;
            }
          }
          // 如果suggestion失败，使用search API
          this.searchPlaceDetail(keyword, type, ak).then(resolve).catch(reject);
        },
        fail: () => {
          // 如果suggestion请求失败，使用search API
          this.searchPlaceDetail(keyword, type, ak).then(resolve).catch(reject);
        }
      });
    });
  },

  /**
   * 使用百度地图place/v2/search API搜索地点详情
   */
  searchPlaceDetail(keyword, type, ak) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'https://api.map.baidu.com/place/v2/search',
        data: {
          query: keyword,
          region: '盐池县',
          city_limit: true,
          output: 'json',
          ak: ak,
          ret_coordtype: 'gcj02ll',
          scope: 2, // 返回详细POI信息
          page_size: 5 // 返回前5个结果，选择最匹配的
        },
        success: (res) => {
          if (res.data && res.data.status === 0 && res.data.results && res.data.results.length > 0) {
            // 选择第一个结果（通常是最相关的）
            const result = res.data.results[0];
            const location = result.location;
            
            this.setData({
              [`${type}Location`]: {
                lng: location.lng,
                lat: location.lat,
                name: result.name || keyword,
                address: result.address || ''
              }
            });
            resolve();
          } else {
            // API返回错误
            const errorMsg = res.data?.message || '搜索失败';
            if (res.data?.status === 200 || res.data?.status === 1) {
              // API服务被禁用或key无效
              reject(new Error('地图服务暂时不可用，请稍后重试或手动选择位置'));
            } else {
              reject(new Error(errorMsg));
            }
          }
        },
        fail: (err) => {
          console.error('地点搜索请求失败:', err);
          reject(new Error('网络请求失败，请检查网络连接'));
        }
      });
    });
  },

  /**
   * 地理编码（将地址转换为坐标）
   */
  geocodeLocation(address, type) {
    return new Promise((resolve, reject) => {
      const ak = BAIDU_MAP_AK;
      
      // 如果地址不包含城市信息，添加城市前缀
      let fullAddress = address;
      if (!address.includes('盐池') && !address.includes('宁夏')) {
        fullAddress = `宁夏回族自治区盐池县${address}`;
      }
      
      wx.request({
        url: 'https://api.map.baidu.com/geocoding/v3/',
        data: {
          address: fullAddress,
          city: '盐池县',
          output: 'json',
          ak: ak,
          ret_coordtype: 'gcj02ll'
        },
        success: (res) => {
          if (res.data && res.data.status === 0 && res.data.result && res.data.result.location) {
            const location = res.data.result.location;
            const confidence = res.data.result.confidence || 0;
            
            // 如果置信度太低，提示用户
            if (confidence < 50) {
              console.warn('地理编码置信度较低:', confidence);
            }
            
            this.setData({
              [`${type}Location`]: {
                lng: location.lng,
                lat: location.lat,
                name: address
              }
            });
            resolve();
          } else {
            const errorMsg = res.data?.message || '未找到该地点';
            if (res.data?.status === 200 || res.data?.status === 1) {
              reject(new Error('地图服务暂时不可用'));
            } else {
              reject(new Error(errorMsg));
            }
          }
        },
        fail: (err) => {
          console.error('地理编码请求失败:', err);
          reject(new Error('网络请求失败'));
        }
      });
    });
  },

  /**
   * 显示位置选择器（备用方案）
   */
  showLocationPicker(keyword, type, resolve, reject) {
    wx.showModal({
      title: '位置搜索失败',
      content: `无法找到"${keyword}"，是否手动选择位置？`,
      confirmText: '选择位置',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // 使用微信地图选择位置
          wx.chooseLocation({
            success: (locationRes) => {
              this.setData({
                [`${type}Location`]: {
                  lng: locationRes.longitude,
                  lat: locationRes.latitude,
                  name: locationRes.name || keyword
                },
                [`${type}Text`]: locationRes.name || keyword
              });
              resolve();
            },
            fail: (err) => {
              console.error('选择位置失败:', err);
              reject(new Error('位置选择失败'));
            }
          });
        } else {
          reject(new Error('用户取消选择'));
        }
      }
    });
  },

  /**
   * 规划路线（直接使用百度地图API，带错误处理）
   */
  getRoute() {
    const { startLocation, endLocation } = this.data;
    
    if (!startLocation || !endLocation) {
      wx.hideLoading();
      this.setData({
        isLoading: false
      });
      wx.showToast({
        title: '地点信息不完整',
        icon: 'none'
      });
      return;
    }

    const ak = BAIDU_MAP_AK;
    // 构建起点和终点坐标字符串（格式：纬度,经度）
    const origin = `${startLocation.lat},${startLocation.lng}`;
    const destination = `${endLocation.lat},${endLocation.lng}`;

    // 直接调用百度地图路线规划API
    wx.request({
      url: 'https://api.map.baidu.com/direction/v2/driving',
      data: {
        origin: origin,
        destination: destination,
        ak: ak,
        tactics: 12, // 12=最短时间（推荐），11=不走高速，13=最短距离
        output: 'json',
        ret_coordtype: 'gcj02ll'
      },
      success: (res) => {
        wx.hideLoading();
        this.setData({
          isLoading: false
        });

        // 添加调试日志
        console.log('路线规划API返回:', res.data);
        
        // 检查API返回状态
        if (!res.data) {
          wx.showModal({
            title: '服务异常',
            content: '地图服务返回数据异常，请稍后重试或使用手动选择位置功能。',
            showCancel: false
          });
          return;
        }

        // 检查是否是错误响应（status不为0）
        if (res.data.status !== 0) {
          const errorMsg = res.data.message || '路线规划失败';
          const statusCode = res.data.status;
          console.error('路线规划API错误:', res.data);
          
          // status 240 表示APP服务被禁用
          if (statusCode === 240) {
            // 静默标记API已被禁用，不弹出提示（避免频繁打扰用户）
            this.setData({
              apiDisabled: true
            });
            
            // 如果有终点，直接使用微信导航，不弹窗
            if (this.data.endLocation) {
              // 直接调用导航，不弹窗提示
              setTimeout(() => {
                this.directNavigation();
              }, 300);
            } else {
              // 只在控制台记录，不弹窗
              console.warn('API服务已禁用，请使用"直接导航"功能');
            }
            return;
          }
          
          // status 200/1 通常表示API服务被禁用或配额用完
          if (statusCode === 200 || statusCode === 1) {
            wx.showModal({
              title: '服务不可用',
              content: '地图服务暂时不可用。\n\n可能原因：\n1. API密钥问题\n2. 服务配额已用完\n3. 服务被禁用\n\n建议：使用📍按钮手动选择位置',
              confirmText: '手动选择',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 提示用户手动选择位置
                  wx.showToast({
                    title: '请点击📍按钮选择位置',
                    icon: 'none',
                    duration: 2000
                  });
                }
              }
            });
          } else {
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 2000
            });
          }
          return;
        }

        // 检查是否有路线数据
        if (res.data.result && res.data.result.routes && res.data.result.routes.length > 0) {
          const route = res.data.result.routes[0];
          let points = [];
          
          // 提取路线点（优先使用overview_polyline，更准确）
          if (route.overview_polyline && route.overview_polyline.points) {
            // 百度地图的polyline是编码后的字符串，需要解码
            points = this.decodeBaiduPolyline(route.overview_polyline.points);
          }
          
          // 如果overview_polyline不可用，从steps中提取
          if (points.length === 0 && route.steps && route.steps.length > 0) {
            route.steps.forEach(step => {
              // 每个step可能有path字段，格式为字符串 "lng,lat;lng,lat;..."
              if (step.path) {
                if (typeof step.path === 'string') {
                  const coords = step.path.split(';');
                  coords.forEach(coord => {
                    const [lng, lat] = coord.split(',');
                    if (lng && lat && !isNaN(parseFloat(lng)) && !isNaN(parseFloat(lat))) {
                      points.push({
                        longitude: parseFloat(lng),
                        latitude: parseFloat(lat)
                      });
                    }
                  });
                } else if (Array.isArray(step.path)) {
                  // 如果是数组格式
                  step.path.forEach(point => {
                    if (typeof point === 'string') {
                      const [lng, lat] = point.split(',');
                      if (lng && lat) {
                        points.push({
                          longitude: parseFloat(lng),
                          latitude: parseFloat(lat)
                        });
                      }
                    } else if (point.lng && point.lat) {
                      points.push({
                        longitude: point.lng,
                        latitude: point.lat
                      });
                    }
                  });
                }
              }
            });
          }

          // 计算路线信息
          const distance = route.distance || 0; // 距离（米）
          const duration = route.duration || 0; // 时间（秒）

          if (points.length > 0) {
            this.setData({
              polyline: [{
                points: points,
                color: "#238E23",
                width: 6,
                dottedLine: false,
                arrowLine: true
              }],
              longitude: points[0].longitude,
              latitude: points[0].latitude,
              markers: [
                {
                  id: 0,
                  longitude: startLocation.lng,
                  latitude: startLocation.lat,
                  iconPath: '/images/icons/map/start.png',
                  width: 30,
                  height: 30,
                  callout: {
                    content: startLocation.name,
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
                  longitude: endLocation.lng,
                  latitude: endLocation.lat,
                  iconPath: '/images/icons/map/end.png',
                  width: 30,
                  height: 30,
                  callout: {
                    content: endLocation.name,
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
                distance: this.formatDistance(distance),
                duration: this.formatDuration(duration),
                distanceMeters: distance
              }
            });

            // 调整地图视野以包含整条路线
            this.fitRouteToMap(points);

            wx.showToast({
              title: '路线规划成功',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '路线数据解析失败',
              icon: 'none'
            });
          }
        } else {
          const errorMsg = res.data?.message || '未找到路线';
          // 检查是否是API服务问题
          if (res.data?.status === 200 || res.data?.status === 1) {
            wx.showModal({
              title: '服务不可用',
              content: '地图服务暂时不可用，可能是API密钥问题或服务被禁用。请检查配置或稍后重试。',
              showCancel: false
            });
          } else {
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 2000
            });
          }
        }
      },
      fail: (err) => {
        wx.hideLoading();
        this.setData({
          isLoading: false
        });
        console.error('路线规划请求失败:', err);
        
        // 检查是否是网络问题
        if (err.errMsg && err.errMsg.includes('fail')) {
          wx.showModal({
            title: '网络错误',
            content: '无法连接到地图服务，请检查网络连接或稍后重试。\n\n提示：如果持续出现此问题，可能是百度地图API服务被禁用，需要检查API密钥配置。',
            showCancel: false
          });
        } else {
          wx.showToast({
            title: '路线规划失败，请检查网络',
            icon: 'none',
            duration: 2000
          });
        }
      }
    });
  },

  /**
   * 解码百度地图polyline（百度地图使用自己的编码算法）
   */
  decodeBaiduPolyline(encoded) {
    const points = [];
    try {
      if (typeof encoded === 'string') {
        // 百度地图的polyline是经过编码的，需要解码
        // 如果已经是坐标字符串格式（lng,lat;lng,lat），直接解析
        if (encoded.includes(';') || encoded.includes(',')) {
          // 尝试按分号分割
          const segments = encoded.split(';');
          segments.forEach(segment => {
            const [lng, lat] = segment.split(',');
            if (lng && lat && !isNaN(parseFloat(lng)) && !isNaN(parseFloat(lat))) {
              points.push({
                longitude: parseFloat(lng),
                latitude: parseFloat(lat)
              });
            }
          });
        } else {
          // 如果是编码后的字符串，需要解码（这里简化处理）
          // 实际应该使用百度地图官方解码算法
          console.warn('polyline格式未知，尝试其他解析方式');
        }
      }
    } catch (e) {
      console.error('解码polyline失败:', e);
    }
    return points;
  },

  /**
   * 格式化距离
   */
  formatDistance(meters) {
    if (meters < 1000) {
      return `${meters}米`;
    } else {
      return `${(meters / 1000).toFixed(2)}公里`;
    }
  },

  /**
   * 格式化时间
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}小时${minutes}分钟`;
    }
  },

  /**
   * 调整地图视野以包含整条路线
   */
  fitRouteToMap(points) {
    if (points.length === 0) return;

    let minLng = points[0].longitude;
    let maxLng = points[0].longitude;
    let minLat = points[0].latitude;
    let maxLat = points[0].latitude;

    points.forEach(point => {
      minLng = Math.min(minLng, point.longitude);
      maxLng = Math.max(maxLng, point.longitude);
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
    });

    // 计算中心点和缩放级别
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const lngSpan = maxLng - minLng;
    const latSpan = maxLat - minLat;

    // 使用includePoints调整视野
    this.mapContext.includePoints({
      points: points,
      padding: [50, 50, 50, 50]
    });
  },

  /**
   * 使用微信导航（打开微信内置地图）
   */
  openWeChatNavigation() {
    const { endLocation, startLocation } = this.data;
    if (!endLocation) {
      wx.showToast({
        title: '请先设置终点',
        icon: 'none'
      });
      return;
    }

    // 检查是否在开发者工具中
    const systemInfo = wx.getSystemInfoSync();
    const isDevTools = systemInfo.platform === 'devtools';

    if (isDevTools) {
      wx.showModal({
        title: '开发者工具提示',
        content: '开发者工具无法打开真实导航。\n\n在真机上，此功能会：\n1. 打开微信内置地图\n2. 显示目的地位置\n3. 可选择使用第三方导航应用\n\n请在真机上测试导航功能。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // 构建地址信息
    const address = endLocation.address || endLocation.name || '目的地';
    const name = endLocation.name || '目的地';

    wx.openLocation({
      latitude: endLocation.lat,
      longitude: endLocation.lng,
      name: name,
      address: address,
      scale: 18,
      success: () => {
        console.log('打开微信导航成功');
        // 在真机上，wx.openLocation会打开微信内置地图
        // 用户可以在地图上选择使用第三方导航应用（如腾讯地图、高德地图等）
      },
      fail: (err) => {
        console.error('打开微信导航失败:', err);
        
        let errorMsg = '打开导航失败';
        if (err.errMsg) {
          if (err.errMsg.includes('permission')) {
            errorMsg = '需要位置权限';
          } else if (err.errMsg.includes('cancel')) {
            errorMsg = '用户取消';
            return; // 用户取消不需要提示
          } else {
            errorMsg = err.errMsg;
          }
        }
        
        wx.showModal({
          title: '导航失败',
          content: `${errorMsg}\n\n提示：\n1. 确保已授权位置权限\n2. 在真机上测试（开发者工具不支持）\n3. 可以手动复制地址到地图应用`,
          showCancel: false,
          confirmText: '知道了'
        });
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
   * 选择起点位置
   */
  selectStartLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          startText: res.name || res.address,
          startLocation: {
            lng: res.longitude,
            lat: res.latitude,
            name: res.name || '选择的位置'
          }
        });
        wx.showToast({
          title: '起点已设置',
          icon: 'success',
          duration: 1500
        });
      },
      fail: (err) => {
        console.error('选择位置失败:', err);
        let errorMsg = '选择位置失败';
        
        if (err.errMsg) {
          if (err.errMsg.includes('auth deny')) {
            errorMsg = '需要位置权限，请在设置中开启';
          } else if (err.errMsg.includes('requiredPrivateInfos')) {
            errorMsg = '需要在app.json中声明chooseLocation权限';
            wx.showModal({
              title: '配置错误',
              content: '需要在app.json的requiredPrivateInfos中添加"chooseLocation"。\n\n请重新编译小程序。',
              showCancel: false
            });
          } else {
            errorMsg = err.errMsg;
          }
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 选择终点位置
   */
  selectEndLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          endText: res.name || res.address,
          endLocation: {
            lng: res.longitude,
            lat: res.latitude,
            name: res.name || '选择的位置'
          }
        });
        wx.showToast({
          title: '终点已设置',
          icon: 'success',
          duration: 1500
        });
      },
      fail: (err) => {
        console.error('选择位置失败:', err);
        let errorMsg = '选择位置失败';
        
        if (err.errMsg) {
          if (err.errMsg.includes('auth deny')) {
            errorMsg = '需要位置权限，请在设置中开启';
          } else if (err.errMsg.includes('requiredPrivateInfos')) {
            errorMsg = '需要在app.json中声明chooseLocation权限';
            wx.showModal({
              title: '配置错误',
              content: '需要在app.json的requiredPrivateInfos中添加"chooseLocation"。\n\n请重新编译小程序。',
              showCancel: false
            });
          } else {
            errorMsg = err.errMsg;
          }
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 显示API修复指南
   */
  showApiFixGuide() {
    wx.showModal({
      title: '修复API被禁用问题',
      content: '快速修复步骤：\n\n1️⃣ 登录百度地图控制台\n   https://lbsyun.baidu.com/\n\n2️⃣ 检查应用状态\n   - 找到API密钥对应的应用\n   - 检查应用是否正常\n\n3️⃣ 启用所需服务\n   ✅ Place API（地点检索）\n   ✅ Geocoding API（地理编码）\n   ✅ Direction API（路线规划）\n\n4️⃣ 配置白名单\n   - 添加：servicewechat.com\n   - 或选择"不校验白名单"\n\n5️⃣ 检查配额\n   - 查看是否配额用完\n   - 等待重置或升级账户\n\n6️⃣ 更新API密钥（如需要）\n   - 申请新的API密钥\n   - 在代码中更新BAIDU_MAP_AK\n\n💡 详细步骤请查看项目中的"修复API被禁用问题.md"文档',
      confirmText: '知道了',
      showCancel: false
    });
  }
});
