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
        isAdopted: false,
        isInCart: false // 新增变量，标记是否已加入购物车
    },

    onLoad: function (options) {
        if (options.id) {
            const sheepId = options.id;
            this.setData({ sheepId: sheepId });
            this.getSheepDetail(sheepId);
            this.fetchVaccineRecords(sheepId);

            // 检查是否已领养
            let adoptionList = wx.getStorageSync('adoptionList') || [];
            const isAdopted = adoptionList.some(sheep => sheep.id === sheepId);
            this.setData({ isAdopted: isAdopted });

            // 检查是否已加入购物车（从数据库和本地存储都检查）
            this.checkCartStatus(sheepId);
        }
    },

    // 领养按钮点击事件处理函数
    adoptSheep: function () {
        const sheepToAdopt = this.data.sheepDetail;
        let adoptionList = wx.getStorageSync('adoptionList') || [];
        adoptionList.push({
            ...sheepToAdopt,
            adoptionDate: new Date().toISOString()
        });
        wx.setStorageSync('adoptionList', adoptionList);

        this.setData({
            isAdopted: true
        });

        wx.showToast({
            title: '领养成功',
            icon: 'success',
            duration: 2000
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
                    wx.showToast({
                        title: '数据格式错误',
                        icon: 'none'
                    });
                    return;
                }

                // 确保数据格式正确，转换为字符串以便显示
                const sheepDetail = {
                    id: res.id || sheepId,
                    gender: res.gender || '未知',
                    weight: res.weight ? parseFloat(res.weight).toFixed(1) : '0',
                    height: res.height ? parseFloat(res.height).toFixed(1) : '0',
                    length: res.length ? parseFloat(res.length).toFixed(1) : '0'
                };

                console.log('[获取羊只详情] 设置数据:', sheepDetail);
                console.log('[获取羊只详情] 当前页面数据:', this.data);

                this.setData({
                    sheepDetail: sheepDetail
                }, () => {
                    console.log('[获取羊只详情] 数据设置完成，当前sheepDetail:', this.data.sheepDetail);
                });
            })
            .catch((error) => {
                console.error('[获取羊只详情] 请求失败:', error);
                wx.showToast({
                    title: '羊信息获取失败',
                    icon: 'none',
                    duration: 2000
                });
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
                this.setData({
                    vaccineRecords: formattedRecords
                });
            })
            .catch((error) => {
                console.error('获取疫苗记录失败:', error);
                wx.showToast({
                    title: '疫苗记录获取失败',
                    icon: 'none'
                });
            });
    },

    // 日期格式化函数
    formatDate: function (dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // 加入购物车功能
    addToCart: function () {
        const that = this;
        const token = wx.getStorageSync('token');

        // 检查是否已登录
        if (!token) {
            wx.showModal({
                title: '提示',
                content: '请先登录后再加入购物车',
                confirmText: '去登录',
                success: function (res) {
                    if (res.confirm) {
                        wx.navigateTo({
                            url: '/pages/login/index'
                        });
                    }
                }
            });
            return;
        }

        // 检查是否已在购物车
        if (this.data.isInCart) {
            wx.showToast({
                title: '已在购物车中',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        const sheepId = this.data.sheepId || this.data.sheepDetail.id;
        if (!sheepId) {
            wx.showToast({
                title: '羊只信息不完整',
                icon: 'none'
            });
            return;
        }

        // 计算价格（体重 * 10）
        const price = (this.data.sheepDetail.weight || 0) * 10;

        wx.showLoading({
            title: '添加中...',
            mask: true
        });

        // 调用后端API添加到购物车
        API.addToCart(token, sheepId, 1, price)
            .then((res) => {
                wx.hideLoading();
                console.log('[加入购物车] API返回:', res);

                if (res.code === 0) {
                    // 同时更新本地存储（作为备用）
                    const cartItems = wx.getStorageSync('cartItems') || [];
                    const newItem = {
                        ...that.data.sheepDetail,
                        quantity: res.data.quantity || 1,
                        price: res.data.price || price
                    };
                    cartItems.push(newItem);
                    wx.setStorageSync('cartItems', cartItems);

                    // 更新页面状态
                    that.setData({
                        isInCart: true
                    });

                    wx.showToast({
                        title: '已加入购物车',
                        icon: 'success',
                        duration: 2000
                    });
                } else {
                    wx.showToast({
                        title: res.msg || '添加失败',
                        icon: 'none'
                    });
                }
            })
            .catch((error) => {
                wx.hideLoading();
                console.error('[加入购物车] 失败:', error);

                // API失败时，仍然保存到本地存储（降级处理）
                const cartItems = wx.getStorageSync('cartItems') || [];
                cartItems.push(that.data.sheepDetail);
                wx.setStorageSync('cartItems', cartItems);

                that.setData({
                    isInCart: true
                });

                wx.showToast({
                    title: '已加入购物车（离线模式）',
                    icon: 'success',
                    duration: 2000
                });
            });
    },

    // 检查购物车状态
    checkCartStatus: function (sheepId) {
        const that = this;
        const token = wx.getStorageSync('token');

        // 先检查本地存储
        let cartItems = wx.getStorageSync('cartItems') || [];
        let isInCart = cartItems.some(item => item.id == sheepId);

        // 如果已登录，从服务器检查
        if (token) {
            API.getCart(token)
                .then((res) => {
                    if (Array.isArray(res)) {
                        // 检查服务器购物车中是否有这个羊只
                        const inServerCart = res.some(item => item.sheep_id == sheepId || item.sheep?.id == sheepId);
                        if (inServerCart) {
                            isInCart = true;
                        }
                    }
                    that.setData({ isInCart: isInCart });
                })
                .catch((error) => {
                    console.warn('[检查购物车状态] 失败，使用本地状态:', error);
                    that.setData({ isInCart: isInCart });
                });
        } else {
            that.setData({ isInCart: isInCart });
        }
    },

    // 图片加载错误处理
    onImageError: function (e) {
        console.warn('图片加载失败:', e.detail);
        // 如果本地图片加载失败，使用一个存在的图片作为占位图
        this.setData({
            imagePath: '/images/icons/function/f1.png' // 使用功能图标作为占位图
        });
    },

    /**
     * 调试功能：查询所有羊只数据
     * 用于开发调试，查看后端返回的所有羊只信息
     */
    debugGetAllSheep: function () {
        console.log('[调试] 开始查询所有羊只');

        wx.showLoading({
            title: '查询中...',
            mask: true
        });

        // 调用API查询所有羊只（不传任何筛选参数）
        API.request('/api/sheep/search', 'GET', {})
            .then((res) => {
                wx.hideLoading();
                console.log('[调试] 查询成功，羊只数量:', res.length);
                console.log('[调试] 所有羊只数据:', res);

                // 显示查询结果
                wx.showModal({
                    title: '查询成功',
                    content: `找到 ${res.length} 只羊\n详情请查看控制台`,
                    showCancel: false,
                    success: () => {
                        // 格式化输出每只羊的信息
                        console.log('========== 羊只详细信息 ==========');
                        res.forEach((sheep, index) => {
                            console.log(`\n第 ${index + 1} 只羊:`);
                            console.log(`  ID: ${sheep.id}`);
                            console.log(`  性别: ${sheep.gender}`);
                            console.log(`  体重: ${sheep.weight} kg`);
                            console.log(`  体高: ${sheep.height} cm`);
                            console.log(`  体长: ${sheep.length} cm`);
                        });
                        console.log('===================================');
                    }
                });
            })
            .catch((error) => {
                wx.hideLoading();
                console.error('[调试] 查询失败:', error);
                wx.showModal({
                    title: '查询失败',
                    content: `错误信息: ${error.message || '未知错误'}`,
                    showCancel: false
                });
            });
    }
});
