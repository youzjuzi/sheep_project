/**
 * 腾讯地图微信小程序 JavaScript SDK
 * 简化版 - 仅包含路线规划、地点搜索、逆地理编码功能
 * 文档：https://lbs.qq.com/miniProgram/jsSdk/jsSdkGuide/jsSdkOverview
 */

var QQMapWX = function (options) {
  if (!options.key) {
    throw Error('请配置腾讯地图API Key');
  }
  this.key = options.key;
};

QQMapWX.prototype.BASE_URL = 'https://apis.map.qq.com';

/**
 * 发起请求
 */
QQMapWX.prototype._request = function (url, data, success, fail) {
  data.key = this.key;
  data.output = 'json';
  wx.request({
    url: this.BASE_URL + url,
    data: data,
    header: { 'content-type': 'application/json' },
    method: 'GET',
    success: function (res) {
      if (res.data && res.data.status === 0) {
        success && success(res.data);
      } else {
        var msg = (res.data && res.data.message) || '请求失败';
        fail && fail({ status: res.data ? res.data.status : -1, message: msg });
      }
    },
    fail: function (err) {
      fail && fail({ status: -1, message: err.errMsg || '网络请求失败' });
    }
  });
};

/**
 * 驾车路线规划
 * @param {Object} options
 * @param {String} options.from 起点坐标 "lat,lng"
 * @param {String} options.to 终点坐标 "lat,lng"
 * @param {String} options.policy 策略 LEAST_TIME/LEAST_FEE/LEAST_DISTANCE/REAL_TRAFFIC
 * @param {Function} options.success 成功回调
 * @param {Function} options.fail 失败回调
 */
QQMapWX.prototype.direction = function (options) {
  var params = {
    from: options.from,
    to: options.to,
    policy: options.policy || 'LEAST_TIME'
  };

  this._request(
    '/ws/direction/v1/driving/',
    params,
    function (data) {
      options.success && options.success({ status: 0, result: data.result });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

/**
 * 步行路线规划
 */
QQMapWX.prototype.directionWalking = function (options) {
  var params = {
    from: options.from,
    to: options.to
  };

  this._request(
    '/ws/direction/v1/walking/',
    params,
    function (data) {
      options.success && options.success({ status: 0, result: data.result });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

/**
 * 骑行路线规划
 */
QQMapWX.prototype.directionBicycling = function (options) {
  var params = {
    from: options.from,
    to: options.to
  };

  this._request(
    '/ws/direction/v1/bicycling/',
    params,
    function (data) {
      options.success && options.success({ status: 0, result: data.result });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

/**
 * 公交路线规划
 */
QQMapWX.prototype.directionTransit = function (options) {
  var params = {
    from: options.from,
    to: options.to,
    policy: options.policy || 'LEAST_TIME'
  };

  this._request(
    '/ws/direction/v1/transit/',
    params,
    function (data) {
      options.success && options.success({ status: 0, result: data.result });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

/**
 * 地点搜索（关键字搜索）
 * @param {Object} options
 * @param {String} options.keyword 关键字
 * @param {String} options.region 搜索区域，如 "盐池县"
 * @param {String} options.location 搜索中心点 "lat,lng"（周边搜索时使用）
 * @param {Function} options.success 成功回调
 * @param {Function} options.fail 失败回调
 */
QQMapWX.prototype.search = function (options) {
  var params = {
    keyword: options.keyword,
    page_size: options.page_size || 10,
    page_index: options.page_index || 1
  };

  if (options.region) {
    params.boundary = 'region(' + options.region + ',0)';
  } else if (options.location) {
    params.boundary = 'nearby(' + options.location + ',1000)';
  }

  this._request(
    '/ws/place/v1/search',
    params,
    function (data) {
      options.success && options.success({ status: 0, data: data.data || [] });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

/**
 * 逆地理编码（坐标转地址）
 * @param {Object} options
 * @param {String} options.location 坐标 "lat,lng"
 * @param {Function} options.success 成功回调
 * @param {Function} options.fail 失败回调
 */
QQMapWX.prototype.reverseGeocoder = function (options) {
  var params = {
    location: options.location
  };

  this._request(
    '/ws/geocoder/v1/',
    params,
    function (data) {
      options.success && options.success({ status: 0, result: data.result });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

/**
 * 地理编码（地址转坐标）
 * @param {Object} options
 * @param {String} options.address 地址
 * @param {String} options.region 城市/区域名
 * @param {Function} options.success 成功回调
 * @param {Function} options.fail 失败回调
 */
QQMapWX.prototype.geocoder = function (options) {
  var params = {
    address: options.address
  };
  if (options.region) {
    params.region = options.region;
  }

  this._request(
    '/ws/geocoder/v1/',
    params,
    function (data) {
      options.success && options.success({ status: 0, result: data.result });
    },
    function (err) {
      options.fail && options.fail(err);
    }
  );
};

module.exports = QQMapWX;
