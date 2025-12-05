// Load .env file for local development
require('dotenv').config();

const express = require('express');
const path = require('path');
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

// Serve static files from public directory (React build output)
app.use(express.static(path.join(__dirname, 'public')));

// Serve React app for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sungrow Solar addon running on port ${PORT}`);
  console.log(`Host: ${config.host}`);
  console.log(`Username: ${config.username}`);
  console.log(`App Key: ${config.appkey ? 'configured' : 'NOT SET'}`);
  console.log(`Secret Key: ${config.secretKey ? 'configured' : 'NOT SET'}`);
  console.log(`Poll interval: ${config.pollInterval}s`);
});
