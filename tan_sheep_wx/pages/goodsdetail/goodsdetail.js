// 在文件顶部引入API工具
const API = require('../../utils/api.js');

Page({
    data: {
        imageList: [
            { src: '/images/icons/function/f1.png' }
        ],
        sheepList: [
            {
                id: '1',
                title: '羊1',
                gender: '公',
                birthdate: '2023-01-01',
                height: '120',
                length: '150',
                weight: '50',
                price: '300',
                sheepId: '25',
                breederId: '3',
                breederPhone: '15120392430'
            },
            // 更多羊只数据
        ],
        sheepDetail: {},  // 当前羊只详细信息
        isInCart: false,  // 标记商品是否在购物车中
        isBuyNowModalVisible: false  // 控制弹窗的显示
    },

    onLoad: function (options) {
        if (options.id) {
            var sheepId = options.id;
            this.setData({ sheepId: sheepId });
            this.loadData(sheepId);
        } else {
            wx.showToast({
                title: '无效的羊只ID',
                icon: 'error'
            });
        }
    },

    loadData: function (sheepId) {
        this.getSheepDetail(sheepId);
    },

    getSheepDetail: function (sheepId) {
        var that = this;
        console.log('[获取羊只详情] sheepId:', sheepId);

        API.request(`/api/sheep/${sheepId}`, 'GET')
            .then((res) => {
                console.log('[获取羊只详情] 返回数据:', res);
                that.setData({
                    sheepDetail: res
                });
            })
            .catch((error) => {
                console.error('[获取羊只详情] 请求失败:', error);
                wx.showToast({
                    title: '羊信息获取失败',
                    icon: 'none',
                    duration: 2000
                });
            });
    },

    // 打开购买弹窗
    openBuyNowModal: function () {
        this.setData({
            isBuyNowModalVisible: true
        });
    },

    // 关闭购买弹窗
    closeBuyNowModal: function () {
        this.setData({
            isBuyNowModalVisible: false
        });
    },

    // 确认购买
    confirmBuyNow: function () {
        var sheepDetail = this.data.sheepDetail;
        wx.navigateTo({
            url: '/packageOrder/cart/checkout?sheepId=' + (sheepDetail.sheepId || '')
        });
        this.closeBuyNowModal();
    },

    // 添加到购物车
    addToCart: function () {
        if (this.data.isInCart) {
            wx.showToast({
                title: '已在购物车中',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        var cartItems = wx.getStorageSync('cartItems') || [];
        var sheepDetail = this.data.sheepDetail || {};
        // 手动复制对象属性，避免使用扩展运算符
        var newItem = {};
        for (var key in sheepDetail) {
            if (sheepDetail.hasOwnProperty(key)) {
                newItem[key] = sheepDetail[key];
            }
        }
        newItem.quantity = 1;
        newItem.price = sheepDetail.weight * 10 || 0; // 假设价格是体重乘以10
        newItem.imagePath = sheepDetail.imagePath || '';

        cartItems.push(newItem);
        wx.setStorageSync('cartItems', cartItems);

        this.setData({
            isInCart: true
        });

        wx.showToast({
            title: '已加入购物车',
            icon: 'success',
            duration: 2000
        });

        wx.navigateTo({
            url: '/pages/cart/cart'
        });
    }
});

