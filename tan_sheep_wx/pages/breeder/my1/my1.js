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
                const breeder = res;
                that.setData({
                    currentBreeder: {
                        ...breeder,
                        iconUrl: breeder.iconUrl || breeder.icon_url || '/images/icons/function/f8.png'
                    },
                    isFollowed: breeder.isFollowed || false
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
        // 反转关注状态
        const newFollowedState = !this.data.isFollowed;

        // 发送请求更新后端关注状态（如果后端支持）
        
        API.request('/api/breeders/follow', 'POST', {
            breederId: that.data.currentBreeder.id,
            follow: newFollowedState,
        })
        .then(function(res) {
            // 更新界面状态
            that.setData({
                isFollowed: newFollowedState
            });
            wx.showToast({
                title: newFollowedState ? '已关注' : '已取消关注',
                icon: 'success',
                duration: 1500
            });
        })
        .catch(function(error) {
            console.error('关注请求失败', error);
            // 即使后端不支持，也更新本地状态
            that.setData({
                isFollowed: newFollowedState
            });
            wx.showToast({
                title: newFollowedState ? '已关注' : '已取消关注',
                icon: 'success',
                duration: 1500
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