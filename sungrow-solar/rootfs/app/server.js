const express = require('express');
const path = require('path');
const { ISolarCloudAPI } = require('./isolarcloud');

const app = express();
const PORT = 3000;

// Configuration from environment (set by run.sh from HA options)
const config = {
  appkey: process.env.SUNGROW_APPKEY,
  secretKey: process.env.SUNGROW_SECRET_KEY,
  externalUrl: (process.env.SUNGROW_EXTERNAL_URL || '').replace(/\/$/, ''), // Remove trailing slash
  host: process.env.SUNGROW_HOST,
  pollInterval: parseInt(process.env.SUNGROW_POLL_INTERVAL || '300', 10),
  ingressEntry: process.env.INGRESS_ENTRY || ''
};

// Initialize API client
const api = new ISolarCloudAPI(config);

// Cache for solar data
let dataCache = {
  plants: null,
  realTimeData: null,
  lastUpdate: null,
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!(config.appkey && config.secretKey),
    authenticated: api.isAuthenticated(),
    host: config.host,
  });
});

// Get authentication status and URL
app.get('/api/auth/status', (req, res) => {
  const callbackUrl = `${config.externalUrl}/api/auth/callback`;

  res.json({
    authenticated: api.isAuthenticated(),
    authorizedPlants: api.getAuthorizedPlants(),
    callbackUrl: callbackUrl,
    configured: !!(config.externalUrl && config.appkey && config.secretKey),
  });
});

