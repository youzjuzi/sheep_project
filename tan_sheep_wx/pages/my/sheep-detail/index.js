const API = require('../../../utils/api.js');

Page({
    data: {
        sheepId: null,
        sheepDetail: null,
        vaccineRecords: [],
        loading: true
    },

    onLoad: function (options) {
        if (options.id) {
            this.setData({ sheepId: options.id });
            this.loadSheepData(options.id);
        } else {
            wx.showToast({ title: '参数错误', icon: 'none' });
            setTimeout(() => wx.navigateBack(), 1500);
        }
    },

    loadSheepData: function (sheepId) {
        this.setData({ loading: true });

        // 获取羊只详情
        API.request(`/api/sheep/${sheepId}`, 'GET')
            .then((res) => {
                if (res && res.id) {
                    // 处理数据格式
                    const detail = {
                        id: res.id,
                        ear_tag: res.ear_tag || '暂无耳标',
                        gender: res.gender || '未知',
                        weight: res.weight ? parseFloat(res.weight).toFixed(1) : '0.0',
                        height: res.height ? parseFloat(res.height).toFixed(1) : '0.0',
                        length: res.length ? parseFloat(res.length).toFixed(1) : '0.0',
                        birth_date: res.birth_date ? res.birth_date.split('T')[0] : '暂无出生日期',
                        // 若后端暂时尚未提供这些字段，则提供占位符
                        status: res.status_display || '健康养殖中',
                        farm_name: res.farm_name || '宁夏盐池核心牧场',
                        breeder_name: res.breeder_name || '官方推荐养殖户',
                        owner_id: res.owner_id, // 确保获取 owner_id
                        qr_code: (res.qr_code && !res.qr_code.startsWith('http')) ? (API.API_BASE_URL + res.qr_code) : (res.qr_code || ''),
                        image: (res.image && !res.image.startsWith('http')) ? (API.API_BASE_URL + res.image) : (res.image || '')
                    };
                    this.setData({ sheepDetail: detail, loading: false });
                } else {
                    throw new Error('羊只不存在');
                }
            })
            .catch((error) => {
                console.error('获取羊详情失败:', error);
                this.setData({ loading: false });
                wx.showToast({ title: '加载失败', icon: 'none' });
            });

        // 获取疫苗记录
        API.request(`/vaccine_records/${sheepId}`, 'GET')
            .then((res) => {
                const records = (res || []).map(record => ({
                    ...record,
                    VaccinationDate: record.VaccinationDate ? record.VaccinationDate.split('T')[0] : ''
                }));
                this.setData({ vaccineRecords: records });
            })
            .catch((err) => console.error('获取疫苗失败:', err));
    },

    // 预览二维码图片
    previewQRCode: function () {
        const qrCodeUrl = this.data.sheepDetail.qr_code;
        if (qrCodeUrl) {
            wx.previewImage({
                urls: [qrCodeUrl] // 需要预览的图片 http 链接列表
            });
        }
    },

    // 预览羊只照片
    previewSheepImage: function () {
        const imageUrl = this.data.sheepDetail.image;
        if (imageUrl) {
            wx.previewImage({
                urls: [imageUrl]
            });
        }
    },

    // 查看生长记录或监控视频的占位方法
    viewMonitor: function () {
        wx.showToast({ title: '牧场监控接入中...', icon: 'none' });
    },

    // 跳转到养殖户详情
    viewBreederDetail: function (e) {
        const breederId = e.currentTarget.dataset.id;
        if (breederId) {
            wx.navigateTo({
                url: `/pages/breeder/my1/my1?id=${breederId}`
            });
        } else {
            wx.showToast({ title: '暂无养殖户信息', icon: 'none' });
        }
    }
});
