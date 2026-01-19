// pages/feature8/my3/my3.js
// 在文件顶部引入API
const API = require('../../../utils/api.js');

Page({
    data: {
        breeder: null,
        sheepList: [],
        sheepIdsText: ''
    },

    onLoad(options) {
        var id = options.id;
        if (id) {
            this.fetchBreederDetail(id);
        } else {
            wx.showToast({
                title: '缺少养殖户ID',
                icon: 'none',
                duration: 2000
            });
        }
    },

    fetchBreederDetail: function(id) {
        var that = this;
        wx.showLoading({ title: '加载中...', mask: true });
        
        API.request('/api/breeders/' + id, 'GET')
            .then(function(res) {
                wx.hideLoading();
                console.log('返回的养殖户数据:', res);
                var breeder = res;
                
                // 处理羊只编号列表
                var sheepIdsText = '';
                if (breeder.sheep_list && breeder.sheep_list.length > 0) {
                    // 使用普通函数替代箭头函数
                    sheepIdsText = breeder.sheep_list.map(function(sheep) {
                        return sheep.id;
                    }).join(', ');
                } else if (breeder.sheep_id) {
                    // 如果sheep_id是字符串，直接使用
                    sheepIdsText = breeder.sheep_id;
                }
                
                // 手动复制对象属性，避免使用扩展运算符
                var breederData = {};
                for (var key in breeder) {
                    if (breeder.hasOwnProperty(key)) {
                        breederData[key] = breeder[key];
                    }
                }
                breederData.iconUrl = breeder.iconUrl || breeder.icon_url || '/images/icons/function/f8.png';
                
                that.setData({
                    breeder: breederData,
                    sheepList: breeder.sheep_list || [],
                    sheepIdsText: sheepIdsText
                });
            })
            .catch(function(error) {
                wx.hideLoading();
                console.error('请求失败', error);
                wx.showToast({
                    title: '加载失败: ' + (error.message || '未知错误'),
                    icon: 'none',
                    duration: 3000
                });
            });
    },

    onReady() {

    },

    onShow() {

    },

    onHide() {

    },

    onUnload() {

    },

    onPullDownRefresh() {
        // 使用普通判断替代可选链操作符
        var breeder = this.data.breeder;
        var id = breeder && breeder.id;
        if (id) {
            this.fetchBreederDetail(id);
        }
        wx.stopPullDownRefresh();
    },

    onReachBottom() {

    },

    onShareAppMessage() {

    },
    
    // 图片加载失败处理
    onImageError: function(e) {
        var breeder = this.data.breeder;
        if (breeder) {
            breeder.iconUrl = '/images/icons/function/f8.png';
            this.setData({
                breeder: breeder
            });
        }
    }
})