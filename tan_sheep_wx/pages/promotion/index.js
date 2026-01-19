// pages/feature4/feature4.js
const API = require('../../utils/api.js');
const AUTH = require('../../utils/auth.js');

Page({
    data: {
        activities: [],  // 优惠活动列表
        coupons: [],     // 可领取的优惠券列表
        activeTab: 'activities',  // 当前激活的标签：activities(活动) 或 coupons(优惠券)
        loading: false,
        userInfo: null,  // 用户信息
    },

    onLoad(options) {
        this.loadUserInfo();
        this.loadActivities();
        this.loadCoupons();
    },

    onShow() {
        // 每次显示页面时刷新数据
        this.loadActivities();
        this.loadCoupons();
    },

    onPullDownRefresh() {
        this.loadActivities();
        this.loadCoupons().finally(() => {
            wx.stopPullDownRefresh();
        });
    },

    // 加载用户信息
    loadUserInfo() {
        const userInfo = AUTH.getUserInfo();
        if (userInfo) {
            this.setData({ userInfo });
        }
    },

    // 加载优惠活动列表
    loadActivities() {
        this.setData({ loading: true });
        API.request('/api/promotions/activities', 'GET')
            .then(res => {
                console.log('优惠活动数据:', res);
                if (res.code === 0 && res.data) {
                    // 预处理活动数据
                    const activities = res.data.map(activity => {
                        return {
                            ...activity,
                            remainingTime: this.getRemainingTime(activity.end_time),
                            activityTypeText: activity.activity_type === 'flash_sale' ? '限时抢购' : 
                                            activity.activity_type === 'package' ? '套餐活动' : '折扣活动'
                        };
                    });
                    this.setData({
                        activities: activities,
                        loading: false
                    });
                } else {
                    wx.showToast({
                        title: res.msg || '加载失败',
                        icon: 'none'
                    });
                    this.setData({ loading: false });
                }
            })
            .catch(error => {
                console.error('加载优惠活动失败:', error);
                wx.showToast({
                    title: '加载失败: ' + (error.message || '未知错误'),
                    icon: 'none'
                });
                this.setData({ loading: false });
            });
    },

    // 加载优惠券列表
    loadCoupons() {
        return API.request('/api/promotions/coupons', 'GET')
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
                        coupons: coupons
                    });
                } else {
                    console.error('加载优惠券失败:', res.msg);
                }
            })
            .catch(error => {
                console.error('加载优惠券失败:', error);
            });
    },

    // 切换标签
    changeTab(e) {
        const tab = e.currentTarget.dataset.tab;
        this.setData({
            activeTab: tab
        });
    },

    // 参与活动
    joinActivity(e) {
        const activityId = e.currentTarget.dataset.id;
        const activity = this.data.activities.find(a => a.id === activityId);
        
        if (!activity) {
            return;
        }

        wx.showModal({
            title: '参与活动',
            content: `确定要参与"${activity.title}"吗？`,
            success: (res) => {
                if (res.confirm) {
                    // 这里可以跳转到商品页面或订单页面
                    wx.showToast({
                        title: '活动参与成功',
                        icon: 'success'
                    });
                }
            }
        });
    },

    // 领取优惠券
    claimCoupon(e) {
        const couponId = e.currentTarget.dataset.id;
        const coupon = this.data.coupons.find(c => c.id === couponId);
        
        if (!coupon) {
            return;
        }

        // 检查用户是否登录
        const userInfo = AUTH.getUserInfo();
        if (!userInfo || !userInfo.uid) {
            wx.showModal({
                title: '提示',
                content: '请先登录',
                success: (res) => {
                    if (res.confirm) {
                        wx.navigateTo({
                            url: '/pages/login/index'
                        });
                    }
                }
            });
            return;
        }

        wx.showLoading({ title: '领取中...', mask: true });

        API.request('/api/promotions/coupons/claim', 'POST', {
            user_id: userInfo.uid,
            coupon_id: couponId
        })
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
                    // 通知优惠券页面更新
                    this.notifyCouponPageUpdate();
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
                    title: '领取失败: ' + (error.message || '未知错误'),
                    icon: 'none',
                    duration: 2000
                });
            });
    },

    // 通知优惠券页面更新
    notifyCouponPageUpdate() {
        try {
            // 获取页面栈
            const pages = getCurrentPages();
            // 查找优惠券页面（youhui页面）
            const couponPage = pages.find(page => {
                const route = page.route || '';
                return route.includes('youhui') || route.includes('my/youhui');
            });
            
            // 如果找到了优惠券页面，调用其刷新方法
            if (couponPage && typeof couponPage.loadUserCoupons === 'function') {
                console.log('通知优惠券页面更新');
                couponPage.loadUserCoupons();
            }
        } catch (error) {
            console.error('通知优惠券页面更新失败:', error);
        }
    },

    // 格式化时间
    formatTime(timeStr) {
        if (!timeStr) return '';
        const date = new Date(timeStr);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
    },

    // 计算剩余时间
    getRemainingTime(endTime) {
        if (!endTime) return '';
        const now = new Date().getTime();
        const end = new Date(endTime).getTime();
        const diff = end - now;
        
        if (diff <= 0) return '已结束';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) {
            return `剩余${days}天${hours}小时`;
        } else if (hours > 0) {
            return `剩余${hours}小时${minutes}分钟`;
        } else {
            return `剩余${minutes}分钟`;
        }
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
