const fs = require('fs');

const TOKEN_FILE = '/data/token.json';

// Default appkey used by iSolarCloud
const DEFAULT_APPKEY = 'B0455FBE7AA0328DB57B59AA729F05D8';

class ISolarCloudAPI {
  constructor(config) {
    this.username = config.username;
    this.password = config.password;
    this.host = config.host;
    this.appkey = DEFAULT_APPKEY;
    this.token = null;
    this.userId = null;
    this.loadToken();
  }

  loadToken() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
        this.token = data.token;
        this.userId = data.userId;
        console.log('Loaded saved token');
      }
    } catch (err) {
      console.error('Failed to load token:', err.message);
    }
  }

  saveToken() {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        token: this.token,
        userId: this.userId,
        savedAt: new Date().toISOString()
      }, null, 2));
    } catch (err) {
      console.error('Failed to save token:', err.message);
    }
  }

  clearToken() {
    this.token = null;
    this.userId = null;
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
    } catch (err) {
      console.error('Failed to clear token:', err.message);
    }
  }

  async request(endpoint, body = {}, requiresToken = true) {
    const url = `${this.host}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      'sys_code': '901',
      'x-access-key': this.appkey,
    };

    const requestBody = {
      appkey: this.appkey,
      lang: '_en_US',
      ...body,
    };

    if (requiresToken && this.token) {
      requestBody.token = this.token;
    }

    console.log(`API Request: ${endpoint}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    console.log(`API Response: ${endpoint}`, data.result_code, data.result_msg);

    // Check for token errors
    if (data.result_code === 'E00003' || data.result_msg === 'er_token_login_invalid') {
      console.log('Token invalid, attempting re-login...');
      this.token = null;
      const loginSuccess = await this.login();
      if (loginSuccess) {
        // Retry the request
        return this.request(endpoint, body, requiresToken);
      }
      throw new Error('Authentication failed');
    }

    if (data.result_code !== '1') {
      throw new Error(data.result_msg || `API error: ${data.result_code}`);
    }

    return data;
  }

  async login() {
    if (!this.username || !this.password) {
      throw new Error('Username and password required');
    }

    console.log(`Logging in as ${this.username}...`);

    const data = await this.request('/openapi/login', {
      user_account: this.username,
      user_password: this.password,
    }, false);

    const result = data.result_data;

    if (result.login_state === '1' && result.token) {
      this.token = result.token;
      this.userId = result.user_id;
      this.saveToken();
      console.log('Login successful');
      return true;
    }

    // Handle login errors
    const loginErrors = {
      '-1': 'Account does not exist',
      '0': 'Incorrect password',
      '2': 'Account locked due to incorrect password',
      '5': 'Account locked by admin',
    };

    const errorMsg = loginErrors[result.login_state] || result.msg || 'Login failed';
    throw new Error(errorMsg);
  }

  isAuthenticated() {
    return !!this.token;
  }

  async getPlantList() {
    if (!this.token) {
      await this.login();
    }

    const data = await this.request('/openapi/getPowerStationList', {
      curPage: 1,
      size: 100,
    });

    return data.result_data;
  }

  async getPlantDetail(sn) {
    if (!this.token) {
      await this.login();
    }

    const data = await this.request('/openapi/getPowerStationDetail', {
      sn: sn,
      is_get_ps_remarks: '1',
    });

    return data.result_data;
  }

  async getRealTimeData(psKeyList, deviceType = 11) {
    if (!this.token) {
      await this.login();
    }

    // Key measuring points for different device types
    const pointIds = [
      // Inverter points
      '1', '2', '24', '25',  // Yield today, total, active power, reactive power
      // Energy storage points
      '13011', '13012', '13112', '13134', // Active power, reactive, daily/total PV yield
      '13141', '13142', '13143', // Battery SOC, SOH, temp
      '13028', '13029', '13034', '13035', // Battery charge/discharge today/total
      '13119', '13130', '13199', // Load power, total consumption, daily consumption
      '13121', '13122', '13125', // Feed-in power, today, total
      '13147', '13148', '13149', // Purchased today, total, power
      '13126', '13150', // Battery charging/discharging power
      '13138', '13139', // Battery voltage, current
    ];

    const data = await this.request('/openapi/getDevicePointMinuteDataList', {
      device_type: deviceType,
      point_id_list: pointIds,
      ps_key_list: psKeyList,
    });

    return data.result_data;
  }
}

module.exports = { ISolarCloudAPI };
