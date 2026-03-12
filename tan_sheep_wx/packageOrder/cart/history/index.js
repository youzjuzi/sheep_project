// history.js - 购买历史页面
const API = require('../../../utils/api.js');

Page({
    data: {
        orders: [],
        loading: false
    },

    onLoad: function () {
        this.loadHistory();
    },

    onShow: function () {
        this.loadHistory();
    },

    loadHistory: function () {
        const that = this;
        const token = wx.getStorageSync('token');

        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录查看购买历史',
                success: function (res) {
                    if (res.confirm) {
                        wx.navigateTo({ url: '/pages/login/index' });
                    } else {
                        wx.navigateBack();
                    }
                }
            });
            return;
        }

        that.setData({ loading: true });

        API.getOrderHistory(token)
            .then((res) => {
                console.log('[购买历史] API返回:', res);
                const orderData = res.data || res;
                const orders = Array.isArray(orderData) ? orderData : [];

                that.setData({
                    orders: orders,
                    loading: false
                });
            })
            .catch((error) => {
                console.error('[购买历史] 获取失败:', error);
                that.setData({ loading: false });
                wx.showToast({
                    title: '获取历史失败',
                    icon: 'none'
                });
            });
    },

    onOrderTap: function (e) {
        const order = e.currentTarget.dataset.order;
        if (!order || !order.id) {
            wx.showToast({ title: '订单数据异常', icon: 'none' });
            return;
        }

        wx.setStorageSync('currentOrderDetail', order);
        wx.navigateTo({
            url: `/packageOrder/cart/history/detail/index?order_id=${order.id}`
        });
    }
});
