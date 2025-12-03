const fs = require('fs');
const path = require('path');

const TOKEN_FILE = '/data/tokens.json';

// Plant measuring points we care about
const MEASURING_POINTS = {
  // Power
  '83033': { name: 'Plant Power', unit: 'W' },
  '83002': { name: 'Inverter AC Power', unit: 'W' },
  '83067': { name: 'PV Active Power', unit: 'W' },
  '83106': { name: 'Load Power', unit: 'W' },
  '83549': { name: 'Grid Active Power', unit: 'W' },

  // Daily yields
  '83022': { name: 'Daily Yield', unit: 'Wh' },
  '83009': { name: 'Inverter Daily Yield', unit: 'Wh' },
  '83072': { name: 'Feed-in Energy Today', unit: 'Wh' },
  '83102': { name: 'Energy Purchased Today', unit: 'Wh' },
  '83118': { name: 'Daily Load Consumption', unit: 'Wh' },
  '83097': { name: 'Daily Direct Consumption', unit: 'Wh' },

  // Totals
  '83024': { name: 'Total Yield', unit: 'Wh' },
  '83004': { name: 'Inverter Total Yield', unit: 'Wh' },
  '83075': { name: 'Feed-in Energy Total', unit: 'Wh' },
  '83105': { name: 'Total Purchased Energy', unit: 'Wh' },
  '83124': { name: 'Total Load Consumption', unit: 'Wh' },
  '83100': { name: 'Total Direct Consumption', unit: 'Wh' },

  // Battery
  '83129': { name: 'Battery SOC', unit: '%' },
  '83252': { name: 'Battery Level', unit: '%' },
  '83232': { name: 'Total Field SOC', unit: '%' },
  '83243': { name: 'Daily Charge', unit: 'Wh' },
  '83244': { name: 'Daily Discharge', unit: 'Wh' },
  '83241': { name: 'Total Charge', unit: 'Wh' },
  '83242': { name: 'Total Discharge', unit: 'Wh' },
  '83326': { name: 'Battery Power', unit: 'W' },

  // Other
  '83025': { name: 'Equivalent Hours', unit: 'h' },
  '83023': { name: 'Plant PR', unit: '' },
  '83016': { name: 'Ambient Temperature', unit: '°C' },
  '83017': { name: 'Module Temperature', unit: '°C' },
  '83012': { name: 'Irradiation', unit: 'W/m²' },
};

class ISolarCloudAPI {
  constructor(config) {
    this.appkey = config.appkey;
    this.accessKey = config.accessKey;
    this.host = config.host;
    this.tokens = this.loadTokens();
  }

