// pages/adopt/index.js
// 定制领养页面 - 羊只筛选
const API = require('../../utils/api.js');

Page({
    data: {
        categories: ["雄性", "雌性"],
        selectedCategory: '',
        selectedCategoryIndex: -1,
        weightOptions: ['20-30kg', '30-40kg', '40-50kg', '50kg+'],
        selectedWeight: '', 
        heightOptions: ['55-60cm', '60-65cm', '65-70cm', '70-75cm', '75-80cm', '80-85cm', '85-90cm', '90-95cm', '95-100cm'],
        selectedHeight: '', 
        lengthOptions: ['55-60cm', '60-65cm', '65-70cm', '70-75cm', '75-80cm', '80-85cm', '85-90cm', '90-95cm', '95-100cm'],
        selectedLength: '',
        loading: false
    }, 
    selectGender: function (e) {
        var value = e.currentTarget.dataset.value;
        var index = this.data.categories.indexOf(value);
        this.setData({
            selectedCategory: value === this.data.selectedCategory ? '' : value,
            selectedCategoryIndex: value === this.data.selectedCategory ? -1 : index
        });
    },
    onGenderChange: function (e) {
        var index = parseInt(e.detail.value);
        this.setData({
            selectedCategory: this.data.categories[index],
            selectedCategoryIndex: index
        });
    },
    selectWeight: function (e) {
        var value = e.currentTarget.dataset.value;
        this.setData({
            selectedWeight: value === this.data.selectedWeight ? '' : value
        });
    },
    selectHeight: function (e) {
        var value = e.currentTarget.dataset.value;
        this.setData({
            selectedHeight: value === this.data.selectedHeight ? '' : value
        });
    },
    selectLength: function (e) {
        var value = e.currentTarget.dataset.value;
        this.setData({
            selectedLength: value === this.data.selectedLength ? '' : value
        });
    },
    onLoad: function () {
        // 页面加载时可以加载默认数据或执行初始搜索
    },
    searchSheep: function () {
        var that = this;
        var gender = this.data.selectedCategory;
        var weight = this.data.selectedWeight;
        var height = this.data.selectedHeight;
        var length = this.data.selectedLength;
        
        // 构建查询参数
        var params = {};
        if (gender) {
            params.gender = gender;
        }
        if (weight) {
            params.weight = weight;
        }
        if (height) {
            params.height = height;
        }
        if (length) {
            params.length = length;
        }
        
        // 如果没有选择任何条件，提示用户
        if (!gender && !weight && !height && !length) {
            wx.showToast({
                title: '请至少选择一个筛选条件',
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        this.setData({
            loading: true
        });
        
        // 调用搜索API
        var queryString = Object.keys(params).map(function(key) {
            return key + '=' + encodeURIComponent(params[key]);
        }).join('&');
        
        API.request('/api/sheep/search?' + queryString, 'GET')
            .then(function(res) {
                that.setData({
                    loading: false
                });
                
                var sheepList = res || [];
                
                if (sheepList.length === 0) {
                    wx.showToast({
                        title: '未找到符合条件的羊只',
                        icon: 'none',
                        duration: 2000
                    });
                } else {
                    // 跳转到结果页面，传递搜索结果
                    var dataStr = encodeURIComponent(JSON.stringify(sheepList));
                    wx.navigateTo({
                        url: '/pages/adopt/result/result?data=' + dataStr
                    });
                }
            })
            .catch(function(error) {
                console.error('搜索失败', error);
                that.setData({
                    loading: false
                });
                wx.showToast({
                    title: '搜索失败，请重试',
                    icon: 'none',
                    duration: 2000
                });
            });
    },
    viewSheepDetail: function (e) {
        var sheepId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/adopt/customize/customize?id=' + sheepId
        });
    },
    resetFilter: function () {
        this.setData({
            selectedCategory: '',
            selectedCategoryIndex: -1,
            selectedWeight: '',
            selectedHeight: '',
            selectedLength: ''
        });
    }
});
