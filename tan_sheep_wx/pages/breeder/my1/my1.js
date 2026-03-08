// 在文件顶部引入API，避免在函数内部require导致路径解析问题
// 从 pages/breeder/my1/ 到 utils/ 需要向上三级
const API = require('../../../utils/api.js');

Page({
    data: {
      currentBreeder: null,
      isFollowed: false
    },
    onLoad: function(options) {
        const id = options.id; 
        this.fetchBreederDetail(id);
    },
  
    fetchBreederDetail: function(id) {
        var that = this;
        wx.showLoading({ title: '加载中...', mask: true });
        
        API.request(`/api/breeders/${id}`, 'GET')
            .then(function(res) {
                wx.hideLoading();
                console.log('返回的数据:', res);
                
                // 处理数据：如果是 {code: 0, data: {...}} 格式，则取 data
                let breeder = (res && res.code === 0 && res.data) ? res.data : res;
                
                if (!breeder || !breeder.id) {
                     wx.showToast({ title: '数据异常', icon: 'none' });
                     return;
                }

                const baseUrl = API.API_BASE_URL || 'http://127.0.0.1:8000';

                // 处理头像
                let avatarUrl = breeder.avatar_url || breeder.iconUrl || breeder.icon_url || '';
                if (avatarUrl && !avatarUrl.startsWith('http')) {
                    avatarUrl = baseUrl + avatarUrl;
                }
                breeder.avatarUrl = avatarUrl || '/images/icons/function/f8.png';
                
                // 处理羊只列表图片
                if (breeder.sheep_list && Array.isArray(breeder.sheep_list)) {
                    breeder.sheep_list = breeder.sheep_list.map(sheep => {
                        let img = sheep.image_url || sheep.image || '';
                        if (img && !img.startsWith('http')) {
                            img = baseUrl + img;
                        }
                        return {
                            ...sheep,
                            image_url: img
                        };
                    });
                }

                // 从本地存储读取关注状态
                const followList = wx.getStorageSync('followedBreeders') || [];
                const isFollowed = followList.some(item => item.id === breeder.id);

                that.setData({
                    currentBreeder: breeder,
                    isFollowed: isFollowed
                });
            })
            .catch(function(error) {
                wx.hideLoading();
                console.error('请求失败', error);
                wx.showToast({
                    title: '加载失败',
                    icon: 'none',
                    duration: 2000
                });
            });
    },
    
    // 查看羊只详情
    viewSheepDetail: function(e) {
        const sheepId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/adopt/customize/customize?id=${sheepId}`
        });
    },
    
    // 拨打电话
    makePhoneCall: function() {
        const phone = this.data.currentBreeder.phone;
        if (phone) {
            wx.makePhoneCall({
                phoneNumber: phone,
                success: function() {
                    console.log('拨打电话成功');
                },
                fail: function(err) {
                    console.error('拨打电话失败', err);
                    wx.showToast({
                        title: '拨打电话失败',
                        icon: 'none'
                    });
                }
            });
        }
    },

    navigateToMap: function() {
        const breeder = this.data.currentBreeder;
        if (breeder && breeder.latitude && breeder.longitude) {
            wx.navigateTo({
                url: `/pages/map/index?latitude=${breeder.latitude}&longitude=${breeder.longitude}`
            });
        } else {
            wx.showToast({
                title: '暂无位置信息',
                icon: 'none',
                duration: 2000
            });
        }
    },
    
    // 切换关注状态
    toggleFollow: function() {
        var that = this;
        const newFollowedState = !this.data.isFollowed;
        const breeder = this.data.currentBreeder;

        // 更新本地存储
        let list = wx.getStorageSync('followedBreeders') || [];
        if (newFollowedState) {
            // 关注：添加到列表（防重复）
            const exists = list.some(item => item.id === breeder.id);
            if (!exists) {
                list.unshift({
                    id: breeder.id,
                    name: breeder.name,
                    avatarUrl: breeder.avatarUrl || '',
                    sheep_count: breeder.sheep_count || breeder.actual_sheep_count || 0
                });
            }
        } else {
            // 取消关注：从列表移除
            list = list.filter(item => item.id !== breeder.id);
        }
        wx.setStorageSync('followedBreeders', list);

        that.setData({ isFollowed: newFollowedState });
        wx.showToast({
            title: newFollowedState ? '已关注' : '已取消关注',
            icon: 'success',
            duration: 1500
        });

        // 尝试同步到后端（不影响本地逻辑）
        API.request('/api/breeders/follow', 'POST', {
            breederId: breeder.id,
            follow: newFollowedState,
        }).catch(() => {});
    },
    
    // 图片加载失败处理
    onImageError: function(e) {
        const currentBreeder = this.data.currentBreeder;
        if (currentBreeder) {
            currentBreeder.iconUrl = '/images/icons/function/f8.png';
            this.setData({
                currentBreeder: currentBreeder
            });
        }
    }
});