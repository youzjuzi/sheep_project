// pages/trace/detail.js
const API = require('../../utils/api.js');

Page({
    data: {
        earTag: '',
        sheepInfo: null,
        loading: true,
        error: null
    },

    onLoad(options) {
        const earTag = options.ear_tag;
        if (earTag) {
            this.setData({ earTag: earTag });
            this.fetchSheepInfo(earTag);
        } else {
            this.setData({
                loading: false,
                error: '缺少耳标编号参数'
            });
        }
    },

    /**
     * 根据耳标编号查询羊只信息
     */
    fetchSheepInfo(earTag) {
        console.log('[溯源查询] 查询耳标:', earTag);

        wx.showLoading({
            title: '查询中...',
            mask: true
        });

        API.request(`/api/sheep/trace?ear_tag=${encodeURIComponent(earTag)}`, 'GET')
            .then((res) => {
                wx.hideLoading();
                console.log('[溯源查询] 查询成功:', res);

                this.setData({
                    sheepInfo: res,
                    loading: false,
                    error: null
                });
            })
            .catch((error) => {
                wx.hideLoading();
                console.error('[溯源查询] 查询失败:', error);

                // 将技术错误转换为用户友好的提示
                let userMessage = '查询失败，请稍后重试';

                // 根据不同的错误类型给出不同的提示
                if (error.statusCode === 404) {
                    userMessage = `未找到耳标编号为 ${earTag} 的羊只\n\n请检查耳标编号是否正确`;
                } else if (error.statusCode === 400) {
                    userMessage = '耳标编号格式不正确\n\n请输入正确的耳标编号';
                } else if (error.statusCode >= 500) {
                    userMessage = '服务器繁忙，请稍后再试';
                } else if (error.errMsg) {
                    if (error.errMsg.indexOf('timeout') !== -1) {
                        userMessage = '网络请求超时\n\n请检查网络连接后重试';
                    } else if (error.errMsg.indexOf('fail') !== -1) {
                        userMessage = '网络连接失败\n\n请检查网络设置';
                    }
                }

                this.setData({
                    loading: false,
                    error: userMessage
                });
            });
    },

    /**
     * 重新查询
     */
    retry() {
        if (this.data.earTag) {
            this.setData({ loading: true, error: null });
            this.fetchSheepInfo(this.data.earTag);
        }
    },

    /**
     * 返回上一页
     */
    goBack() {
        wx.navigateBack();
    }
});
