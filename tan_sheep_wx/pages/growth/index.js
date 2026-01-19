// 使用 require 导入 echarts
const echarts = require('../../utils/echarts/echarts');

Page({
  data: {
    searchId: '',
    sheepInfo: null,
    noDataFound: false,
    isLoading: false,
    now: '', // 当前日期，用于判断疫苗是否过期
    ec: {
      onInit: null // 初始化函数稍后设置
    }
  },

  onInputChange(e) {
    this.setData({
      searchId: e.detail.value
    });
  },

  onSearch: function() {
    const { searchId } = this.data;
    if (!searchId) {
      wx.showToast({
        title: '请输入羊的ID',
        icon: 'none'
      });
      return;
    }

    // 清空之前的数据
    this.setData({
      sheepInfo: null,
      noDataFound: false,
      isLoading: true
    });

    wx.showLoading({
      title: '查询中...',
      mask: true
    });

    const API = require('../../utils/api.js');
    
    API.request(`/api/growth/sheep/${searchId}`, 'GET')
      .then((res) => {
        wx.hideLoading();
        console.log('[生长周期] API返回数据:', res);
        
        if (res && res.id) {
          // 确保数据格式正确
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          
          const sheepInfo = {
            id: res.id,
            gender: res.gender || '',
            weight: parseFloat(res.weight || 0).toFixed(1),
            height: parseFloat(res.height || 0).toFixed(1),
            length: parseFloat(res.length || 0).toFixed(1),
            growth_records: (res.growth_records || []).map(record => ({
              ...record,
              weight: parseFloat(record.weight || 0).toFixed(1),
              height: parseFloat(record.height || 0).toFixed(1),
              length: parseFloat(record.length || 0).toFixed(1)
            })),
            feeding_records: res.feeding_records || [],
            vaccination_records: (res.vaccination_records || []).map(record => ({
              ...record,
              is_valid: record.expiry_date && record.expiry_date >= todayStr
            }))
          };
          
          this.setData({
            sheepInfo: sheepInfo,
            noDataFound: false,
            isLoading: false
          }, () => {
            // 延迟初始化图表，确保DOM已渲染
            setTimeout(() => {
              if (this.chart) {
                const option = this.getChartOption();
                this.chart.setOption(option);
              }
            }, 200);
          });
        } else {
          this.setData({
            sheepInfo: null,
            noDataFound: true,
            isLoading: false
          });
          wx.showToast({
            title: '未找到数据',
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        console.error('[生长周期] 请求失败', err);
        this.setData({
          sheepInfo: null,
          noDataFound: true,
          isLoading: false
        });
        wx.showToast({
          title: err.message || '网络错误',
          icon: 'none',
          duration: 2000
        });
      });
  },

  onReady() {
    // 绑定图表初始化函数
    this.initChart = this.initChart.bind(this);
    this.setData({
      ec: {
        onInit: this.initChart
      }
    });
  },
  
  onLoad() {
    // 页面加载时初始化
    console.log('[生长周期] 页面加载');
    // 设置当前日期
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setData({
      now: dateStr
    });
  },

  initChart(canvas, width, height, dpr) {
    // 初始化图表
    this.chart = echarts.init(canvas, null, {
      width: width,
      height: height,
      devicePixelRatio: dpr // new
    });
    canvas.setChart(this.chart);

    const option = this.getChartOption();
    this.chart.setOption(option);
    return this.chart;
  },

  getChartOption() {
    const { sheepInfo } = this.data;
    if (!sheepInfo || !sheepInfo.growth_records || sheepInfo.growth_records.length === 0) {
      console.log('[生长周期] 没有生长记录数据，返回空配置');
      return {
        title: {
          text: '暂无生长记录数据',
          left: 'center',
          top: 'center',
          textStyle: {
            fontSize: 14,
            color: '#999'
          }
        }
      };
    }

    // 确保记录按日期排序（不修改原数组）
    const sortedRecords = [...sheepInfo.growth_records].sort((a, b) => {
      const dateA = new Date(a.record_date);
      const dateB = new Date(b.record_date);
      return dateA - dateB;
    });

    const dates = sortedRecords.map(record => record.record_date);
    const weights = sortedRecords.map(record => parseFloat(record.weight) || 0);
    const heights = sortedRecords.map(record => parseFloat(record.height) || 0);
    const lengths = sortedRecords.map(record => parseFloat(record.length) || 0);

    console.log('[生长周期] 图表数据:', { dates, weights, heights, lengths });

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        }
      },
      legend: {
        data: ['体重 (kg)', '身高 (cm)', '体长 (cm)'],
        top: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: '体重 (kg)',
          type: 'line',
          data: weights,
          smooth: true,
          itemStyle: {
            color: '#ff6b6b'
          },
          lineStyle: {
            color: '#ff6b6b'
          }
        },
        {
          name: '身高 (cm)',
          type: 'line',
          data: heights,
          smooth: true,
          itemStyle: {
            color: '#51cf66'
          },
          lineStyle: {
            color: '#51cf66'
          }
        },
        {
          name: '体长 (cm)',
          type: 'line',
          data: lengths,
          smooth: true,
          itemStyle: {
            color: '#4dabf7'
          },
          lineStyle: {
            color: '#4dabf7'
          }
        }
      ]
    };
  },

  // 监听数据更新，重新渲染图表
  onShow() {
    if (this.chart && this.data.sheepInfo) {
      const option = this.getChartOption();
      this.chart.setOption(option);
    }
  },

  onUnload() {
    if (this.chart) {
      this.chart.dispose();
    }
  }
});
