import React, { useEffect, useState } from 'react';
import { fetchDevices, fetchRealtimeData } from '../api';
import { formatPower, powerUnit, formatEnergy, energyUnit, formatDeviceTime } from '../utils';
import Section from './Section';
import Card from './Card';
import BatteryCard from './BatteryCard';

export default function LiveStats({ plant }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deviceData, setDeviceData] = useState(null);
  const [deviceType, setDeviceType] = useState(14);

  useEffect(() => {
    if (!plant) return;
    loadLiveData();
  }, [plant]);

  async function loadLiveData() {
    setLoading(true);
    setError(null);
    try {
      const devData = await fetchDevices(plant.ps_id);

      let device = null;
      if (devData.pageList) {
        device = devData.pageList.find(d => d.device_type === 14)
          || devData.pageList.find(d => d.device_type === 11)
          || devData.pageList[0];
      }

      if (!device) {
        setError('No devices found');
        setLoading(false);
        return;
      }

      const psKey = device.ps_key || `${plant.ps_id}_${device.device_type}_0_0`;
      const type = device.device_type || 14;
      setDeviceType(type);

      const data = await fetchRealtimeData(psKey, type);

      if (data.device_point_list && data.device_point_list.length > 0) {
        setDeviceData(data.device_point_list[0].device_point);
      } else {
        setError('No real-time data available');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!plant) {
    return <div className="loading">Select a plant to view live stats</div>;
  }

  if (loading) {
    return <div className="loading">Loading live data...</div>;
  }

  if (error) {
    return (
      <div className="error-card">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!deviceData) {
    return <div className="loading">No device data</div>;
  }

  const dp = deviceData;
  const timeStr = formatDeviceTime(dp.device_time);

  if (deviceType === 14) {
    return <ESSStats dp={dp} timeStr={timeStr} />;
  } else if (deviceType === 11) {
    return <InverterStats dp={dp} timeStr={timeStr} />;
  }

  return (
    <Section title="Device Data" meta={timeStr}>
      <div className="grid">
        {Object.keys(dp).slice(0, 12).map((key) => (
          <Card key={key} title={key} value={dp[key]} />
        ))}
      </div>
    </Section>
  );
}

function ESSStats({ dp, timeStr }) {
  const socRaw = parseFloat(dp.p13141) || 0;
  const soc = socRaw < 1 ? (socRaw * 100).toFixed(1) : socRaw.toFixed(1);
  const socPercent = socRaw < 1 ? socRaw * 100 : socRaw;
  const sohRaw = parseFloat(dp.p13142) || 0;
  const soh = sohRaw < 1 ? (sohRaw * 100).toFixed(1) : sohRaw.toFixed(1);
  const battCharge = parseFloat(dp.p13126) || 0;
  const battDischarge = parseFloat(dp.p13150) || 0;
  const battPower = battCharge > 0 ? battCharge : battDischarge;
  const battStatus = battCharge > 0 ? 'Charging' : battDischarge > 0 ? 'Discharging' : 'Idle';

  return (
    <>
      <Section title="Power Flow" meta={`${dp.device_name} | ${timeStr}`}>
        <div className="grid">
          <Card title="Solar Power" value={formatPower(dp.p13003)} unit={powerUnit(dp.p13003)} variant="solar" />
          <Card title="Load Power" value={formatPower(dp.p13119)} unit={powerUnit(dp.p13119)} variant="load" />
          <Card title="Feed-in" value={formatPower(dp.p13121)} unit={powerUnit(dp.p13121)} variant="grid-export" />
          <Card title="Grid Import" value={formatPower(dp.p13149)} unit={powerUnit(dp.p13149)} variant="grid-import" />
        </div>
      </Section>

      <Section title="Battery" meta={`${battStatus} | Health: ${soh}%`}>
        <div className="grid">
          <BatteryCard title="State of Charge" value={soc} unit="%" soc={socPercent} />
          <Card title="Power" value={formatPower(battPower)} unit={powerUnit(battPower)} variant="battery" />
          <Card title="Voltage" value={parseFloat(dp.p13138) || '--'} unit="V" />
          <Card title="Temperature" value={parseFloat(dp.p13143) || '--'} unit="°C" />
        </div>
      </Section>

      <Section title="Energy Today">
        <div className="grid">
          <Card title="PV Yield" value={formatEnergy(dp.p13112)} unit={energyUnit(dp.p13112)} variant="solar" />
          <Card title="Consumption" value={formatEnergy(dp.p13199)} unit={energyUnit(dp.p13199)} variant="load" />
          <Card title="Exported" value={formatEnergy(dp.p13122)} unit={energyUnit(dp.p13122)} variant="grid-export" />
          <Card title="Imported" value={formatEnergy(dp.p13147)} unit={energyUnit(dp.p13147)} variant="grid-import" />
          <Card title="Batt Charged" value={formatEnergy(dp.p13028)} unit={energyUnit(dp.p13028)} variant="battery" />
          <Card title="Batt Discharged" value={formatEnergy(dp.p13029)} unit={energyUnit(dp.p13029)} variant="battery" />
        </div>
      </Section>
    </>
  );
}

function InverterStats({ dp, timeStr }) {
  return (
    <Section title="Inverter" meta={timeStr}>
      <div className="grid">
        <Card title="Active Power" value={formatPower(dp.p24)} unit={powerUnit(dp.p24)} variant="solar" />
        <Card title="Yield Today" value={formatEnergy(dp.p1)} unit={energyUnit(dp.p1)} />
        <Card title="Total Yield" value={formatEnergy(dp.p2)} unit={energyUnit(dp.p2)} />
        <Card title="DC Power" value={formatPower(dp.p14)} unit={powerUnit(dp.p14)} />
      </div>
    </Section>
  );
}
