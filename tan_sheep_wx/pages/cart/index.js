// 引入API工具
const API = require('../../utils/api.js');

Page({
    data: {
        cartItems: [],
        totalPrice: 0
    },

    onShow: function () {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            const tabBar = this.getTabBar();
            tabBar.initTabBar();
            const index = tabBar.data.list.findIndex(item => item.pagePath === "/pages/cart/index");
            if (index > -1) {
                tabBar.setData({ selected: index });
            }
        }
        this.loadCartItems();
    },

    loadCartItems: function () {
        const that = this;
        const token = wx.getStorageSync('token');

        // 如果已登录，从服务器加载
        if (token) {
            wx.showLoading({
                title: '加载中...',
                mask: true
            });

            API.getCart(token)
                .then((res) => {
                    wx.hideLoading();
                    console.log('[购物车] 从服务器加载:', res);

                    // 后端返回 { code: 0, data: [...] } 格式
                    const cartData = res.data || res;
                    const items = Array.isArray(cartData) ? cartData : [];

                    // 格式化数据
                    const cartItems = items.map(item => {
                        const sheep = item.sheep || {};
                        const unitPrice = item.price || sheep.price || 0;
                        const qty = item.quantity || 1;
                        return {
                            id: sheep.id || item.sheep_id || item.id,
                            cart_item_id: item.id, // 购物车记录ID，用于删除
                            sheep: sheep,
                            gender: sheep.gender || '',
                            weight: sheep.weight || 0,
                            height: sheep.height || 0,
                            length: sheep.length || 0,
                            quantity: qty,
                            price: unitPrice,
                            total_price: unitPrice * qty
                        };
                    });

                    const totalPrice = cartItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
                    that.setData({ cartItems, totalPrice });
                })
                .catch((error) => {
                    wx.hideLoading();
                    console.error('[购物车] 从服务器加载失败:', error);
                    that.setData({ cartItems: [], totalPrice: 0 });
                    wx.showToast({ title: '加载失败', icon: 'none' });
                });
        } else {
            // 未登录，提示登录
            this.setData({ cartItems: [], totalPrice: 0 });
        }
    },

    // 从本地存储加载购物车
    loadFromLocal: function () {
        let cartItems = wx.getStorageSync('cartItems') || [];
        console.log('[购物车] 从本地加载:', cartItems);

        // 更新每个商品的价格为体重的十倍
        cartItems.forEach(item => {
            if (!item.price && item.weight) {
                item.price = (Number(item.weight) * 10) || 0;
            }
            item.total_price = (item.price || 0) * (item.quantity || 1);
        });

        const totalPrice = cartItems.reduce((sum, item) => sum + (item.total_price || item.price || 0), 0);
        this.setData({ cartItems, totalPrice });
    },

    deleteItem: function (e) {
        const that = this;
        const cartItemId = e.currentTarget.dataset.cartItemId; // 购物车记录ID
        const token = wx.getStorageSync('token');

        if (!token || !cartItemId) {
            wx.showToast({ title: '操作失败', icon: 'none' });
            return;
        }

        wx.showModal({
            title: '确认删除',
            content: '确认从购物车中移除吗？',
            success: function (res) {
                if (res.confirm) {
                    wx.showLoading({ title: '删除中...', mask: true });

                    API.removeFromCart(token, cartItemId)
                        .then((res) => {
                            wx.hideLoading();
                            console.log('[购物车] 删除成功:', res);
                            that.loadCartItems(); // 重新加载
                            wx.showToast({ title: '已删除', icon: 'success' });
                        })
                        .catch((error) => {
                            wx.hideLoading();
                            console.error('[购物车] 删除失败:', error);
                            wx.showToast({ title: '删除失败', icon: 'none' });
                        });
                }
            }
        });
    },

    viewOrderDetail: function (e) {
        const itemId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/goodsdetail/goodsdetail?id=${itemId}` // 使用反引号
        });
    },

    checkout: function () {
        const that = this;
        const token = wx.getStorageSync('token');

        if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }

        if (this.data.cartItems.length === 0) {
            wx.showToast({ title: '购物车为空', icon: 'none' });
            return;
        }

        wx.showModal({
            title: '确认结算',
            content: '总价 ¥' + that.data.totalPrice + '，确认结算吗？',
            success: function (res) {
                if (res.confirm) {
                    wx.showLoading({ title: '结算中...', mask: true });

                    API.checkout(token)
                        .then((res) => {
                            wx.hideLoading();
                            console.log('[结算] API返回:', res);

                            if (res.code === 0) {
                                that.setData({ cartItems: [], totalPrice: 0 });
                                wx.showToast({
                                    title: '结算成功！',
                                    icon: 'success',
                                    duration: 2000
                                });
                            } else {
                                wx.showToast({ title: res.msg || '结算失败', icon: 'none' });
                            }
                        })
                        .catch((error) => {
                            wx.hideLoading();
                            console.error('[结算] 失败:', error);
                            wx.showToast({ title: '网络错误', icon: 'none' });
                        });
                }
            }
        });
    },

    goToHistory: function () {
        wx.navigateTo({
            url: '/pages/cart/history/index'
        });
    },

    goHome: function () {
        wx.switchTab({
            url: '/pages/index/index'
        });
    }
});
