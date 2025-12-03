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

// Get devices for a plant
app.get('/api/devices/:psId', async (req, res) => {
  try {
    const data = await api.getDeviceList(req.params.psId);
    res.json(data);
  } catch (err) {
    console.error('Failed to get devices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get real-time device data
app.get('/api/realtime/:psKey', async (req, res) => {
  try {
    const deviceType = parseInt(req.query.type || '14', 10);
    const data = await api.getDeviceRealTimeData([req.params.psKey], deviceType);
    res.json(data);
  } catch (err) {
    console.error('Failed to get realtime data:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get real-time data for multiple devices
app.post('/api/realtime', async (req, res) => {
  try {
    const { ps_key_list, device_type = 14 } = req.body;
    const data = await api.getDeviceRealTimeData(ps_key_list, device_type);
    res.json(data);
  } catch (err) {
    console.error('Failed to get realtime data:', err);
    res.status(500).json({ error: err.message });
  }
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
    :root{--bg-primary:#0f172a;--bg-secondary:#1e293b;--bg-card:rgba(255,255,255,0.05);--bg-card-hover:rgba(255,255,255,0.08);--border-color:rgba(255,255,255,0.1);--text-primary:#f8fafc;--text-secondary:#e2e8f0;--text-muted:#94a3b8;--text-dim:#64748b}
    @media(prefers-color-scheme:light){:root{--bg-primary:#f8fafc;--bg-secondary:#f1f5f9;--bg-card:rgba(0,0,0,0.03);--bg-card-hover:rgba(0,0,0,0.06);--border-color:rgba(0,0,0,0.1);--text-primary:#0f172a;--text-secondary:#1e293b;--text-muted:#64748b;--text-dim:#94a3b8}}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--ha-card-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif);background:var(--ha-card-background,var(--bg-primary));color:var(--primary-text-color,var(--text-secondary));min-height:100vh;padding:20px}
    .container{max-width:1400px;margin:0 auto}
    h1{text-align:center;margin-bottom:24px;font-size:1.75rem;color:var(--primary-text-color,var(--text-primary))}
    h2{font-size:1rem;color:var(--secondary-text-color,var(--text-muted));margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em}
    .status-bar{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--ha-card-background,var(--bg-card));border:1px solid var(--divider-color,var(--border-color));border-radius:8px;margin-bottom:24px;font-size:0.875rem;flex-wrap:wrap;gap:12px}
    .status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}
    .status-dot.ok{background:#22c55e}
    .status-dot.error{background:#ef4444}
    .status-dot.loading{background:#fbbf24;animation:pulse 1s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
    .error-card{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:24px;margin-bottom:24px;text-align:center}
    .error-card h2{color:#f87171;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}
    .card{background:var(--ha-card-background,var(--bg-card));border:1px solid var(--divider-color,var(--border-color));border-radius:12px;padding:16px}
    .card h3{font-size:0.7rem;color:var(--secondary-text-color,var(--text-muted));margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em}
    .card .value{font-size:1.4rem;font-weight:700;color:var(--primary-text-color,var(--text-primary))}
    .card .unit{font-size:0.8rem;color:var(--secondary-text-color,var(--text-dim));margin-left:4px}
    .card.solar{border-color:rgba(250,204,21,0.4);background:rgba(250,204,21,0.1)}
    .card.solar .value{color:#ca8a04}
    .card.battery{border-color:rgba(34,197,94,0.4);background:rgba(34,197,94,0.1)}
    .card.battery .value{color:#16a34a}
    .card.grid-import{border-color:rgba(239,68,68,0.4);background:rgba(239,68,68,0.1)}
    .card.grid-import .value{color:#dc2626}
    .card.grid-export{border-color:rgba(59,130,246,0.4);background:rgba(59,130,246,0.1)}
    .card.grid-export .value{color:#2563eb}
    .card.load{border-color:rgba(168,85,247,0.4);background:rgba(168,85,247,0.1)}
    .card.load .value{color:#9333ea}
    .section{background:var(--ha-card-background,var(--bg-card));border:1px solid var(--divider-color,var(--border-color));border-radius:16px;padding:20px;margin-bottom:20px}
    .section-header{margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--divider-color,var(--border-color));display:flex;justify-content:space-between;align-items:center}
    .section-title{font-size:1.125rem;font-weight:600;color:var(--primary-text-color,var(--text-primary))}
    .section-meta{color:var(--secondary-text-color,var(--text-dim));font-size:0.75rem}
    .loading{text-align:center;padding:60px;color:var(--secondary-text-color,var(--text-dim))}
    .tabs{display:flex;gap:8px;margin-bottom:20px}
    .tab{padding:8px 16px;border-radius:8px;border:1px solid var(--divider-color,var(--border-color));background:transparent;color:var(--secondary-text-color,var(--text-muted));cursor:pointer;font-size:0.875rem}
    .tab:hover{background:var(--bg-card-hover)}
    .tab.active{background:var(--primary-color,rgba(59,130,246,0.2));border-color:var(--primary-color,rgba(59,130,246,0.5));color:var(--primary-color,#3b82f6)}
    .battery-bar{height:24px;background:var(--divider-color,rgba(0,0,0,0.2));border-radius:12px;overflow:hidden;margin-top:8px}
    .battery-fill{height:100%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:12px;transition:width 0.5s}
  </style>
</head>
<body>
  <div class="container">
    <h1>Sungrow Solar</h1>
    <div class="status-bar">
      <div><span class="status-dot loading" id="statusDot"></span><span id="statusText">Connecting...</span></div>
      <div>Last updated: <span id="lastUpdate">--</span></div>
    </div>
    <div class="tabs">
      <button class="tab active" onclick="showTab('overview')">Overview</button>
      <button class="tab" onclick="showTab('live')">Live Stats</button>
    </div>
    <div id="overview" class="tab-content"></div>
    <div id="live" class="tab-content" style="display:none"></div>
  </div>
  <script>
    const pollInterval = ${config.pollInterval} * 1000;
    let currentPlant = null;
    let currentPsKey = null;

    function showTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      document.querySelector('.tab[onclick*="'+name+'"]').classList.add('active');
      document.getElementById(name).style.display = 'block';
      if (name === 'live' && currentPsKey) loadLiveData();
    }

    function formatPower(w) {
      if (w === null || w === undefined || w === '') return '--';
      w = parseFloat(w);
      if (Math.abs(w) >= 1000) return (w/1000).toFixed(2);
      return w.toFixed(0);
    }
    function powerUnit(w) {
      if (w === null || w === undefined || w === '') return '';
      return Math.abs(parseFloat(w)) >= 1000 ? 'kW' : 'W';
    }
    function formatEnergy(wh) {
      if (wh === null || wh === undefined || wh === '') return '--';
      wh = parseFloat(wh);
      if (wh >= 1000000) return (wh/1000000).toFixed(2);
      if (wh >= 1000) return (wh/1000).toFixed(2);
      return wh.toFixed(0);
    }
    function energyUnit(wh) {
      if (wh === null || wh === undefined || wh === '') return '';
      wh = parseFloat(wh);
      if (wh >= 1000000) return 'MWh';
      if (wh >= 1000) return 'kWh';
      return 'Wh';
    }

    async function loadData() {
      try {
        document.getElementById('statusDot').className = 'status-dot loading';
        document.getElementById('statusText').textContent = 'Updating...';
        const res = await fetch('api/plants');
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        document.getElementById('statusDot').className = 'status-dot ok';
        document.getElementById('statusText').textContent = 'Connected';
        document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString();
        const content = document.getElementById('overview');
        if (data.pageList && data.pageList.length > 0) {
          currentPlant = data.pageList[0];
          currentPsKey = currentPlant.ps_id + '_14_0_0';
          content.innerHTML = data.pageList.map(renderPlant).join('');
        } else {
          content.innerHTML = '<div class="loading">No plants found</div>';
        }
      } catch (err) {
        document.getElementById('statusDot').className = 'status-dot error';
        document.getElementById('statusText').textContent = 'Error';
        document.getElementById('overview').innerHTML = '<div class="error-card"><h2>Connection Error</h2><p>'+err.message+'</p></div>';
      }
    }

    function renderPlant(plant) {
      const p = plant.curr_power?.value || 0;
      const pu = plant.curr_power?.unit || 'kW';
      const te = plant.today_energy?.value || 0;
      const teu = plant.today_energy?.unit || 'kWh';
      return '<div class="section"><div class="section-header"><div class="section-title">'+plant.ps_name+'</div><div class="section-meta">'+(plant.ps_status===1?'Online':'Offline')+'</div></div><div class="grid"><div class="card solar"><h3>Solar Power</h3><div class="value">'+p+'<span class="unit">'+pu+'</span></div></div><div class="card"><h3>Today</h3><div class="value">'+te+'<span class="unit">'+teu+'</span></div></div><div class="card"><h3>Total</h3><div class="value">'+(plant.total_energy?.value||0)+'<span class="unit">'+(plant.total_energy?.unit||'kWh')+'</span></div></div><div class="card"><h3>Capacity</h3><div class="value">'+(plant.total_capcity?.value||'--')+'<span class="unit">'+(plant.total_capcity?.unit||'')+'</span></div></div></div></div>';
    }

    async function loadLiveData() {
      if (!currentPlant) return;
      const live = document.getElementById('live');
      live.innerHTML = '<div class="loading">Loading devices...</div>';
      try {
        // First get device list for this plant
        const devRes = await fetch('api/devices/'+currentPlant.ps_id);
        const devData = await devRes.json();
        console.log('Devices:', devData);

        if (devData.error) throw new Error(devData.error);

        // Find energy storage device (type 14) or inverter (type 11)
        let device = null;
        if (devData.pageList) {
          device = devData.pageList.find(d => d.device_type === 14) || devData.pageList.find(d => d.device_type === 11) || devData.pageList[0];
        }

        if (!device) {
          live.innerHTML = '<div class="loading">No devices found. Raw: '+JSON.stringify(devData).substring(0,200)+'</div>';
          return;
        }

        const psKey = device.ps_key || (currentPlant.ps_id + '_' + device.device_type + '_0_0');
        const deviceType = device.device_type || 14;
        console.log('Using device:', device, 'ps_key:', psKey);

        live.innerHTML = '<div class="loading">Loading real-time data for '+device.device_name+'...</div>';

        const res = await fetch('api/realtime/'+encodeURIComponent(psKey)+'?type='+deviceType);
        const data = await res.json();
        console.log('Realtime data:', data);

        if (data.error) throw new Error(data.error);
        if (data.device_point_list && data.device_point_list.length > 0) {
          const dp = data.device_point_list[0].device_point;
          live.innerHTML = renderLiveStats(dp, deviceType);
        } else {
          live.innerHTML = '<div class="loading">No real-time data. Response: '+JSON.stringify(data).substring(0,300)+'</div>';
        }
      } catch (err) {
        console.error('Live data error:', err);
        live.innerHTML = '<div class="error-card"><h2>Error</h2><p>'+err.message+'</p></div>';
      }
    }

    function renderLiveStats(dp, deviceType) {
      // Format device time (comes as YYYYMMDDHHmmss)
      let timeStr = '--';
      if (dp.device_time && dp.device_time.length === 14) {
        const t = dp.device_time;
        timeStr = t.slice(8,10)+':'+t.slice(10,12)+':'+t.slice(12,14);
      }
      let html = '<div class="section"><div class="section-header"><div class="section-title">Power Flow</div><div class="section-meta">'+dp.device_name+' | '+timeStr+'</div></div>';

      if (deviceType === 14) {
        // Energy Storage System
        const socRaw = parseFloat(dp.p13141) || 0;
        const soc = socRaw < 1 ? (socRaw * 100).toFixed(1) : socRaw.toFixed(1);
        const socPercent = socRaw < 1 ? socRaw * 100 : socRaw;
        const sohRaw = parseFloat(dp.p13142) || 0;
        const soh = sohRaw < 1 ? (sohRaw * 100).toFixed(1) : sohRaw.toFixed(1);
        const battCharge = parseFloat(dp.p13126) || 0;
        const battDischarge = parseFloat(dp.p13150) || 0;
        const battPower = battCharge > 0 ? battCharge : battDischarge;
        const battStatus = battCharge > 0 ? 'Charging' : (battDischarge > 0 ? 'Discharging' : 'Idle');

        // Power Flow section
        html += '<div class="grid">';
        html += '<div class="card solar"><h3>Solar Power</h3><div class="value">'+formatPower(dp.p13003)+'<span class="unit">'+powerUnit(dp.p13003)+'</span></div></div>';
        html += '<div class="card load"><h3>Load Power</h3><div class="value">'+formatPower(dp.p13119)+'<span class="unit">'+powerUnit(dp.p13119)+'</span></div></div>';
        html += '<div class="card grid-export"><h3>Feed-in</h3><div class="value">'+formatPower(dp.p13121)+'<span class="unit">'+powerUnit(dp.p13121)+'</span></div></div>';
        html += '<div class="card grid-import"><h3>Grid Import</h3><div class="value">'+formatPower(dp.p13149)+'<span class="unit">'+powerUnit(dp.p13149)+'</span></div></div>';
        html += '</div></div>';

        // Battery section
        html += '<div class="section"><div class="section-header"><div class="section-title">Battery</div><div class="section-meta">'+battStatus+' | Health: '+soh+'%</div></div>';
        html += '<div class="grid">';
        html += '<div class="card battery"><h3>State of Charge</h3><div class="value">'+soc+'<span class="unit">%</span></div><div class="battery-bar"><div class="battery-fill" style="width:'+socPercent+'%"></div></div></div>';
        html += '<div class="card battery"><h3>Power</h3><div class="value">'+formatPower(battPower)+'<span class="unit">'+powerUnit(battPower)+'</span></div></div>';
        html += '<div class="card"><h3>Voltage</h3><div class="value">'+(parseFloat(dp.p13138)||'--')+'<span class="unit">V</span></div></div>';
        html += '<div class="card"><h3>Temperature</h3><div class="value">'+(parseFloat(dp.p13143)||'--')+'<span class="unit">°C</span></div></div>';
        html += '</div></div>';

        // Energy Today section
        html += '<div class="section"><div class="section-header"><div class="section-title">Energy Today</div></div>';
        html += '<div class="grid">';
        html += '<div class="card solar"><h3>PV Yield</h3><div class="value">'+formatEnergy(dp.p13112)+'<span class="unit">'+energyUnit(dp.p13112)+'</span></div></div>';
        html += '<div class="card load"><h3>Consumption</h3><div class="value">'+formatEnergy(dp.p13199)+'<span class="unit">'+energyUnit(dp.p13199)+'</span></div></div>';
        html += '<div class="card grid-export"><h3>Exported</h3><div class="value">'+formatEnergy(dp.p13122)+'<span class="unit">'+energyUnit(dp.p13122)+'</span></div></div>';
        html += '<div class="card grid-import"><h3>Imported</h3><div class="value">'+formatEnergy(dp.p13147)+'<span class="unit">'+energyUnit(dp.p13147)+'</span></div></div>';
        html += '<div class="card battery"><h3>Batt Charged</h3><div class="value">'+formatEnergy(dp.p13028)+'<span class="unit">'+energyUnit(dp.p13028)+'</span></div></div>';
        html += '<div class="card battery"><h3>Batt Discharged</h3><div class="value">'+formatEnergy(dp.p13029)+'<span class="unit">'+energyUnit(dp.p13029)+'</span></div></div>';
        html += '</div></div>';
      } else if (deviceType === 11) {
        // Inverter
        html += '<div class="grid"><div class="card solar"><h3>Active Power</h3><div class="value">'+formatPower(dp.p24)+'<span class="unit">'+powerUnit(dp.p24)+'</span></div></div><div class="card"><h3>Yield Today</h3><div class="value">'+formatEnergy(dp.p1)+'<span class="unit">'+energyUnit(dp.p1)+'</span></div></div><div class="card"><h3>Total Yield</h3><div class="value">'+formatEnergy(dp.p2)+'<span class="unit">'+energyUnit(dp.p2)+'</span></div></div><div class="card"><h3>DC Power</h3><div class="value">'+formatPower(dp.p14)+'<span class="unit">'+powerUnit(dp.p14)+'</span></div></div></div>';
      } else {
        // Unknown type - show raw data
        html += '<div class="grid">';
        keys.slice(0,12).forEach(k => {
          html += '<div class="card"><h3>'+k+'</h3><div class="value">'+dp[k]+'</div></div>';
        });
        html += '</div></div>';
      }
      return html;
    }

    loadData();
    // Poll every 60 seconds for live data
    setInterval(() => { loadData(); if(document.getElementById('live').style.display!=='none') loadLiveData(); }, 60000);
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
