// pages/trace/detail.js
// 扫码后的溯源详情页：通过 sheep_id 拉取完整生命周期数据
const API = require('../../utils/api.js');

Page({
    data: {
        sheepId: null,
        sheep: null,
        loading: true,
        error: null,
        vaccineExpanded: true,
        growthExpanded: true,
        feedExpanded: false,
    },

    onLoad(options) {
        const sheepId = options.sheep_id || options.id;
        const earTag  = options.ear_tag;
        if (sheepId) {
            this.setData({ sheepId });
            this.fetchBySheepId(sheepId);
        } else if (earTag) {
            this.fetchByEarTag(earTag);
        } else {
            this.setData({ loading: false, error: '缺少羊只标识参数' });
        }
    },

    fetchBySheepId(id) {
        wx.showLoading({ title: '溯源查询中', mask: true });
        API.request('/api/public/trace/' + id, 'GET')
            .then(res => {
                wx.hideLoading();
                if (res.code === 0) {
                    this.setData({ sheep: res.data, loading: false, error: null });
                } else {
                    this.setData({ loading: false, error: res.msg || '查询失败' });
                }
            })
            .catch(err => {
                wx.hideLoading();
                this.setData({ loading: false, error: this._fmtError(err) });
            });
    },

    fetchByEarTag(earTag) {
        wx.showLoading({ title: '溯源查询中', mask: true });
        API.request('/api/sheep/trace?ear_tag=' + encodeURIComponent(earTag), 'GET')
            .then(res => {
                wx.hideLoading();
                const sheep = (res && res.id) ? res : (res && res.data ? res.data : null);
                if (sheep && sheep.id) {
                    this.fetchBySheepId(sheep.id);
                } else {
                    this.setData({ loading: false, error: '未找到该羊只信息' });
                }
            })
            .catch(err => {
                wx.hideLoading();
                this.setData({ loading: false, error: this._fmtError(err) });
            });
    },

    toggleSection(e) {
        const key = e.currentTarget.dataset.key;
        this.setData({ [key]: !this.data[key] });
    },

    previewQRCode() {
        const url = this.data.sheep && this.data.sheep.qr_code;
        if (url) wx.previewImage({ urls: [url], current: url });
    },

    retry() {
        this.setData({ loading: true, error: null });
        if (this.data.sheepId) this.fetchBySheepId(this.data.sheepId);
    },

    goBack() { wx.navigateBack(); },

    _fmtError(err) {
        if (!err) return '查询失败，请稍后重试。';
        if (err.statusCode === 404) return '未找到该羊只溯源信息，请检查二维码是否正确。';
        if (err.statusCode >= 500) return '服务器繁忙，请稍后再试。';
        if (err.errMsg && err.errMsg.indexOf('timeout') !== -1) return '网络请求超时，请检查网络连接。';
        return '查询失败，请稍后重试。';
    }
});