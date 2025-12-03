const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuration from environment (set by run.sh from HA options)
const config = {
  username: process.env.SUNGROW_USERNAME,
  password: process.env.SUNGROW_PASSWORD,
  appkey: process.env.SUNGROW_APPKEY,
  host: process.env.SUNGROW_HOST,
  pollInterval: parseInt(process.env.SUNGROW_POLL_INTERVAL || '60', 10),
  ingressEntry: process.env.INGRESS_ENTRY || ''
};

// Middleware to handle HA ingress base path
app.use((req, res, next) => {
  res.locals.basePath = config.ingressEntry;
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    configured: !!(config.username && config.appkey)
  });
});

// Placeholder for solar data endpoint
app.get('/api/solar', (req, res) => {
  // TODO: Implement iSolarCloud API integration
  res.json({
    message: 'iSolarCloud integration not yet implemented',
    config: {
      host: config.host,
      pollInterval: config.pollInterval,
      hasCredentials: !!(config.username && config.password && config.appkey)
    }
  });
});

// Serve main page
app.get('/', (req, res) => {
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      font-size: 2rem;
    }
    .status-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }
    .status-card h2 { margin-bottom: 12px; font-size: 1.2rem; }
    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .status-ok { background: #4ade80; }
    .status-error { background: #f87171; }
    .status-pending { background: #fbbf24; }
    pre {
      background: rgba(0,0,0,0.3);
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sungrow Solar</h1>

    <div class="status-card">
      <h2>
        <span class="status-indicator status-pending" id="statusDot"></span>
        Connection Status
      </h2>
      <p id="statusText">Checking configuration...</p>
    </div>

    <div class="status-card">
      <h2>API Response</h2>
      <pre id="apiData">Loading...</pre>
    </div>
  </div>

  <script>
    async function checkStatus() {
      try {
        const healthRes = await fetch('api/health');
        const health = await healthRes.json();

        const solarRes = await fetch('api/solar');
        const solar = await solarRes.json();

        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');

        if (health.configured) {
          dot.className = 'status-indicator status-ok';
          text.textContent = 'Configured and ready';
        } else {
          dot.className = 'status-indicator status-error';
          text.textContent = 'Missing configuration - check addon settings';
        }

        document.getElementById('apiData').textContent = JSON.stringify(solar, null, 2);
      } catch (err) {
        document.getElementById('statusText').textContent = 'Error: ' + err.message;
        document.getElementById('statusDot').className = 'status-indicator status-error';
      }
    }

    checkStatus();
  </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`Sungrow Solar addon running on port ${PORT}`);
  console.log(`Ingress entry: ${config.ingressEntry}`);
  console.log(`Configured: ${!!(config.username && config.appkey)}`);
});
