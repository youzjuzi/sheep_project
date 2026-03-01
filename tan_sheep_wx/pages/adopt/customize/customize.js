// 在文件顶部引入API，避免在函数内部require导致路径解析问题
// 注意：此页面在 subPackage 中，路径需要从 subPackage root 计算
// subPackage root 是 pages/adopt，所以需要向上三级到达项目根目录
const API = require('../../../utils/api.js');

Page({
    data: {
        sheepId: null,
        sheepDetail: {},
        imagePath: '/images/icons/function/f1.png',
        growthRecords: [],
        vaccineRecords: [],
        adoptStatus: 'available',    // available | in_my_cart | adopted_by_me | adopted_by_others
        adoptStatusText: '领养'      // 按鈕显示文字
    },

    onLoad: function (options) {
        if (options.id) {
            const sheepId = options.id;
            this.setData({ sheepId: sheepId });
            this.getSheepDetail(sheepId);
            this.fetchGrowthRecords(sheepId);
            this.fetchVaccineRecords(sheepId);
            this.checkAdoptStatus(sheepId);
        }
    },

    // 查询羊只领养状态
    checkAdoptStatus: function (sheepId) {
        const that = this;
        const token = wx.getStorageSync('token') || '';
        API.request(`/api/sheep/${sheepId}/status?token=${token}`, 'GET')
            .then((res) => {
                if (res.code === 0 && res.data) {
                    that.setData({
                        adoptStatus: res.data.status,
                        adoptStatusText: res.data.status_text
                    });
                }
            })
            .catch(() => {
                that.setData({ adoptStatus: 'available', adoptStatusText: '领养' });
            });
    },

    // 领养按鈕点击事件
    adoptSheep: function () {
        const that = this;
        if (this.data.adoptStatus === 'in_my_cart') {
            wx.switchTab({ url: '/pages/cart/index' });
            return;
        }
        if (this.data.adoptStatus !== 'available') return;

        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录后再领养',
                confirmText: '去登录',
                success: function (res) {
                    if (res.confirm) wx.navigateTo({ url: '/pages/login/index' });
                }
            });
            return;
        }

        const sheepId = this.data.sheepId || this.data.sheepDetail.id;
        if (!sheepId) {
            wx.showToast({ title: '羊只信息不完整', icon: 'none' });
            return;
        }

        const price = this.data.sheepDetail.price || 0;
        wx.showLoading({ title: '处理中...', mask: true });

        API.addToCart(token, sheepId, 1, price)
            .then((res) => {
                wx.hideLoading();
                if (res.code === 0) {
                    that.setData({ adoptStatus: 'in_my_cart', adoptStatusText: '去购物车支付' });
                    wx.showModal({
                        title: '已加入购物车',
                        content: '该羊只已加入购物车。完成支付后，才算领养成功。是否立即前往购物车结算？',
                        confirmText: '去购物车',
                        cancelText: '稍后再说',
                        success: function (modalRes) {
                            if (modalRes.confirm) {
                                wx.switchTab({ url: '/pages/cart/index' });
                            }
                        }
                    });
                } else {
                    wx.showToast({ title: res.msg || '领养失败', icon: 'none' });
                }
            })
            .catch(() => {
                wx.hideLoading();
                wx.showToast({ title: '网络错误，请重试', icon: 'none' });
            });
    },

    // 获取羊只详细信息
    getSheepDetail: function (sheepId) {
        API.request(`/api/sheep/${sheepId}`, 'GET')
            .then((res) => {
                if (!res || typeof res !== 'object') return;
                const sheepDetail = {
                    id: res.id || sheepId,
                    ear_tag: res.ear_tag || '',
                    gender: res.gender || '未知',
                    weight: res.weight ? parseFloat(res.weight).toFixed(1) : '0',
                    height: res.height ? parseFloat(res.height).toFixed(1) : '0',
                    length: res.length ? parseFloat(res.length).toFixed(1) : '0',
                    birth_date: res.birth_date || '',
                    price: res.price ? parseFloat(res.price).toFixed(2) : '0.00',
                    farm_name: res.farm_name || '宁夏盐池滩羊核心产区',
                    breeder_name: res.breeder_name || '官方牧场',
                    image: res.image || ''
                };
                // 转换图片为绝对 URL
                if (sheepDetail.image && !sheepDetail.image.startsWith('http://') && !sheepDetail.image.startsWith('https://')) {
                    sheepDetail.image = API.API_BASE_URL + sheepDetail.image;
                }
                const imagePath = sheepDetail.image || this.data.imagePath;
                this.setData({ sheepDetail, imagePath });
            })
            .catch((error) => {
                console.error('[获取羊只详情] 请求失败:', error);
                wx.showToast({ title: '羊信息获取失败', icon: 'none', duration: 2000 });
            });
    },

    // 获取生长记录
    fetchGrowthRecords: function (sheepId) {
        API.request(`/api/growth/sheep/${sheepId}`, 'GET')
            .then((res) => {
                const records = (res && res.growth_records) ? res.growth_records : [];
                this.setData({ growthRecords: records });
            })
            .catch((error) => {
                console.error('获取生长记录失败:', error);
            });
    },

    // 获取疫苗接种记录
    fetchVaccineRecords: function (sheepId) {
        API.request(`/vaccine_records/${sheepId}`, 'GET')
            .then((res) => {
                const formattedRecords = (res || []).map(record => ({
                    ...record,
                    VaccinationDate: this.formatDate(record.VaccinationDate),
                    ExpiryDate: this.formatDate(record.ExpiryDate)
                }));
                this.setData({ vaccineRecords: formattedRecords });
            })
            .catch((error) => {
                console.error('获取疫苗记录失败:', error);
            });
    },

    // 日期格式化
    formatDate: function (dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // 图片加载错误处理
    onImageError: function (e) {
        console.warn('图片加载失败:', e.detail);
        this.setData({ imagePath: '/images/icons/function/f1.png' });
    }
});
