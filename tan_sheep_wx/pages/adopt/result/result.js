// pages/adopt/result/result.js
const API = require('../../../utils/api.js');

Page({
    data: {
        sheepList: [],
        pagedSheepList: [],
        loading: false,
        currentPage: 1,
        pageSize: 10,
        totalPages: 1,
        jumpPageInput: ''
    },

    onLoad: function(options) {
        // 从页面参数中获取搜索结果
        if (options.data) {
            try {
                var sheepList = JSON.parse(decodeURIComponent(options.data));
                const baseUrl = API.API_BASE_URL;
                (sheepList || []).forEach(item => {
                    if (item.image && !item.image.startsWith('http://') && !item.image.startsWith('https://')) {
                        item.image = baseUrl + item.image;
                    }
                });
                this.setData({
                    sheepList: sheepList || [],
                    currentPage: 1,
                    jumpPageInput: ''
                });
                this.updatePagedList();
            } catch (e) {
                console.error('解析搜索结果失败', e);
                this.setData({
                    sheepList: [],
                    pagedSheepList: [],
                    currentPage: 1,
                    totalPages: 1,
                    jumpPageInput: ''
                });
            }
        }
    },

    // 更新当前页数据
    updatePagedList: function () {
        var list = this.data.sheepList || [];
        var pageSize = this.data.pageSize || 10;
        var totalPages = Math.max(1, Math.ceil(list.length / pageSize));
        var currentPage = this.data.currentPage;

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        if (currentPage < 1) {
            currentPage = 1;
        }

        var start = (currentPage - 1) * pageSize;
        var end = start + pageSize;

        this.setData({
            totalPages: totalPages,
            currentPage: currentPage,
            pagedSheepList: list.slice(start, end)
        });
    },

    // 首页
    goFirstPage: function () {
        if (this.data.currentPage <= 1) return;
        this.setData({
            currentPage: 1
        });
        this.updatePagedList();
    },

    // 上一页
    goPrevPage: function () {
        if (this.data.currentPage <= 1) return;
        this.setData({
            currentPage: this.data.currentPage - 1
        });
        this.updatePagedList();
    },

    // 下一页
    goNextPage: function () {
        if (this.data.currentPage >= this.data.totalPages) return;
        this.setData({
            currentPage: this.data.currentPage + 1
        });
        this.updatePagedList();
    },

    // 末页
    goLastPage: function () {
        if (this.data.currentPage >= this.data.totalPages) return;
        this.setData({
            currentPage: this.data.totalPages
        });
        this.updatePagedList();
    },

    // 输入跳转页码
    onJumpInput: function (e) {
        this.setData({
            jumpPageInput: e.detail.value
        });
    },

    // 跳转到指定页
    jumpToPage: function () {
        var input = this.data.jumpPageInput;
        var target = parseInt(input, 10);
        var totalPages = this.data.totalPages || 1;

        if (!target || isNaN(target)) {
            wx.showToast({
                title: '请输入页码',
                icon: 'none'
            });
            return;
        }

        if (target < 1) target = 1;
        if (target > totalPages) target = totalPages;

        this.setData({
            currentPage: target,
            jumpPageInput: ''
        });
        this.updatePagedList();
    },

    viewSheepDetail: function(e) {
        var sheepId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/adopt/customize/customize?id=' + sheepId
        });
    }
});
