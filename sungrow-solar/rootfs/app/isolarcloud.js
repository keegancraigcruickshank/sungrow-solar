const fs = require('fs');

const TOKEN_FILE = '/data/token.json';

class ISolarCloudAPI {
  constructor(config) {
    this.username = config.username;
    this.password = config.password;
    this.host = config.host;
    this.appkey = config.appkey;
    this.secretKey = config.secretKey;
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

    // Headers as per docs section 1.3 (5)
    // x-access-key is the secret key, appkey goes in the body
    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      'sys_code': '901',
      'x-access-key': this.secretKey,
    };

    console.log('Headers:', JSON.stringify(headers, null, 2));

    // Request body as per docs section 1.3 (6)
    const requestBody = {
      appkey: this.appkey,
      lang: '_en_US',
      ...body,
    };

    if (requiresToken && this.token) {
      requestBody.token = this.token;
    }

    console.log(`API Request: ${endpoint}`);
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Raw response:', responseText.substring(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response:', responseText.substring(0, 200));
      throw new Error('Invalid response from API');
    }

    console.log(`API Response: ${endpoint}`, data.result_code, data.result_msg);

    // Check for token errors
    if (data.result_code === 'E00003' || data.result_msg === 'er_token_login_invalid') {
      console.log('Token invalid, attempting re-login...');
      this.token = null;
      const loginSuccess = await this.login();
      if (loginSuccess) {
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

    if (!this.appkey) {
      throw new Error('App key required - get it from iSolarCloud developer portal');
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

  async getDeviceRealTimeData(psKeyList, deviceType = 14) {
    if (!this.token) {
      await this.login();
    }

    // Energy Storage System (device_type 14) measuring points
    const pointIds = [
      // Power metrics
      '13011',  // Active Power (W)
      '13012',  // Total Reactive Power (var)
      '13003',  // Total DC Power (W)
      '13119',  // Load Power (W)
      '13121',  // Feed-in Power (W)
      '13149',  // Purchased Power (W)
      '13126',  // Battery Charging Power (W)
      '13150',  // Battery Discharging Power (W)

      // Energy metrics
      '13112',  // Daily PV Yield (Wh)
      '13134',  // Total PV Yield (Wh)
      '13122',  // Feed-in Energy Today (Wh)
      '13125',  // Total Feed-in Energy (Wh)
      '13147',  // Energy Purchased Today (Wh)
      '13148',  // Total Purchased Energy (Wh)
      '13199',  // Daily Load Consumption (Wh)
      '13130',  // Total Load Consumption (Wh)

      // Battery metrics
      '13141',  // Battery Level (SOC) %
      '13142',  // Battery Health (SOH) %
      '13143',  // Battery Temperature (°C)
      '13138',  // Battery Voltage (V)
      '13139',  // Battery Current (A)
      '13028',  // Battery Charging Energy Today (Wh)
      '13029',  // Battery Discharging Energy Today (Wh)
      '13034',  // Total Battery Charging Energy (Wh)
      '13035',  // Total Battery Discharging Energy (Wh)
      '13140',  // Battery Capacity (Wh)

      // Grid metrics
      '13157',  // Phase A Voltage (V)
      '13158',  // Phase B Voltage (V)
      '13159',  // Phase C Voltage (V)
      '13007',  // Grid Frequency (Hz)

      // PV metrics
      '13001',  // MPPT1 Voltage (V)
      '13002',  // MPPT1 Current (A)
      '13105',  // MPPT2 Voltage (V)
      '13106',  // MPPT2 Current (A)
    ];

    const data = await this.request('/openapi/getDeviceRealTimeData', {
      device_type: deviceType,
      point_id_list: pointIds,
      ps_key_list: psKeyList,
    });

    return data.result_data;
  }

  // Get device list for a plant to find ps_keys
  async getDeviceList(psId) {
    if (!this.token) {
      await this.login();
    }

    const data = await this.request('/openapi/getDeviceList', {
      ps_id: psId,
      curPage: 1,
      size: 100,
    });

    return data.result_data;
  }
}

module.exports = { ISolarCloudAPI };
