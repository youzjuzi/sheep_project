// pages/adopt/index.js
// 定制领养页面 - 羊只筛选（高端生鲜电商风格重构版）
const API = require('../../utils/api.js');

// 防抖定时器
let debounceTimer = null;

Page({
    data: {
        // 性别选项 - 单选
        selectedGender: '',
        
        // 体重选项 - 多选
        weightOptions: [
            { value: '20-30kg', label: '20-30kg', desc: '幼羊期' },
            { value: '30-40kg', label: '30-40kg', desc: '成长期' },
            { value: '40-50kg', label: '40-50kg', desc: '育肥期' },
            { value: '50kg+', label: '50kg+', desc: '即将出栏' }
        ],
        selectedWeights: [false, false, false, false],
        
        // 体高选项 - 多选
        heightOptions: [
            { value: '55-65cm', label: '55-65cm', desc: '矮壮型' },
            { value: '65-75cm', label: '65-75cm', desc: '标准型' },
            { value: '75-85cm', label: '75-85cm', desc: '高挑型' },
            { value: '85cm+', label: '85cm+', desc: '特高型' }
        ],
        selectedHeights: [false, false, false, false],
        
        // 体长选项 - 多选
        lengthOptions: [
            { value: '60-70cm', label: '60-70cm', desc: '紧凑型' },
            { value: '70-80cm', label: '70-80cm', desc: '匀称型' },
            { value: '80-90cm', label: '80-90cm', desc: '修长型' },
            { value: '90-100cm', label: '90-100cm', desc: '大体型' },
            { value: '100-110cm', label: '100-110cm', desc: '超大体型' },
            { value: '110cm+', label: '110cm+', desc: '特大型' }
        ],
        selectedLengths: [false, false, false, false, false, false],
        
        // 动态显示的羊只数量
        sheepCount: 0,
        
        // 加载状态
        loading: false
    },

    onLoad: function () {
        // 页面加载时获取初始数量
        this.fetchSheepCount();
    },

    // 选择性别 - 单选
    selectGender: function (e) {
        var value = e.currentTarget.dataset.value;
        this.setData({
            selectedGender: value === this.data.selectedGender ? '' : value
        });
        // 触发防抖查库
        this.triggerDebounceFetch();
    },

    // 切换体重 - 多选
    toggleWeight: function (e) {
        var index = parseInt(e.currentTarget.dataset.index);
        var selectedWeights = this.data.selectedWeights.slice();
        selectedWeights[index] = !selectedWeights[index];
        
        this.setData({ selectedWeights: selectedWeights });
        this.triggerDebounceFetch();
    },

    // 切换体高 - 多选
    toggleHeight: function (e) {
        var index = parseInt(e.currentTarget.dataset.index);
        var selectedHeights = this.data.selectedHeights.slice();
        selectedHeights[index] = !selectedHeights[index];
        
        this.setData({ selectedHeights: selectedHeights });
        this.triggerDebounceFetch();
    },

    // 切换体长 - 多选
    toggleLength: function (e) {
        var index = parseInt(e.currentTarget.dataset.index);
        var selectedLengths = this.data.selectedLengths.slice();
        selectedLengths[index] = !selectedLengths[index];
        
        this.setData({ selectedLengths: selectedLengths });
        this.triggerDebounceFetch();
    },

    // 触发防抖查库
    triggerDebounceFetch: function () {
        var that = this;
        
        // 清除之前的定时器
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        // 设置新的防抖定时器（300ms）
        debounceTimer = setTimeout(function () {
            that.fetchSheepCount();
        }, 300);
    },

    // 防抖查库方法 - 向后端请求符合条件的羊只数量
    fetchSheepCount: function () {
        var that = this;
        
        // 构建筛选参数
        var params = {};
        
        // 性别
        if (this.data.selectedGender) {
            params.gender = this.data.selectedGender;
        }
        
        // 体重（多选）
        var weights = this.getSelectedValues(this.data.weightOptions, this.data.selectedWeights);
        if (weights.length > 0) {
            params.weights = weights.join(',');
        }
        
        // 体高（多选）
        var heights = this.getSelectedValues(this.data.heightOptions, this.data.selectedHeights);
        if (heights.length > 0) {
            params.heights = heights.join(',');
        }
        
        // 体长（多选）
        var lengths = this.getSelectedValues(this.data.lengthOptions, this.data.selectedLengths);
        if (lengths.length > 0) {
            params.lengths = lengths.join(',');
        }

        // 调用后端API获取数量
        API.request('/api/sheep/count', 'GET', params)
            .then(function (res) {
                if (res && res.code === 0) {
                    that.setData({
                        sheepCount: res.count
                    });
                } else {
                    console.error('[定制领养] 获取数量失败', res);
                    that.setData({
                        sheepCount: that.mockSheepCount()
                    });
                }
            })
            .catch(function (error) {
                console.error('[定制领养] 获取数量请求失败', error);
                // 失败时使用模拟数量
                that.setData({
                    sheepCount: that.mockSheepCount()
                });
            });
    },

    // 获取选中的值数组
    getSelectedValues: function (options, selectedArr) {
        var values = [];
        selectedArr.forEach(function (selected, index) {
            if (selected) {
                var option = options[index];
                values.push(typeof option === 'object' ? option.value : option);
            }
        });
        return values;
    },

    // 模拟羊只数量（备用）
    mockSheepCount: function () {
        var baseCount = 128;
        var filters = 0;
        
        if (this.data.selectedGender) filters++;
        
        var weightCount = this.data.selectedWeights.filter(function(w) { return w; }).length;
        if (weightCount > 0) filters += weightCount * 0.3;
        
        var heightCount = this.data.selectedHeights.filter(function(h) { return h; }).length;
        if (heightCount > 0) filters += heightCount * 0.3;
        
        var lengthCount = this.data.selectedLengths.filter(function(l) { return l; }).length;
        if (lengthCount > 0) filters += lengthCount * 0.3;
        
        var count = Math.floor(baseCount * Math.pow(0.8, filters));
        return count > 0 ? count : 0;
    },

    // 搜索羊只
    searchSheep: function () {
        var that = this;
        
        // 构建筛选参数
        var params = {};
        
        if (this.data.selectedGender) {
            params.gender = this.data.selectedGender;
        }
        
        var weights = this.getSelectedValues(this.data.weightOptions, this.data.selectedWeights);
        if (weights.length > 0) {
            params.weights = weights.join(',');
        }
        
        var heights = this.getSelectedValues(this.data.heightOptions, this.data.selectedHeights);
        if (heights.length > 0) {
            params.heights = heights.join(',');
        }
        
        var lengths = this.getSelectedValues(this.data.lengthOptions, this.data.selectedLengths);
        if (lengths.length > 0) {
            params.lengths = lengths.join(',');
        }

        this.setData({ loading: true });

        // 调用后端API搜索羊只
        API.request('/api/sheep/search-multi', 'GET', params)
            .then(function (res) {
                that.setData({ loading: false });

                var sheepList = res || [];

                if (sheepList.length === 0) {
                    wx.showToast({
                        title: '未找到符合条件的羊只',
                        icon: 'none',
                        duration: 2000
                    });
                } else {
                    // 跳转到结果页面
                    var dataStr = encodeURIComponent(JSON.stringify(sheepList));
                    wx.navigateTo({
                        url: '/pages/adopt/result/result?data=' + dataStr
                    });
                }
            })
            .catch(function (error) {
                console.error('[定制领养] 搜索失败', error);
                that.setData({ loading: false });
                wx.showToast({
                    title: '搜索失败，请重试',
                    icon: 'none',
                    duration: 2000
                });
            });
    },

    // 重置筛选条件
    resetFilter: function () {
        this.setData({
            selectedGender: '',
            selectedWeights: [false, false, false, false],
            selectedHeights: [false, false, false, false],
            selectedLengths: [false, false, false, false, false, false]
        });
        
        // 重新获取数量
        this.fetchSheepCount();
        
        wx.showToast({
            title: '已重置筛选条件',
            icon: 'none',
            duration: 1500
        });
    },

    // 页面卸载时清除定时器
    onUnload: function () {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    }
});