  loadTokens() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = fs.readFileSync(TOKEN_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load tokens:', err.message);
    }
    return null;
  }

  saveTokens(tokens) {
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
      this.tokens = tokens;
    } catch (err) {
      console.error('Failed to save tokens:', err.message);
    }
  }

  clearTokens() {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
      }
      this.tokens = null;
    } catch (err) {
      console.error('Failed to clear tokens:', err.message);
    }
  }

  getAuthorizationUrl(redirectUri) {
    // Build OAuth authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.appkey,
      redirect_uri: redirectUri,
    });
    return `${this.host}/openapi/oauth/authorize?${params.toString()}`;
  }

  async request(endpoint, body = {}, requiresAuth = true) {
    const url = `${this.host}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json;charset=UTF-8',
      'x-access-key': this.accessKey,
    };

    const requestBody = {
      appkey: this.appkey,
      lang: '_en_US',
      ...body,
    };

    // Add authorization header if we have a token
    if (requiresAuth && this.tokens?.access_token) {
      requestBody.Authorization = `Bearer ${this.tokens.access_token}`;
    }

    console.log(`API Request: ${endpoint}`);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error === 'invalid_token' || data.result_code === '401') {
      // Token expired, try refresh
      if (this.tokens?.refresh_token) {
        console.log('Token expired, attempting refresh...');
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request
          return this.request(endpoint, body, requiresAuth);
        }
      }
      throw new Error('Authentication required');
    }

    if (data.result_code && data.result_code !== '1') {
      throw new Error(data.result_msg || `API error: ${data.result_code}`);
    }

    return data;
  }

  async exchangeCodeForToken(code, redirectUri) {
    const data = await this.request('/openapi/apiManage/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }, false);

    if (data.result_code === '1' && data.result_data?.access_token) {
      const tokens = {
        access_token: data.result_data.access_token,
        refresh_token: data.result_data.refresh_token,
        expires_in: data.result_data.expires_in,
        expires_at: Date.now() + (parseInt(data.result_data.expires_in) * 1000),
        auth_ps_list: data.result_data.auth_ps_list,
        auth_user: data.result_data.auth_user,
      };
      this.saveTokens(tokens);
      return tokens;
    }

    throw new Error(data.result_msg || 'Failed to exchange code for token');
  }

  async refreshToken() {
    if (!this.tokens?.refresh_token) {
      return false;
    }

    try {
      const data = await this.request('/openapi/apiManage/refreshToken', {
        refresh_token: this.tokens.refresh_token,
      }, false);

      if (data.result_data?.code === 1 || data.result_data?.access_token) {
        const tokens = {
          ...this.tokens,
          access_token: data.result_data.access_token,
          refresh_token: data.result_data.refresh_token,
          expires_in: data.result_data.expires_in,
          expires_at: Date.now() + (parseInt(data.result_data.expires_in) * 1000),
        };
        this.saveTokens(tokens);
        return true;
      }
    } catch (err) {
      console.error('Token refresh failed:', err.message);
    }

    return false;
  }

  isAuthenticated() {
    return !!(this.tokens?.access_token);
  }

  getAuthorizedPlants() {
    return this.tokens?.auth_ps_list || [];
  }

  async getPlantList(options = {}) {
    const data = await this.request('/openapi/platform/queryPowerStationList', {
      ps_type: options.psType || '1,3,4,5,6,7,8,12',
      valid_flag: options.validFlag || '1,3',
      page: options.page || 1,
      size: options.size || 50,
    });

    return data.result_data;
  }

  async getRealTimeData(psIds) {
    if (!psIds || psIds.length === 0) {
      throw new Error('No plant IDs provided');
    }

    const pointIds = Object.keys(MEASURING_POINTS);

    const data = await this.request('/openapi/platform/getPowerStationRealTimeData', {
      ps_id_list: psIds.map(String),
      point_id_list: pointIds,
      is_get_point_dict: '1',
    });

    // Parse the response into a more usable format
    const result = {
      plants: [],
      raw: data.result_data,
    };

    if (data.result_data?.device_point_list) {
      for (const plant of data.result_data.device_point_list) {
        const plantData = {
          ps_id: plant.ps_id,
          ps_name: plant.ps_name,
          ps_key: plant.ps_key,
          uuid: plant.uuid,
          points: {},
        };

        // Extract point values (they come as p83022, p83024, etc.)
        for (const [pointId, meta] of Object.entries(MEASURING_POINTS)) {
          const key = `p${pointId}`;
          if (plant[key] !== undefined) {
            const rawValue = parseFloat(plant[key]);
            plantData.points[pointId] = {
              ...meta,
              value: rawValue,
              displayValue: this.formatValue(rawValue, meta.unit),
            };
          }
        }

        result.plants.push(plantData);
      }
    }

    return result;
  }

  formatValue(value, unit) {
    if (value === null || value === undefined || isNaN(value)) {
      return '--';
    }

    // Convert Wh to kWh/MWh for display
    if (unit === 'Wh') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)} MWh`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(2)} kWh`;
      }
      return `${value.toFixed(0)} Wh`;
    }

    // Convert W to kW for display
    if (unit === 'W') {
      if (Math.abs(value) >= 1000) {
        return `${(value / 1000).toFixed(2)} kW`;
      }
      return `${value.toFixed(0)} W`;
    }

    // Percentage
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }

    // Temperature
    if (unit === '°C') {
      return `${value.toFixed(1)}°C`;
    }

    // Hours
    if (unit === 'h') {
      return `${value.toFixed(1)} h`;
    }

    return `${value} ${unit}`.trim();
  }
}

module.exports = { ISolarCloudAPI, MEASURING_POINTS };
