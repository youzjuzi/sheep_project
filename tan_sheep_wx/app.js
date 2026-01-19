const AUTH = require('./utils/auth');

App({
    globalData: {
        coupons: [], // 确保这个数组被定义
        isLoginChecked: false, // 是否已检查登录状态
        isCheckingLogin: false, // 是否正在检查登录状态（防止重复检查）
        startTime: 0,
        pageVisits: {},
        apiCalls: 0,
        errors: 0,
        usedCouponsIds: [],
        // 不需要登录的白名单页面
        loginWhiteList: [
            'pages/login/index',
            'pages/index/index',  // 首页允许未登录访问，但某些功能需要登录
            'pages/breeder/index',  // 养殖户列表页面，允许未登录访问
            'pages/breeder/my3/my3',  // 养殖户详情页面，允许未登录访问
            'pages/search/index',  // 搜索页面允许未登录访问
            'pages/category/index',  // 分类页面允许未登录访问
            'pages/goodsdetail/goodsdetail'  // 商品详情页面，允许未登录访问
        ]
    },
    onLaunch: function () {
        this.globalData.startTime = Date.now();
        this.setupMonitoring();
        // 暂时不检查登录，直接进入主页
        // 所有页面都可以未登录访问
        this.globalData.isLoginChecked = true;
    },
    
    // 检查登录状态（暂时禁用，所有页面都可以未登录访问）
    checkLogin: function() {
        var that = this;
        // 暂时不检查登录，直接标记为已检查
        that.globalData.isLoginChecked = true;
        that.globalData.isCheckingLogin = false;
        // 所有页面都可以未登录访问，不需要拦截
        return;
    },
    onError(error) {
        console.error('Global error:', error)
        // 错误报告功能已禁用（开发环境）
        // 如果需要启用，请配置正确的错误报告服务器地址
        /*
        const API = require('./utils/api.js');
        wx.request({
            url: API.API_BASE_URL + '/api/error/report',
            method: 'POST',
            data: {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            },
            success(res) {
                console.log('Error reported successfully', res)
            },
            fail(err) {
                console.error('Failed to report error', err)
            }
        })
        */
    },
    setupMonitoring: function () {
        var that = this;
        // 监控页面访问
        wx.onAppRoute(function(res) {
            var path = res.path;
            if (!that.globalData.pageVisits[path]) {
                that.globalData.pageVisits[path] = {
                    pagePath: path,
                    count: 0
                };
            }
            that.globalData.pageVisits[path].count++;
            
            // 暂时不检查登录，所有页面都可以未登录访问
            // 标记已检查，不需要登录
            that.globalData.isLoginChecked = true;
        });

        // 监控API调用
        var originalRequest = wx.request;
        wx.request = function(options) {
            that.globalData.apiCalls++;
            return originalRequest(options);
        };

        // 监控错误
        wx.onError(function(error) {
            that.globalData.errors++;
            console.error('App Error:', error);
        });
    },

});