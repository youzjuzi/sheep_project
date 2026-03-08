const API = require('../../utils/api.js');
const app = getApp();

Page({
    data: {
        coupons: [],
        loading: false
    },

    onLoad: function (options) {
        this.loadCoupons();
    },

    onPullDownRefresh: function () {
        this.loadCoupons().then(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 加载优惠券列表
    loadCoupons() {
        this.setData({ loading: true });
        return API.getAvailableCoupons()
            .then(res => {
                console.log('优惠券数据:', res);
                if (res.code === 0 && res.data) {
                    // 预处理优惠券数据
                    const coupons = res.data.map(coupon => {
                        return {
                            ...coupon,
                            displayText: this.getCouponDisplayText(coupon)
                        };
                    });
                    this.setData({
                        coupons: coupons,
                        loading: false
                    });
                } else {
                    console.error('加载优惠券失败:', res.msg);
                    this.setData({ loading: false });
                    wx.showToast({
                        title: res.msg || '加载失败',
                        icon: 'none'
                    });
                }
            })
            .catch(error => {
                console.error('加载优惠券失败:', error);
                this.setData({ loading: false });
                wx.showToast({
                    title: '网络错误',
                    icon: 'none'
                });
            });
    },

    // 领取优惠券
    claimCoupon(e) {
        const couponId = e.currentTarget.dataset.id;
        const coupon = this.data.coupons.find(c => c.id === couponId);
        
        if (!coupon) return;
        if (coupon.remaining_count === 0) return; // 已领完

        // 检查用户是否登录
        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录后领取优惠券',
                confirmText: '去登录',
                success: (res) => {
                    if (res.confirm) {
                        wx.navigateTo({ url: '/pages/login/index' });
                    }
                }
            });
            return;
        }

        wx.showLoading({ title: '领取中...', mask: true });

        API.claimCoupon(token, couponId)
            .then(res => {
                wx.hideLoading();
                console.log('领取优惠券响应:', res);
                if (res.code === 0) {
                    wx.showToast({
                        title: '领取成功',
                        icon: 'success'
                    });
                    // 刷新优惠券列表
                    this.loadCoupons();
                } else {
                    wx.showToast({
                        title: res.msg || '领取失败',
                        icon: 'none',
                        duration: 2000
                    });
                }
            })
            .catch(error => {
                wx.hideLoading();
                console.error('领取优惠券失败:', error);
                wx.showToast({
                    title: '领取失败',
                    icon: 'none'
                });
            });
    },

    // 获取优惠券显示文本
    getCouponDisplayText(coupon) {
        if (coupon.coupon_type === 'discount') {
            return `满${coupon.min_purchase_amount}减${coupon.discount_amount}`;
        } else if (coupon.coupon_type === 'percentage') {
            const rate = Math.round(coupon.discount_rate * 100);
            return `${rate}折优惠`;
        } else if (coupon.coupon_type === 'cash') {
            return `${coupon.discount_amount}元现金券`;
        }
        return coupon.name;
    }
});