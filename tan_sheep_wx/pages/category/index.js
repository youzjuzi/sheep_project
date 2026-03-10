Page({
    data: {
        imageList: [
            { src: '/images/icons/function/f1.png' }
        ],
        sheepList: [
            {
                id: '1',
                title: '羊1',
                gender: '公',
                birthdate: '2023-01-01',
                height: '120',
                length: '150',
                weight: '50',
                price: '300',
                sheepId: '25',
                breederId: '3',
                breederPhone: '15120392430'
            },
            // 添加更多羊只信息
        ],
        sheepDetail: {},
        cartItems: [],
        isInCart: false,
        isBuyNowModalVisible: false,  // 控制购买确认弹窗的显示
    },

    onLoad: function (options) {
        if (options.id) {
            const sheepId = options.id;
            this.setData({ sheepId: sheepId });
            this.loadData(sheepId);
        } else {
            wx.showToast({
                title: '无效的羊只ID',
                icon: 'error'
            });
        }
    },

    loadData: function (sheepId) {
        this.getSheepDetail(sheepId);
        this.fetchVaccineRecords(sheepId);
        this.checkAdoptionAndCartStatus(sheepId);
    },

    // 显示购买确认弹窗
    openBuyNowModal: function () {
        this.setData({
            isBuyNowModalVisible: true  // 将弹窗显示状态设置为 true
        });
    },

    // 关闭购买确认弹窗
    closeBuyNowModal: function () {
        this.setData({
            isBuyNowModalVisible: false  // 将弹窗显示状态设置为 false
        });
    },

    // 确认购买
    confirmBuyNow: function () {
        const sheepDetail = this.data.sheepDetail;
        wx.navigateTo({
            url: `/packageOrder/cart/checkout?id=${sheepDetail.id}`
        });
        this.closeBuyNowModal();  // 确认购买后关闭弹窗
    },

    // 格式化日期
    formatDate: function (dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },

    // 将羊只加入购物车
    addToCart: function () {
        if (this.data.isInCart) {
            wx.showToast({
                title: '已在购物车中',
                icon: 'none',
                duration: 2000
            });
            return;
        }

        const cartItems = wx.getStorageSync('cartItems') || [];
        const newItem = {
            ...this.data.sheepDetail,
            quantity: 1,
            price: this.data.sheepDetail.weight * 10, // 假设价格是重量*10
            imagePath: this.data.imagePath
        };
        cartItems.push(newItem);
        wx.setStorageSync('cartItems', cartItems);

        this.setData({
            isInCart: true
        });

        wx.showToast({
            title: '已加入购物车',
            icon: 'success',
            duration: 2000
        });

        wx.navigateTo({
            url: '/pages/cart/cart'
        });
    },
    buyNow: function (e) {
        const sheepDetail = this.data.sheepDetail;
        wx.navigateTo({
            url: `/packageOrder/cart/checkout?id=${sheepDetail.id}`
        });
    }
});

