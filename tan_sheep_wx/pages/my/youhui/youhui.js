// pages/my/youhui/youhui.js
const API = require('../../../utils/api.js');

Page({
    data: {
        coupons: [],
        unusedCoupons: [],
        usedCoupons: [],
        expiredCoupons: [],
        currentCoupons: [],
        loading: false,
        activeTab: 'unused',
    },

    onLoad(options) {
        this.loadUserCoupons();
    },

    onShow() {
        this.loadUserCoupons();
    },

    onPullDownRefresh() {
        this.loadUserCoupons().finally(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 加载用户优惠券
    loadUserCoupons() {
        var token = wx.getStorageSync('token');
        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录',
                success: function (res) {
                    if (res.confirm) {
                        wx.navigateTo({ url: '/pages/login/index' });
                    } else {
                        wx.navigateBack();
                    }
                }
            });
            return Promise.resolve();
        }

        this.setData({ loading: true });

        return API.getUserCoupons(token)
            .then(res => {
                console.log('用户优惠券数据:', res);
                if (res.code === 0 && res.data) {
                    // 按状态分类
                    const unused = res.data.filter(c => c.status === 'unused');
                    const used = res.data.filter(c => c.status === 'used');
                    const expired = res.data.filter(c => c.status === 'expired');

                    // 预处理优惠券数据，添加显示文本
                    const processCoupons = (list) => {
                        return list.map(coupon => {
                            return {
                                ...coupon,
                                displayText: this.getCouponDisplayText(coupon)
                            };
                        });
                    };

                    this.setData({
                        coupons: res.data,
                        unusedCoupons: processCoupons(unused),
                        usedCoupons: processCoupons(used),
                        expiredCoupons: processCoupons(expired),
                        loading: false
                    });
                    // 更新当前显示的优惠券
                    this.updateCurrentCoupons(this.data.activeTab);
                } else {
                    wx.showToast({
                        title: res.msg || '加载失败',
                        icon: 'none'
                    });
                    this.setData({ loading: false });
                }
            })
            .catch(error => {
                console.error('加载用户优惠券失败:', error);
                wx.showToast({
                    title: '加载失败: ' + (error.message || '未知错误'),
                    icon: 'none'
                });
                this.setData({ loading: false });
            });
    },

    // 切换标签
    changeTab(e) {
        const tab = e.currentTarget.dataset.tab;
        this.updateCurrentCoupons(tab);
        this.setData({
            activeTab: tab
        });
    },

    // 更新当前显示的优惠券列表
    updateCurrentCoupons(activeTab) {
        const { unusedCoupons = [], usedCoupons = [], expiredCoupons = [] } = this.data;
        let currentCoupons = [];
        if (activeTab === 'unused') {
            currentCoupons = unusedCoupons;
        } else if (activeTab === 'used') {
            currentCoupons = usedCoupons;
        } else if (activeTab === 'expired') {
            currentCoupons = expiredCoupons;
        }
        this.setData({
            currentCoupons: currentCoupons
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
    },

    // 使用优惠券
    useCoupon(e) {
        const couponId = e.currentTarget.dataset.id;
        wx.showModal({
            title: '使用优惠券',
            content: '确定要使用这张优惠券吗？',
            success: (res) => {
                if (res.confirm) {
                    // 这里可以跳转到商品页面或订单页面
                    wx.showToast({
                        title: '优惠券已使用',
                        icon: 'success'
                    });
                }
            }
        });
    }
});
