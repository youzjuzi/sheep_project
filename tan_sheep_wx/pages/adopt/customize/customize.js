// 在文件顶部引入API，避免在函数内部require导致路径解析问题
// 注意：此页面在 subPackage 中，路径需要从 subPackage root 计算
// subPackage root 是 pages/adopt，所以需要向上三级到达项目根目录
const API = require('../../../utils/api.js');

Page({
    data: {
        sheepId: null,
        sheepDetail: {},
        imagePath: '/images/icons/function/f1.png', // 使用存在的图片路径作为占位图
        vaccineRecords: [],
        adoptStatus: 'available',    // available | in_my_cart | adopted_by_me | adopted_by_others
        adoptStatusText: '领养'      // 按钮显示文字
    },

    onLoad: function (options) {
        if (options.id) {
            const sheepId = options.id;
            this.setData({ sheepId: sheepId });
            this.getSheepDetail(sheepId);
            this.fetchVaccineRecords(sheepId);
            // 查询领养状态
            this.checkAdoptStatus(sheepId);
        }
    },

    // 查询羊只领养状态（从后端获取）
    checkAdoptStatus: function (sheepId) {
        const that = this;
        const token = wx.getStorageSync('token') || '';

        API.request(`/api/sheep/${sheepId}/status?token=${token}`, 'GET')
            .then((res) => {
                console.log('[领养状态] API返回:', res);
                if (res.code === 0 && res.data) {
                    that.setData({
                        adoptStatus: res.data.status,
                        adoptStatusText: res.data.status_text
                    });
                }
            })
            .catch((error) => {
                console.warn('[领养状态] 查询失败:', error);
                // 默认可领养
                that.setData({ adoptStatus: 'available', adoptStatusText: '领养' });
            });
    },

    // 领养按钮点击事件（领养 = 加入购物车，需要付费）
    adoptSheep: function () {
        const that = this;

        // 不可领养的状态，直接返回
        if (this.data.adoptStatus !== 'available') {
            return;
        }

        const token = wx.getStorageSync('token');

        // 检查是否已登录
        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录后再领养',
                confirmText: '去登录',
                success: function (res) {
                    if (res.confirm) {
                        wx.navigateTo({ url: '/pages/login/index' });
                    }
                }
            });
            return;
        }

        const sheepId = this.data.sheepId || this.data.sheepDetail.id;
        if (!sheepId) {
            wx.showToast({ title: '羊只信息不完整', icon: 'none' });
            return;
        }

        // 使用羊只自身的定价
        const price = this.data.sheepDetail.price || 0;

        wx.showLoading({ title: '处理中...', mask: true });

        // 调用后端API：领养即加入购物车
        API.addToCart(token, sheepId, 1, price)
            .then((res) => {
                wx.hideLoading();
                console.log('[领养/加入购物车] API返回:', res);

                if (res.code === 0) {
                    that.setData({
                        adoptStatus: 'in_my_cart',
                        adoptStatusText: '已在购物车中'
                    });
                    wx.showToast({
                        title: '领养成功，已加入购物车',
                        icon: 'success',
                        duration: 2000
                    });
                } else {
                    wx.showToast({ title: res.msg || '领养失败', icon: 'none' });
                }
            })
            .catch((error) => {
                wx.hideLoading();
                console.error('[领养/加入购物车] 失败:', error);
                wx.showToast({ title: '网络错误，请重试', icon: 'none' });
            });
    },

    // 获取羊只详细信息
    getSheepDetail: function (sheepId) {
        console.log('[获取羊只详情] 开始请求，sheepId:', sheepId);

        API.request(`/api/sheep/${sheepId}`, 'GET')
            .then((res) => {
                console.log('[获取羊只详情] API返回数据:', res);

                if (!res || typeof res !== 'object') {
                    console.error('[获取羊只详情] 返回数据格式错误:', res);
                    wx.showToast({ title: '数据格式错误', icon: 'none' });
                    return;
                }

                // 确保数据格式正确，转换为字符串以便显示
                const sheepDetail = {
                    id: res.id || sheepId,
                    gender: res.gender || '未知',
                    weight: res.weight ? parseFloat(res.weight).toFixed(1) : '0',
                    height: res.height ? parseFloat(res.height).toFixed(1) : '0',
                    length: res.length ? parseFloat(res.length).toFixed(1) : '0',
                    price: res.price ? parseFloat(res.price) : 0
                };

                this.setData({ sheepDetail: sheepDetail });
            })
            .catch((error) => {
                console.error('[获取羊只详情] 请求失败:', error);
                wx.showToast({ title: '羊信息获取失败', icon: 'none', duration: 2000 });
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

    // 日期格式化函数
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
