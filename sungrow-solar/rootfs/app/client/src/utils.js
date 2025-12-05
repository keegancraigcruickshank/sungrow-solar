export function formatPower(w) {
  if (w === null || w === undefined || w === '') return '--';
  w = parseFloat(w);
  if (Math.abs(w) >= 1000) return (w / 1000).toFixed(2);
  return w.toFixed(0);
}

export function powerUnit(w) {
  if (w === null || w === undefined || w === '') return '';
  return Math.abs(parseFloat(w)) >= 1000 ? 'kW' : 'W';
}

export function formatEnergy(wh) {
  if (wh === null || wh === undefined || wh === '') return '--';
  wh = parseFloat(wh);
  if (wh >= 1000000) return (wh / 1000000).toFixed(2);
  if (wh >= 1000) return (wh / 1000).toFixed(2);
  return wh.toFixed(0);
}

export function energyUnit(wh) {
  if (wh === null || wh === undefined || wh === '') return '';
  wh = parseFloat(wh);
  if (wh >= 1000000) return 'MWh';
  if (wh >= 1000) return 'kWh';
  return 'Wh';
}

export function formatDeviceTime(deviceTime) {
  if (!deviceTime || deviceTime.length !== 14) return '--';
  return `${deviceTime.slice(8, 10)}:${deviceTime.slice(10, 12)}:${deviceTime.slice(12, 14)}`;
}
