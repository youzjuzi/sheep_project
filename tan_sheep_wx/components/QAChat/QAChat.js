// components/QAChat/QAChat.js
const API = require('../../utils/api.js');

Component({
  properties: {
    // 是否显示悬浮窗
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    messages: [], // 聊天消息列表
    inputValue: '', // 输入框内容
    isLoading: false, // 是否正在加载
    scrollTop: 0, // 滚动位置
    showWindow: false, // 是否显示聊天窗口
    // 悬浮按钮位置
    floatBtnLeft: 0, // 悬浮按钮左边距
    floatBtnTop: 0, // 悬浮按钮顶部距离
    floatBtnRight: 30, // 悬浮按钮右边距（默认值）
    floatBtnBottom: 120, // 悬浮按钮底部距离（默认值）
    isDragging: false, // 是否正在拖拽
    // 预设问题
    quickQuestions: [
      '滩羊的养殖方法',
      '滩羊肉的营养价值',
      '如何挑选优质滩羊',
      '滩羊的烹饪方法',
      '滩羊的生长周期',
      '盐池滩羊的特点'
    ]
  },

  lifetimes: {
    attached() {
      // 初始化时根据 show 属性设置 showWindow
      this.setData({
        showWindow: this.properties.show
      });
      // 获取系统信息，用于计算拖拽边界
      // 使用新的API获取窗口信息
      try {
        const windowInfo = wx.getWindowInfo();
        const systemInfo = wx.getSystemInfoSync();
        // 兼容新旧API - 手动合并对象，避免使用扩展运算符
        this.systemInfo = {
          windowWidth: windowInfo.windowWidth || systemInfo.windowWidth,
          windowHeight: windowInfo.windowHeight || systemInfo.windowHeight
        };
        // 手动复制 systemInfo 的所有属性
        for (var key in systemInfo) {
          if (systemInfo.hasOwnProperty(key)) {
            this.systemInfo[key] = systemInfo[key];
          }
        }
      } catch (e) {
        // 降级使用旧API
        const systemInfo = wx.getSystemInfoSync();
        this.systemInfo = systemInfo;
      }
      
      // 尝试从本地存储恢复位置
      try {
        const savedPosition = wx.getStorageSync('qaFloatBtnPosition');
        if (savedPosition && savedPosition.left !== undefined && savedPosition.top !== undefined) {
          this.setData({
            floatBtnLeft: savedPosition.left,
            floatBtnTop: savedPosition.top,
            floatBtnRight: 0,
            floatBtnBottom: 0
          });
        }
      } catch (e) {
        console.log('读取位置失败', e);
      }
      
      // 初始化欢迎消息
      this.addMessage({
        type: 'bot',
        content: '您好！我是滩羊智品智能助手，可以为您解答关于滩羊养殖、营养、烹饪等方面的问题。请问有什么可以帮助您的吗？',
        time: this.getCurrentTime()
      });
    }
  },

  observers: {
    'show': function(show) {
      console.log('show属性变化:', show);
      this.setData({
        showWindow: show
      });
    }
  },

  methods: {
    // 获取当前时间
    getCurrentTime() {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    // 添加消息
    addMessage(message) {
      const messages = this.data.messages;
      messages.push(message);
      this.setData({
        messages: messages,
        scrollTop: messages.length * 1000 // 滚动到底部
      });
      
      // 延迟滚动，确保DOM更新
      setTimeout(() => {
        this.setData({
          scrollTop: messages.length * 1000
        });
      }, 100);
    },

    // 输入框内容变化
    onInputChange(e) {
      this.setData({
        inputValue: e.detail.value
      });
    },

    // 发送消息
    sendMessage() {
      const content = this.data.inputValue.trim();
      if (!content) {
        wx.showToast({
          title: '请输入问题',
          icon: 'none'
        });
        return;
      }

      // 添加用户消息
      this.addMessage({
        type: 'user',
        content: content,
        time: this.getCurrentTime()
      });

      // 清空输入框
      this.setData({
        inputValue: '',
        isLoading: true
      });

      // 调用API获取回答
      this.getAnswer(content);
    },

    // 快速问题点击
    onQuickQuestionTap(e) {
      const question = e.currentTarget.dataset.question;
      this.setData({
        inputValue: question
      });
      this.sendMessage();
    },

    // 获取AI回答
    getAnswer(question) {
      const that = this;
      const API = require('../../utils/api.js');
      
      // 先显示加载状态
      const loadingMessage = {
        type: 'bot',
        content: '正在思考中...',
        time: this.getCurrentTime(),
        isLoading: true
      };
      this.addMessage(loadingMessage);

      // 调用后端大模型API（支持RAG）
      API.request('/api/qa/ask', 'POST', {
        question: question
      }).then(function(res) {
        const messages = that.data.messages;
        messages.pop(); // 移除加载消息
        
        let answer = '抱歉，我暂时无法回答这个问题。';
        let modelInfo = '';
        
        if (res.code === 0 && res.data && res.data.answer) {
          answer = res.data.answer;
          
          // 添加模型信息
          if (res.data.model) {
            modelInfo = res.data.model === 'deepseek-v3' ? '（AI回答）' : '（本地回答）';
          }
          
          // 添加RAG上下文使用标识
          if (res.data.context_used === true) {
            modelInfo += ' [基于真实数据]';
          }
        } else if (res.answer) {
          // 兼容旧格式
          answer = res.answer;
        }
        
        messages.push({
          type: 'bot',
          content: answer,
          time: that.getCurrentTime(),
          isLoading: false,
          modelInfo: modelInfo
        });
        
        that.setData({
          messages: messages,
          isLoading: false,
          scrollTop: messages.length * 1000
        });
      }).catch(function(error) {
        console.error('调用大模型API失败:', error);
        // API调用失败，使用本地回答作为备用
        that.handleApiError(question);
      });
    },

    // 处理API错误，使用本地回答
    handleApiError(question) {
      const that = this;
      const answer = this.generateAnswer(question);
      
      // 移除加载消息，添加本地回答
      const messages = this.data.messages;
      messages.pop(); // 移除加载消息
      messages.push({
        type: 'bot',
        content: answer + '\n\n（注：当前使用本地回答，大模型服务暂时不可用）',
        time: this.getCurrentTime(),
        isLoading: false
      });
      
      that.setData({
        messages: messages,
        isLoading: false,
        scrollTop: messages.length * 1000
      });
    },

    // 生成回答（本地模拟，实际应该调用后端API）
    generateAnswer(question) {
      const q = question.toLowerCase();
      
      // 根据关键词匹配回答
      if (q.includes('养殖') || q.includes('饲养') || q.includes('喂养')) {
        return '滩羊养殖需要注意以下几点：\n1. 选择优质草场，确保充足的草料供应\n2. 定期进行疫苗接种和驱虫\n3. 保持圈舍清洁卫生，定期消毒\n4. 根据生长阶段调整饲料配比\n5. 注意观察羊群健康状况，及时处理疾病\n6. 提供充足的清洁饮水\n\n建议咨询专业养殖户获取更详细的指导。';
      } else if (q.includes('营养') || q.includes('价值') || q.includes('成分')) {
        return '滩羊肉富含以下营养成分：\n1. 优质蛋白质：含量高达20%以上，易于消化吸收\n2. 维生素B群：有助于新陈代谢和神经系统健康\n3. 铁元素：预防贫血，提高免疫力\n4. 锌元素：促进生长发育，增强抵抗力\n5. 低脂肪：相比其他肉类，脂肪含量适中\n6. 氨基酸：含有人体必需的多种氨基酸\n\n滩羊肉具有温补作用，适合冬季进补，对体虚、贫血等有良好效果。';
      } else if (q.includes('挑选') || q.includes('选择') || q.includes('识别')) {
        return '挑选优质滩羊的方法：\n1. 看体型：体型匀称，肌肉发达，骨骼健壮\n2. 看毛色：毛色纯正，光泽良好，无脱毛现象\n3. 看眼睛：眼睛明亮有神，无分泌物\n4. 看精神状态：活泼好动，食欲正常\n5. 看生长记录：查看疫苗接种记录和生长数据\n6. 闻气味：优质滩羊没有异味，肉质清香\n\n建议选择有完整生长记录和健康证明的滩羊。';
      } else if (q.includes('烹饪') || q.includes('做法') || q.includes('怎么吃')) {
        return '滩羊肉的常见烹饪方法：\n1. 清炖：保留原汁原味，适合老人和小孩\n2. 红烧：搭配时令蔬菜，营养丰富\n3. 手抓羊肉：配蒜泥和辣椒面，口感更佳\n4. 烤羊肉：外焦里嫩，香味浓郁\n5. 羊肉汤：温补暖身，适合冬季\n6. 涮羊肉：鲜嫩爽滑，原汁原味\n\n详细做法请查看小程序中的"滩羊食谱"模块。';
      } else if (q.includes('生长') || q.includes('周期') || q.includes('时间')) {
        return '滩羊的生长周期：\n1. 哺乳期：0-3个月，主要依靠母乳\n2. 断奶期：3-6个月，开始吃草料\n3. 育成期：6-12个月，快速生长期\n4. 成熟期：12-18个月，达到出栏标准\n5. 成年期：18个月以上，可用于繁殖\n\n不同阶段的饲养重点不同，需要根据生长阶段调整饲料和管理方式。';
      } else if (q.includes('盐池') || q.includes('特点') || q.includes('特色')) {
        return '盐池滩羊的特点：\n1. 地理优势：盐池县独特的地理环境和气候条件\n2. 肉质特点：肉质鲜嫩，不腥不膻，被誉为"羊肉界的顶流"\n3. 营养价值：富含优质蛋白质和多种微量元素\n4. 品牌价值：国家地理标志产品，品质有保障\n5. 养殖传统：拥有悠久的养殖历史和丰富的经验\n6. 市场认可：深受消费者喜爱，价格稳定\n\n盐池滩羊是宁夏的特色农产品，具有很高的市场价值。';
      } else {
        return '感谢您的提问！关于"' + question + '"的问题，我建议您：\n1. 查看小程序中的相关功能模块（如"生长周期"、"日常饲料"等）\n2. 咨询专业养殖户获取详细指导\n3. 联系客服获取更多帮助\n\n如果您有其他关于滩羊的问题，欢迎继续提问！';
      }
    },

    // 打开聊天窗口
    openChat() {
      console.log('打开聊天窗口，当前showWindow:', this.data.showWindow);
      // 先更新内部状态
      this.setData({
        showWindow: true
      });
      // 通知父组件更新 show 属性（延迟一下确保状态更新）
      setTimeout(() => {
        this.triggerEvent('open', { show: true }, { bubbles: true });
      }, 50);
    },

    // 关闭聊天窗口
    closeChat() {
      console.log('关闭聊天窗口');
      // 先更新内部状态
      this.setData({
        showWindow: false
      });
      // 通知父组件更新 show 属性
      setTimeout(() => {
        this.triggerEvent('close', { show: false }, { bubbles: true });
      }, 50);
    },

    // 清空聊天记录
    clearMessages() {
      wx.showModal({
        title: '确认清空',
        content: '确定要清空所有聊天记录吗？',
        success: (res) => {
          if (res.confirm) {
            this.setData({
              messages: []
            });
            // 重新添加欢迎消息
            this.addMessage({
              type: 'bot',
              content: '您好！我是滩羊智品智能助手，可以为您解答关于滩羊养殖、营养、烹饪等方面的问题。请问有什么可以帮助您的吗？',
              time: this.getCurrentTime()
            });
          }
        }
      });
    },

    // 拖拽开始
    onTouchStart(e) {
      if (this.data.showWindow) return; // 窗口打开时不拖拽
      
      const touch = e.touches[0];
      this.startX = touch.clientX;
      this.startY = touch.clientY;
      this.hasMoved = false; // 标记是否移动
      
      // 记录初始位置（rpx）
      this.startLeftRpx = this.data.floatBtnLeft;
      this.startTopRpx = this.data.floatBtnTop;
      this.startRightRpx = this.data.floatBtnRight;
      this.startBottomRpx = this.data.floatBtnBottom;
    },

    // 拖拽中
    onTouchMove(e) {
      if (this.data.showWindow) return;
      
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - this.startX);
      const deltaY = Math.abs(touch.clientY - this.startY);
      
      // 如果移动距离超过10px，认为是拖拽
      if (deltaX > 10 || deltaY > 10) {
        this.hasMoved = true;
        
        if (!this.data.isDragging) {
          this.setData({
            isDragging: true
          });
        }
        
        // 获取屏幕尺寸
        const screenWidth = this.systemInfo.windowWidth;
        const screenHeight = this.systemInfo.windowHeight;
        const rpxRatio = 750 / screenWidth; // rpx转px的比例
        
        // 将px转换为rpx
        const deltaXRpx = (touch.clientX - this.startX) * rpxRatio;
        const deltaYRpx = (touch.clientY - this.startY) * rpxRatio;
        
        // 计算新位置（rpx单位）
        let newLeft = 0;
        let newTop = 0;
        
        // 如果之前使用left/top定位，继续使用；否则从right/bottom转换
        if (this.startLeftRpx > 0 || this.startTopRpx > 0) {
          newLeft = this.startLeftRpx + deltaXRpx;
          newTop = this.startTopRpx + deltaYRpx;
        } else {
          // 从right/bottom转换为left/top
          newLeft = (750 - this.startRightRpx - 120) + deltaXRpx;
          newTop = (screenHeight * rpxRatio - this.startBottomRpx - 120) + deltaYRpx;
        }
        
        // 边界限制（rpx单位）
        const minLeft = 0;
        const maxLeft = 750 - 120;
        const minTop = 0;
        const maxTop = screenHeight * rpxRatio - 120;
        
        newLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
        newTop = Math.max(minTop, Math.min(maxTop, newTop));
        
        this.setData({
          floatBtnLeft: newLeft,
          floatBtnTop: newTop,
          floatBtnRight: 0, // 使用left定位时，right设为0
          floatBtnBottom: 0 // 使用top定位时，bottom设为0
        });
      }
    },

    // 拖拽结束
    onTouchEnd(e) {
      if (this.data.isDragging) {
        this.setData({
          isDragging: false
        });
        
        // 保存位置到本地存储
        wx.setStorageSync('qaFloatBtnPosition', {
          left: this.data.floatBtnLeft,
          top: this.data.floatBtnTop
        });
      }
      
      // 如果没有移动，视为点击，打开聊天窗口
      if (!this.hasMoved && !this.data.showWindow) {
        this.openChat();
      }
      
      this.hasMoved = false;
    }
  }
});

