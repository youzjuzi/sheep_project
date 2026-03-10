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
                            // 确保 owner 字段存在，后端 API 返回结构可能是 coupon.coupon.owner 或直接 coupon.owner
                            // 根据 API 代码，UserCoupon 返回时字段是平铺的，但 owner 信息可能没有带出来？
                            // 检查 promotion_api.py 的 api_coupons 方法：
                            // UserCoupon 返回的结构里，owner 信息好像没有包含在内！
                            // 只返回了 coupon_id, name, code, ... discount_amount 等。
                            // 这是一个 BUG。后端 api_coupons 在返回 user_coupons 时漏掉了 owner 信息。
                            // 我们需要先修复后端 API，或者前端做容错。
                            // 但前端校验依赖 owner 信息，所以必须修复后端。
                            
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
        const coupon = this.data.currentCoupons.find(c => c.id === couponId);
        
        if (!coupon) return;

        // 获取购物车数据进行校验
        const token = wx.getStorageSync('token');
        if (!token) {
            wx.navigateTo({ url: '/pages/login/index' });
            return;
        }

        wx.showLoading({ title: '校验中...', mask: true });
        
        API.getCart(token).then(res => {
            wx.hideLoading();
            
            // 修正：API 返回的是 {code:0, data:[...]}，需要解构
            if (res.code !== 0) {
                wx.showToast({ title: res.msg || '获取购物车失败', icon: 'none' });
                return;
            }
            const cartItems = res.data || [];
            
            if (cartItems.length === 0) {
                wx.showModal({
                    title: '无法使用',
                    content: '购物车为空，请先去选购商品',
                    confirmText: '去选购',
                    success: (res) => {
                        if (res.confirm) {
                            wx.switchTab({ url: '/pages/adopt/index' });
                        }
                    }
                });
                return;
            }

            // 筛选符合条件的商品
            let validItems = [];
            let validAmount = 0;

            if (coupon.owner) {
                // 养殖户专用券：只统计该养殖户的商品
                // 注意：API 返回的 cart item 中 sheep 对象增加了 owner_id 字段
                validItems = cartItems.filter(item => item.sheep && item.sheep.owner_id === coupon.owner.id);
            } else {
                // 通用券
                validItems = cartItems;
            }

            // 计算有效商品总金额
            validAmount = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            if (validItems.length === 0) {
                const ownerName = coupon.owner ? (coupon.owner.farm_name || coupon.owner.name) : '平台';
                wx.showModal({
                    title: '无法使用',
                    content: `购物车中没有购买 ${ownerName} 的商品`,
                    confirmText: '去看看',
                    success: (res) => {
                        if (res.confirm) {
                            wx.switchTab({ url: '/pages/adopt/index' });
                        }
                    }
                });
                return;
            }

            if (validAmount < coupon.min_purchase_amount) {
                wx.showModal({
                    title: '无法使用',
                    content: `未满足使用门槛 (需满 ${coupon.min_purchase_amount} 元)`,
                    showCancel: false
                });
                return;
            }
            
            // 将购物车商品存入缓存（结算页逻辑）
            // 注意：这里我们应该把所有商品带过去，但只有部分商品享受优惠。
            // 或者，如果用户想用这个券，是不是应该只结算符合条件的商品？
            // 通常电商逻辑是：去结算，然后选券。
            // 这里是：选券，去结算。
            // 假设是“把购物车所有东西都带去结算，并尝试应用这个券”。
            // 这样更符合常规逻辑，只要有一件符合就行。
            // 还是说“只结算符合条件的商品”？
            // 用户说“购物车里面有这种羊，那点击使用优惠券的时候就直接去支付界面”。
            // 假设是结算整个购物车。
            wx.setStorageSync('checkoutItems', cartItems);
            
            // 跳转到结算页，并传递优惠券ID
            wx.navigateTo({
                url: `/packageOrder/cart/checkout?user_coupon_id=${couponId}`
            });

        }).catch(err => {
            wx.hideLoading();
            wx.showToast({ title: '网络错误', icon: 'none' });
        });
    }
});

