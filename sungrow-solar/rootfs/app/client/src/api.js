const API_BASE = './api';

export async function fetchPlants() {
  const res = await fetch(`${API_BASE}/plants`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchDevices(psId) {
  const res = await fetch(`${API_BASE}/devices/${psId}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchRealtimeData(psKey, deviceType) {
  const res = await fetch(`${API_BASE}/realtime/${encodeURIComponent(psKey)}?type=${deviceType}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
