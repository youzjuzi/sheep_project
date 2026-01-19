// pages/adopt/result/result.js
Page({
    data: {
        sheepList: [],
        loading: false
    },
    
    onLoad: function(options) {
        // 从页面参数中获取搜索结果
        if (options.data) {
            try {
                var sheepList = JSON.parse(decodeURIComponent(options.data));
                this.setData({
                    sheepList: sheepList || []
                });
            } catch (e) {
                console.error('解析搜索结果失败', e);
                this.setData({
                    sheepList: []
                });
            }
        }
    },
    
    viewSheepDetail: function(e) {
        var sheepId = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/adopt/customize/customize?id=' + sheepId
        });
    }
});
