const express = require('express');
const { ISolarCloudAPI } = require('./isolarcloud');

const app = express();
const PORT = 3000;

// Configuration from environment
const config = {
  username: process.env.SUNGROW_USERNAME,
  password: process.env.SUNGROW_PASSWORD,
  appkey: process.env.SUNGROW_APPKEY,
  secretKey: process.env.SUNGROW_SECRET_KEY,
  host: process.env.SUNGROW_HOST,
  pollInterval: parseInt(process.env.SUNGROW_POLL_INTERVAL || '300', 10),
};

// Initialize API client
const api = new ISolarCloudAPI(config);

// Cache for data
let cache = {
  plants: null,
  lastUpdate: null,
  error: null,
};

app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!(config.username && config.password && config.appkey && config.secretKey),
    authenticated: api.isAuthenticated(),
    host: config.host,
  });
});

// Get status
app.get('/api/status', async (req, res) => {
  res.json({
    configured: !!(config.username && config.password && config.appkey && config.secretKey),
    authenticated: api.isAuthenticated(),
    lastUpdate: cache.lastUpdate,
    error: cache.error,
  });
});

// Get plants with data
app.get('/api/plants', async (req, res) => {
  try {
    const data = await api.getPlantList();
    cache.plants = data;
    cache.lastUpdate = new Date().toISOString();
    cache.error = null;
    res.json(data);
  } catch (err) {
    cache.error = err.message;
    console.error('Failed to get plants:', err);
    res.status(500).json({ error: err.message });
  }
});

// Manual login
app.post('/api/login', async (req, res) => {
  try {
    await api.login();
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  api.clearToken();
  cache = { plants: null, lastUpdate: null, error: null };
  res.json({ success: true });
});

// Format helpers
function formatPower(watts) {
  if (watts === null || watts === undefined) return '--';
  const w = parseFloat(watts);
  if (Math.abs(w) >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${w.toFixed(0)} W`;
}

function formatEnergy(wh) {
  if (wh === null || wh === undefined) return '--';
  const v = parseFloat(wh);
  if (v >= 1000000) return `${(v / 1000000).toFixed(2)} MWh`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} kWh`;
  return `${v.toFixed(0)} Wh`;
}

// Main page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
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
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 24px; font-size: 1.75rem; color: #f8fafc; }

    .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: rgba(0,0,0,0.2);
      border-radius: 8px;
      margin-bottom: 24px;
      font-size: 0.875rem;
      flex-wrap: wrap;
      gap: 12px;
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
    .status-dot.loading { background: #fbbf24; }

    .error-card {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      text-align: center;
    }
    .error-card h2 { color: #f87171; margin-bottom: 12px; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
    }
    .card h3 {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card .value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
    }
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
      padding: 20px;
      margin-bottom: 20px;
    }
    .plant-header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .plant-name { font-size: 1.125rem; font-weight: 600; }
    .plant-meta { color: #64748b; font-size: 0.75rem; margin-top: 4px; }

    .loading { text-align: center; padding: 60px; color: #64748b; }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-danger { background: #ef4444; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sungrow Solar</h1>

    <div class="status-bar">
      <div>
        <span class="status-dot loading" id="statusDot"></span>
        <span id="statusText">Connecting...</span>
      </div>
      <div>
        Last updated: <span id="lastUpdate">--</span>
      </div>
    </div>

    <div id="content">
      <div class="loading">Loading...</div>
    </div>
  </div>

  <script>
    const pollInterval = ${config.pollInterval} * 1000;

    function formatPower(w) {
      if (!w && w !== 0) return '--';
      w = parseFloat(w);
      if (Math.abs(w) >= 1000) return (w/1000).toFixed(2) + ' kW';
      return w.toFixed(0) + ' W';
    }

    function formatEnergy(wh) {
      if (!wh && wh !== 0) return '--';
      wh = parseFloat(wh);
      if (wh >= 1000000) return (wh/1000000).toFixed(2) + ' MWh';
      if (wh >= 1000) return (wh/1000).toFixed(2) + ' kWh';
      return wh.toFixed(0) + ' Wh';
    }

    function renderPlant(plant) {
      const power = plant.curr_power?.value || 0;
      const powerUnit = plant.curr_power?.unit || 'W';
      const todayEnergy = plant.today_energy?.value || 0;
      const totalEnergy = plant.total_energy?.value || 0;
      const status = plant.ps_status === 1 ? 'Online' : 'Offline';

      return \`
        <div class="plant-section">
          <div class="plant-header">
            <div class="plant-name">\${plant.ps_name || 'Plant'}</div>
            <div class="plant-meta">ID: \${plant.ps_id} | \${status} | \${plant.ps_type_name || ''}</div>
          </div>
          <div class="grid">
            <div class="card solar">
              <h3>Current Power</h3>
              <div class="value">\${power} \${powerUnit}</div>
            </div>
            <div class="card">
              <h3>Today's Yield</h3>
              <div class="value">\${todayEnergy} \${plant.today_energy?.unit || 'kWh'}</div>
            </div>
            <div class="card">
              <h3>Total Yield</h3>
              <div class="value">\${totalEnergy} \${plant.total_energy?.unit || 'kWh'}</div>
            </div>
            <div class="card">
              <h3>Capacity</h3>
              <div class="value">\${plant.total_capcity?.value || '--'} \${plant.total_capcity?.unit || ''}</div>
            </div>
          </div>
        </div>
      \`;
    }

    async function loadData() {
      try {
        document.getElementById('statusDot').className = 'status-dot loading';
        document.getElementById('statusText').textContent = 'Updating...';

        const res = await fetch('api/plants');
        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        document.getElementById('statusDot').className = 'status-dot ok';
        document.getElementById('statusText').textContent = 'Connected';
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();

        const content = document.getElementById('content');
        if (data.pageList && data.pageList.length > 0) {
          content.innerHTML = data.pageList.map(renderPlant).join('');
        } else {
          content.innerHTML = '<div class="loading">No plants found</div>';
        }
      } catch (err) {
        console.error('Error:', err);
        document.getElementById('statusDot').className = 'status-dot error';
        document.getElementById('statusText').textContent = 'Error: ' + err.message;
        document.getElementById('content').innerHTML = \`
          <div class="error-card">
            <h2>Connection Error</h2>
            <p>\${err.message}</p>
            <p style="margin-top: 12px; color: #94a3b8; font-size: 0.875rem;">
              Check your username/password in the addon configuration.
            </p>
          </div>
        \`;
      }
    }

    // Initial load
    loadData();

    // Poll for updates
    setInterval(loadData, pollInterval);
  </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Sungrow Solar addon running on port ${PORT}`);
  console.log(`Host: ${config.host}`);
  console.log(`Username: ${config.username}`);
  console.log(`App Key: ${config.appkey ? 'configured' : 'NOT SET'}`);
  console.log(`Secret Key: ${config.secretKey ? 'configured' : 'NOT SET'}`);
  console.log(`Poll interval: ${config.pollInterval}s`);
});