// OAuth callback
app.get('/api/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  const callbackUrl = `${config.externalUrl}/api/auth/callback`;

  console.log('OAuth callback received:', { code: code ? 'present' : 'missing', error });

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    await api.exchangeCodeForToken(code, callbackUrl);
    res.redirect('/?auth=success');
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// Logout / clear tokens
app.post('/api/auth/logout', (req, res) => {
  api.clearTokens();
  dataCache = { plants: null, realTimeData: null, lastUpdate: null };
  res.json({ success: true });
});

// Get plant list
app.get('/api/plants', async (req, res) => {
  if (!api.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = await api.getPlantList();
    dataCache.plants = data;
    res.json(data);
  } catch (err) {
    console.error('Failed to get plants:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get real-time data
app.get('/api/realtime', async (req, res) => {
  if (!api.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Get plant IDs from authorized list or from cached plant list
    let psIds = api.getAuthorizedPlants();

    if (psIds.length === 0 && dataCache.plants?.pageList) {
      psIds = dataCache.plants.pageList.map(p => p.ps_id);
    }

    if (psIds.length === 0) {
      // Fetch plant list first
      const plants = await api.getPlantList();
      dataCache.plants = plants;
      psIds = plants.pageList?.map(p => p.ps_id) || [];
    }

    if (psIds.length === 0) {
      return res.json({ plants: [], message: 'No plants found' });
    }

    const data = await api.getRealTimeData(psIds);
    dataCache.realTimeData = data;
    dataCache.lastUpdate = new Date().toISOString();

    res.json({
      ...data,
      lastUpdate: dataCache.lastUpdate,
    });
  } catch (err) {
    console.error('Failed to get realtime data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve main page
app.get('/', (req, res) => {
  const basePath = config.ingressEntry;
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sungrow Solar</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 24px; font-size: 1.75rem; color: #f8fafc; }

    .auth-card {
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }
    .auth-card h2 { color: #fbbf24; margin-bottom: 12px; }
    .auth-card p { margin-bottom: 16px; color: #94a3b8; }
    .callback-url {
      background: rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 12px;
      margin: 16px 0;
      font-family: monospace;
      font-size: 0.85rem;
      word-break: break-all;
      text-align: left;
      color: #94a3b8;
    }
    .callback-url strong { color: #f8fafc; display: block; margin-bottom: 8px; font-family: sans-serif; }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      border: none;
      font-size: 1rem;
    }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:hover { background: #2563eb; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
    }
    .card h3 {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card .value {
      font-size: 2rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .card .unit { font-size: 1rem; color: #64748b; }
    .card.solar { border-color: rgba(250, 204, 21, 0.3); }
    .card.solar .value { color: #facc15; }
    .card.battery { border-color: rgba(34, 197, 94, 0.3); }
    .card.battery .value { color: #22c55e; }
    .card.grid-power { border-color: rgba(59, 130, 246, 0.3); }
    .card.grid-power .value { color: #3b82f6; }
    .card.load { border-color: rgba(168, 85, 247, 0.3); }
    .card.load .value { color: #a855f7; }

    .plant-section {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .plant-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .plant-name { font-size: 1.25rem; font-weight: 600; }
    .plant-id { color: #64748b; font-size: 0.875rem; }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 0.875rem;
    }
    .status-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-dot.ok { background: #22c55e; }
    .status-dot.error { background: #ef4444; }
    .status-dot.pending { background: #fbbf24; }

    .error-msg {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .success-msg {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: #86efac;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .loading { text-align: center; padding: 40px; color: #64748b; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sungrow Solar</h1>

    <div id="messages"></div>

    <div id="authSection" class="auth-card hidden">
      <h2>Authentication Required</h2>
      <p>Connect your iSolarCloud account to view your solar system data.</p>
      <div class="callback-url">
        <strong>Callback URL (register this in iSolarCloud developer portal):</strong>
        <span id="callbackUrl">Loading...</span>
      </div>
      <p style="font-size: 0.875rem; margin-bottom: 16px;">After registering the callback URL above, use the authorize URL from the portal to connect.</p>
      <a id="authLink" href="#" class="btn btn-primary" target="_blank">Open iSolarCloud Authorization</a>
    </div>

    <div id="loadingSection" class="loading">
      Loading...
    </div>

    <div id="dataSection" class="hidden">
      <div class="status-bar">
        <div>
          <span class="status-dot ok" id="statusDot"></span>
          <span id="statusText">Connected</span>
        </div>
        <div>
          Last updated: <span id="lastUpdate">--</span>
          <button onclick="logout()" class="btn btn-danger" style="margin-left: 16px; padding: 6px 12px; font-size: 0.875rem;">Disconnect</button>
        </div>
      </div>

      <div id="plantsContainer"></div>
    </div>
  </div>

  <script>
    const basePath = '${basePath}';
    const pollInterval = ${config.pollInterval} * 1000;

    function api(endpoint) {
      return fetch(endpoint).then(r => r.json());
    }

    function showMessage(type, text) {
      const el = document.getElementById('messages');
      el.innerHTML = '<div class="' + type + '-msg">' + text + '</div>';
      setTimeout(() => el.innerHTML = '', 5000);
    }

    function formatValue(value, unit) {
      if (value === null || value === undefined) return '--';
      if (unit === 'Wh') {
        if (value >= 1000000) return (value / 1000000).toFixed(2) + ' MWh';
        if (value >= 1000) return (value / 1000).toFixed(2) + ' kWh';
        return value.toFixed(0) + ' Wh';
      }
      if (unit === 'W') {
        if (Math.abs(value) >= 1000) return (value / 1000).toFixed(2) + ' kW';
        return value.toFixed(0) + ' W';
      }
      if (unit === '%') return value.toFixed(1) + '%';
      return value + ' ' + (unit || '');
    }

    function renderPlant(plant) {
      const p = plant.points;

      // Get key values with fallbacks
      const solarPower = p['83067']?.value ?? p['83033']?.value ?? p['83002']?.value ?? 0;
      const loadPower = p['83106']?.value ?? p['83052']?.value ?? 0;
      const gridPower = p['83549']?.value ?? 0;
      const batterySOC = p['83129']?.value ?? p['83252']?.value ?? p['83232']?.value;
      const batteryPower = p['83326']?.value ?? 0;
      const dailyYield = p['83022']?.value ?? p['83009']?.value ?? 0;
      const totalYield = p['83024']?.value ?? p['83004']?.value ?? 0;
      const dailyExport = p['83072']?.value ?? p['83119']?.value ?? 0;
      const dailyImport = p['83102']?.value ?? 0;

      return \`
        <div class="plant-section">
          <div class="plant-header">
            <div>
              <div class="plant-name">\${plant.ps_name || 'Plant'}</div>
              <div class="plant-id">ID: \${plant.ps_id}</div>
            </div>
          </div>

          <div class="grid">
            <div class="card solar">
              <h3>Solar Power</h3>
              <div class="value">\${formatValue(solarPower, 'W')}</div>
            </div>
            <div class="card load">
              <h3>Load Power</h3>
              <div class="value">\${formatValue(loadPower, 'W')}</div>
            </div>
            <div class="card grid-power">
              <h3>Grid Power</h3>
              <div class="value">\${formatValue(gridPower, 'W')}</div>
            </div>
            \${batterySOC !== undefined ? \`
            <div class="card battery">
              <h3>Battery</h3>
              <div class="value">\${formatValue(batterySOC, '%')}</div>
              <div style="color: #64748b; font-size: 0.875rem; margin-top: 4px;">\${formatValue(batteryPower, 'W')}</div>
            </div>
            \` : ''}
          </div>

          <div class="grid">
            <div class="card">
              <h3>Today's Yield</h3>
              <div class="value">\${formatValue(dailyYield, 'Wh')}</div>
            </div>
            <div class="card">
              <h3>Total Yield</h3>
              <div class="value">\${formatValue(totalYield, 'Wh')}</div>
            </div>
            <div class="card">
              <h3>Exported Today</h3>
              <div class="value">\${formatValue(dailyExport, 'Wh')}</div>
            </div>
            <div class="card">
              <h3>Imported Today</h3>
              <div class="value">\${formatValue(dailyImport, 'Wh')}</div>
            </div>
          </div>
        </div>
      \`;
    }

    async function loadData() {
      try {
        const data = await api('api/realtime');

        if (data.error) {
          document.getElementById('statusDot').className = 'status-dot error';
          document.getElementById('statusText').textContent = data.error;
          return;
        }

        document.getElementById('statusDot').className = 'status-dot ok';
        document.getElementById('statusText').textContent = 'Connected';
        document.getElementById('lastUpdate').textContent =
          data.lastUpdate ? new Date(data.lastUpdate).toLocaleTimeString() : '--';

        const container = document.getElementById('plantsContainer');
        if (data.plants && data.plants.length > 0) {
          container.innerHTML = data.plants.map(renderPlant).join('');
        } else {
          container.innerHTML = '<div class="loading">No plant data available</div>';
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        document.getElementById('statusDot').className = 'status-dot error';
        document.getElementById('statusText').textContent = 'Error loading data';
      }
    }

    async function logout() {
      await fetch('api/auth/logout', { method: 'POST' });
      location.reload();
    }

    async function init() {
      // Check URL params for messages
      const params = new URLSearchParams(location.search);
      if (params.get('auth') === 'success') {
        showMessage('success', 'Successfully connected to iSolarCloud!');
        history.replaceState({}, '', location.pathname);
      }
      if (params.get('error')) {
        showMessage('error', 'Error: ' + params.get('error'));
        history.replaceState({}, '', location.pathname);
      }

      // Check auth status
      const status = await api('api/auth/status');

      document.getElementById('loadingSection').classList.add('hidden');

      if (!status.authenticated) {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('callbackUrl').textContent = status.callbackUrl || 'Configure external_url in addon settings';
        // Remove the auth link href - user needs to use the authorize URL from the Sungrow portal
        document.getElementById('authLink').href = 'https://developer-api.isolarcloud.com';
        return;
      }

      document.getElementById('dataSection').classList.remove('hidden');

      // Load initial data
      await loadData();

      // Poll for updates
      setInterval(loadData, pollInterval);
    }

    init();
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`Sungrow Solar addon running on port ${PORT}`);
  console.log(`Ingress entry: ${config.ingressEntry}`);
  console.log(`Configured: ${!!(config.appkey && config.secretKey)}`);
  console.log(`Authenticated: ${api.isAuthenticated()}`);
});
