Page({
  data: {
    // 使用本地图片路径，避免HTTP协议和服务器依赖问题
    imageUrls: [
      '/images/banners/A.jpg',
      '/images/banners/B.jpg',
      '/images/banners/C.jpg'
    ],
    // 备用服务器图片（如果本地图片不存在，可以切换到服务器）
    serverImageUrls: [
      'http://localhost:5001/images/banners/A.jpg',
      'http://localhost:5001/images/banners/B.jpg',
      'http://localhost:5001/images/banners/C.jpg'
    ],
    // 视频路径（使用临时文件路径）
    videoUrls: [
      '', // zx1.mp4
      '', // zx2.mp4
      ''  // zx3.mp4
    ],
    // 视频是否可用
    videosAvailable: false,
    // 滩羊咨询内容（视频和文字信息混合）
    consultationItems: [],
    longitude: 116.397428,
    latitude: 39.90923,
    scale: 14,
    localPath: '',
    // 功能图标路径（仅使用本地路径，不使用网络）
    functionIcons: {
      f1: '/images/icons/function/f1.png',        // 定制领养
      f3: '/images/icons/function/f3.png',        // 盐池县地图
      f4: '/images/icons/function/f4.png',        // 优惠活动
      f5: '/images/icons/function/f5-1.png',      // 生长周期
      f6: '/images/icons/function/f6.png',        // 场地监控
      f7: '/images/icons/function/f7.png',        // 日常饲料
      f8: '/images/icons/function/f8.png',        // 养殖户
      food: '/images/icons/function/food.png'     // 滩羊食谱
    },
    showQAChat: false  // 控制智能问答悬浮窗显示
  },

  onLoad() {
    this.mapCtx = wx.createMapContext('myMap');
    // 检查图片是否可以加载
    this.checkImages();
    // 先初始化咨询内容（使用文字内容）
    this.initConsultationItems();
    // 然后加载视频文件（如果视频可用，会在加载完成后更新）
    this.loadVideos();
  },

  // 检查图片加载
  checkImages() {
    const imageUrls = this.data.imageUrls;
    let failedCount = 0;
    
    imageUrls.forEach((url, index) => {
      wx.getImageInfo({
        src: url,
        success: () => {
          console.log(`图片 ${index + 1} 加载成功: ${url}`);
        },
        fail: () => {
          console.warn(`图片 ${index + 1} 加载失败，URL: ${url}`);
          failedCount++;
          // 如果所有本地图片都失败，提示用户检查图片文件是否存在
          if (failedCount === imageUrls.length) {
            console.warn('所有本地图片加载失败，请检查 images/banners/ 目录下是否有图片文件');
            wx.showToast({
              title: '轮播图加载失败',
              icon: 'none',
              duration: 2000
            });
          }
        }
      });
    });
  },

  // 图片加载错误处理
  onImageError(e) {
    console.error('轮播图加载错误:', e.detail);
    const index = e.currentTarget.dataset.index;
    console.warn(`图片${index + 1}加载失败`);
    
    // 如果本地图片加载失败，尝试使用服务器图片（需要确保服务器运行）
    // 注意：小程序可能不支持HTTP，建议使用本地图片
    // const serverUrls = this.data.serverImageUrls;
    // if (serverUrls && serverUrls[index]) {
    //   const currentUrls = [...this.data.imageUrls];
    //   currentUrls[index] = serverUrls[index];
    //   this.setData({ imageUrls: currentUrls });
    // }
  },

  onReady() {
    // uCharts 相关代码已移除，如需使用图表功能请重新配置
    // const cWidth = 750 / 750 * wx.getSystemInfoSync().windowWidth;
    // const cHeight = 500 / 750 * wx.getSystemInfoSync().windowWidth;
    // const pixelRatio = wx.getSystemInfoSync().pixelRatio;
    // this.setData({ cWidth, cHeight, pixelRatio });
    // this.getServerData();
  },

  // uCharts 相关代码已移除，如需使用图表功能请重新配置
  // getServerData() {
  //   setTimeout(() => {
  //     let res = {
  //       categories: ["2016", "2017", "2018", "2019", "2020", "2021"],
  //       series: [
  //         {
  //           name: "目标值",
  //           data: [35, 36, 31, 33, 13, 34]
  //         },
  //         {
  //           name: "完成量",
  //           data: [18, 27, 21, 24, 6, 28]
  //         }
  //       ]
  //     };
  //     this.drawCharts('afMCYQMEmXXVAjNQFJvvfxbLSHuxNEOL', res);
  //   }, 500);
  // },

  // drawCharts(id, data) {
  //   const query = wx.createSelectorQuery().in(this);
  //   query.select('#' + id).fields({ node: true, size: true }).exec(res => {
  //     if (res[0]) {
  //       const canvas = res[0].node;
  //       const ctx = canvas.getContext('2d');
  //       canvas.width = res[0].width * this.data.pixelRatio;
  //       canvas.height = res[0].height * this.data.pixelRatio;
  //       uChartsInstance[id] = new uCharts({
  //         animation: true,
  //         background: "#FFFFFF",
  //         canvas2d: true,
  //         categories: data.categories,
  //         color: ["#1890FF", "#91CB74", "#FAC858", "#EE6666", "#73C0DE", "#3CA272", "#FC8452", "#9A60B4", "#ea7ccc"],
  //         context: ctx,
  //         extra: {
  //           column: {
  //             type: "group",
  //             width: 30,
  //             activeBgColor: "#000000",
  //             activeBgOpacity: 0.08
  //           }
  //         },
  //         height: this.data.cHeight * this.data.pixelRatio,
  //         legend: {},
  //         padding: [15, 15, 0, 5],
  //         pixelRatio: this.data.pixelRatio,
  //         series: data.series,
  //         type: "column",
  //         width: this.data.cWidth * this.data.pixelRatio,
  //         xAxis: {
  //           disableGrid: true
  //         },
  //         yAxis: {
  //           data: [
  //             {
  //               min: 0
  //             }
  //           ]
  //         }
  //       });
  //     } else {
  //       console.error("[uCharts]: 未获取到 context");
  //     }
  //   });
  // },

  // tap(e) {
  //   if (uChartsInstance[e.target.id]) {
  //     uChartsInstance[e.target.id].touchLegend(e);
  //     uChartsInstance[e.target.id].showToolTip(e);
  //   }
  // },

  goToFeature1() {
    wx.navigateTo({
      url: '/pages/adopt/index'
    });
  },

  getLocalPath() {
    // 获取本地路径的方法，可根据需要实现
    console.log('getLocalPath called');
  },

  // 加载视频文件
  // 注意：微信小程序的video组件不支持直接播放本地路径的mp4文件
  // 需要使用网络路径（HTTPS）或者将视频上传到云存储
  // 开发环境可以使用HTTP，但需要在开发者工具中开启"不校验合法域名"
  loadVideos() {
    var that = this;
    
    // 使用本地服务器路径（开发环境）
    // 服务器地址：http://localhost:5001
    // 视频文件位置：server/images/coupon/video/
    const SERVER_URL = 'http://localhost:5001';
    var videoUrls = [
      `${SERVER_URL}/images/coupon/video/zx1.mp4`,
      `${SERVER_URL}/images/coupon/video/zx2.mp4`,
      `${SERVER_URL}/images/coupon/video/zx3.mp4`
    ];
    
    this.setData({
      videoUrls: videoUrls,
      videosAvailable: true
    });
    
    console.log('视频路径已配置，使用本地服务器：', videoUrls);
    console.log('提示：开发环境需要在微信开发者工具中开启"不校验合法域名"');
  },


  // 初始化咨询内容（视频和文字信息混合，随机显示）
  initConsultationItems() {
    // 检查哪些视频可用
    const availableVideos = [];
    if (this.data.videoUrls[0]) availableVideos.push(0);
    if (this.data.videoUrls[1]) availableVideos.push(1);
    if (this.data.videoUrls[2]) availableVideos.push(2);
    
    // 所有可用的咨询内容
    const allItems = [
      // 视频内容（只在视频可用时添加）
      ...(availableVideos.includes(0) ? [{
        type: 'video',
        title: '1600元的宁夏盐池滩羊，没有膻味的羊？做成手抓羊肉，有多美味？',
        videoIndex: 0,
        date: '2024-01-15'
      }] : []),
      ...(availableVideos.includes(1) ? [{
        type: 'video',
        title: '宁夏盐池滩羊，被誉为羊肉界的顶流，肉质鲜嫩多汁，不腥不膻，味道鲜美！',
        videoIndex: 1,
        date: '2024-01-10'
      }] : []),
      ...(availableVideos.includes(2) ? [{
        type: 'video',
        title: '宁夏美食vlog｜在存在感最低的省份，见证世界顶级滩羊的一百种死法',
        videoIndex: 2,
        date: '2024-01-05'
      }] : []),
      // 文字信息内容
      {
        type: 'text',
        title: '【新品发布】2024年春季滩羊领养活动正式开启',
        content: '春季是滩羊生长的黄金时期，我们推出了限时领养优惠活动。现在领养可享受8折优惠，更有专业养殖指导服务。活动时间：2024年3月1日-3月31日。',
        date: '2024-03-01',
        tag: '活动'
      },
      {
        type: 'text',
        title: '【养殖知识】滩羊春季饲养要点',
        content: '春季气温回升，滩羊进入快速生长期。建议增加优质干草和精饲料的配比，注意补充维生素和矿物质。同时要做好疫苗接种和驱虫工作，确保羊群健康。',
        date: '2024-02-28',
        tag: '知识'
      },
      {
        type: 'text',
        title: '【市场动态】盐池滩羊价格持续稳定',
        content: '根据最新市场监测数据，盐池滩羊价格保持稳定，优质滩羊价格在每斤120-160元之间。预计春季需求增加，价格可能小幅上涨，建议有需求的客户提前预订。',
        date: '2024-02-25',
        tag: '市场'
      },
      {
        type: 'text',
        title: '【健康提示】如何识别优质滩羊',
        content: '优质滩羊特征：1. 体型匀称，肌肉发达；2. 毛色纯正，光泽良好；3. 眼睛明亮，精神状态好；4. 食欲正常，无异常症状。选择时建议查看生长记录和疫苗接种情况。',
        date: '2024-02-20',
        tag: '健康'
      },
      {
        type: 'text',
        title: '【食谱推荐】春季滩羊肉的最佳烹饪方式',
        content: '春季滩羊肉质鲜嫩，推荐清炖、红烧、手抓等烹饪方式。清炖可保留原汁原味，红烧适合搭配时令蔬菜，手抓羊肉配蒜泥和辣椒面，口感更佳。详细做法请查看"滩羊食谱"模块。',
        date: '2024-02-15',
        tag: '食谱'
      },
      {
        type: 'text',
        title: '【养殖户风采】优秀养殖户张师傅的养殖经验分享',
        content: '张师傅从事滩羊养殖20余年，拥有丰富的养殖经验。他分享道："科学饲喂是关键，要根据不同生长阶段调整饲料配比。同时要注重环境卫生，定期消毒，做好疾病预防工作。"',
        date: '2024-02-10',
        tag: '经验'
      },
      {
        type: 'text',
        title: '【营养科普】滩羊肉的营养价值',
        content: '滩羊肉富含优质蛋白质、维生素B群、铁、锌等营养成分。蛋白质含量高达20%以上，脂肪含量适中，易于消化吸收。具有温补作用，适合冬季进补，对体虚、贫血等有良好效果。',
        date: '2024-02-05',
        tag: '营养'
      }
    ];

    // 随机选择3-5个内容
    // 如果有视频可用，至少包含1个视频和1个文字；否则只选择文字内容
    const minVideos = availableVideos.length > 0 ? 1 : 0;
    const selectedItems = this.randomSelectItems(allItems, 3, 5, minVideos);
    
    this.setData({
      consultationItems: selectedItems
    });
  },

  // 更新咨询内容中的视频（当视频加载成功后）
  updateConsultationVideos() {
    const items = this.data.consultationItems;
    // 视频URL已经更新，只需要标记视频可用
    // 这里可以添加额外的逻辑，比如重新渲染
    console.log('咨询内容中的视频已更新');
  },

  // 随机选择内容项
  randomSelectItems: function(allItems, minCount, maxCount, minVideos) {
    minVideos = minVideos || 0;
    
    // 打乱数组
    var shuffled = allItems.slice().sort(function() {
      return Math.random() - 0.5;
    });
    
    // 分类视频和文字
    var videos = [];
    var texts = [];
    
    for (var i = 0; i < shuffled.length; i++) {
      if (shuffled[i].type === 'video') {
        videos.push(shuffled[i]);
      } else {
        texts.push(shuffled[i]);
      }
    }
    
    var selected = [];
    
    // 至少添加指定数量的视频（如果有）
    if (minVideos > 0 && videos.length > 0) {
      var videoCount = Math.min(minVideos, videos.length);
      for (var i = 0; i < videoCount; i++) {
        selected.push(videos[i]);
      }
    }
    
    // 至少添加1个文字
    if (texts.length > 0) {
      selected.push(texts[0]);
    }
    
    // 随机添加剩余内容，直到达到随机数量
    var remaining = [];
    for (var i = 0; i < shuffled.length; i++) {
      var isSelected = false;
      for (var j = 0; j < selected.length; j++) {
        if (shuffled[i] === selected[j]) {
          isSelected = true;
          break;
        }
      }
      if (!isSelected) {
        remaining.push(shuffled[i]);
      }
    }
    
    var targetCount = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
    var needMore = targetCount - selected.length;
    
    if (needMore > 0 && remaining.length > 0) {
      var additional = remaining.slice(0, needMore);
      for (var k = 0; k < additional.length; k++) {
        selected.push(additional[k]);
      }
    }
    
    // 再次打乱顺序
    return selected.sort(function() {
      return Math.random() - 0.5;
    });
  },

  // 视频加载错误处理
  onVideoError(e) {
    console.error('视频加载错误:', e.detail);
    const errMsg = e.detail.errMsg || '';
    
    if (errMsg.includes('MEDIA_ERR_SRC_NOT_SUPPORTED')) {
      console.warn('视频格式不支持或路径错误，尝试重新加载');
      // 可以尝试重新加载视频
      this.loadVideos();
    }
    
    wx.showToast({
      title: '视频加载失败',
      icon: 'none',
      duration: 2000
    });
  },

  // 智能问答悬浮窗控制
  onQAChatOpen() {
    this.setData({
      showQAChat: true
    });
  },

  onQAChatClose() {
    this.setData({
      showQAChat: false
    });
  }
});
