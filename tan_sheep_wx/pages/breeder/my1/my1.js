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
        this.syncLegacyFollowsIfNeeded();
        this.fetchBreederDetail(id);
    },

    // 将历史本地关注数据迁移到后端（仅执行一次）
    syncLegacyFollowsIfNeeded: function () {
        const token = wx.getStorageSync('token');
        if (!token) return;

        const migrated = wx.getStorageSync('legacyFollowMigrated');
        if (migrated) return;

        const localList = wx.getStorageSync('followedBreeders') || [];
        if (!Array.isArray(localList) || localList.length === 0) {
            wx.setStorageSync('legacyFollowMigrated', true);
            return;
        }

        const tasks = localList
            .filter(item => item && item.id)
            .map(item => API.followBreeder(token, item.id, true).catch(() => null));

        Promise.all(tasks).finally(() => {
            wx.setStorageSync('legacyFollowMigrated', true);
        });
    },

    fetchBreederDetail: function(id) {
        var that = this;
        wx.showLoading({ title: '加载中...', mask: true });

        const token = wx.getStorageSync('token') || '';

        API.request(`/api/breeders/${id}`, 'GET', { token: token })
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

                that.setData({
                    currentBreeder: breeder,
                    isFollowed: !!breeder.isFollowed
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

    // 切换关注状态（持久化到后端）
    toggleFollow: function() {
        var that = this;
        const breeder = this.data.currentBreeder;
        if (!breeder || !breeder.id) return;

        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录后再关注养殖户',
                confirmText: '去登录',
                success: (res) => {
                    if (res.confirm) {
                        wx.navigateTo({ url: '/pages/login/index' });
                    }
                }
            });
            return;
        }

        const newFollowedState = !this.data.isFollowed;

        API.followBreeder(token, breeder.id, newFollowedState)
            .then(function (res) {
                if (res && res.code === 0) {
                    const followersCount = res.data && res.data.followers_count;
                    const currentBreeder = that.data.currentBreeder || {};
                    if (typeof followersCount === 'number') {
                        currentBreeder.followers_count = followersCount;
                    }

                    that.setData({
                        isFollowed: !!(res.data && res.data.is_followed),
                        currentBreeder: currentBreeder
                    });

                    wx.showToast({
                        title: newFollowedState ? '已关注' : '已取消关注',
                        icon: 'success',
                        duration: 1500
                    });
                } else {
                    wx.showToast({
                        title: (res && res.msg) || '操作失败',
                        icon: 'none'
                    });
                }
            })
            .catch(function (error) {
                console.error('关注操作失败:', error);
                wx.showToast({
                    title: '操作失败，请重试',
                    icon: 'none'
                });
            });
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
