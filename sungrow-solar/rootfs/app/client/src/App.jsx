import React, { useEffect, useState } from 'react';
import { fetchPlants, fetchDevices } from './api';
import StatusBar from './components/StatusBar';
import Flow from './components/Flow';
import PlantSelect from './components/PlantSelect';

const REFRESH_INTERVAL = 60;

export default function App() {
  const [status, setStatus] = useState('loading');
  const [initialLoad, setInitialLoad] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [plants, setPlants] = useState([]);
  const [currentPlant, setCurrentPlant] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, REFRESH_INTERVAL * 1000);
    const tickInterval = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : REFRESH_INTERVAL));
    }, 1000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(tickInterval);
    };
  }, []);

  async function loadData() {
    setStatus('loading');
    try {
      const data = await fetchPlants();
      setStatus('ok');
      setCountdown(REFRESH_INTERVAL);
      setError(null);

      if (data.pageList && data.pageList.length > 0) {
        // Fetch devices for each plant to determine capabilities
        const plantsWithDevices = await Promise.all(
          data.pageList.map(async (plant) => {
            try {
              const devData = await fetchDevices(plant.ps_id);
              const devices = devData.pageList || [];
              return {
                ...plant,
                hasBattery: devices.some((d) => d.device_type === 14),
                hasInverter: devices.some((d) => d.device_type === 11),
                devices,
              };
            } catch {
              return { ...plant, hasBattery: false, hasInverter: true, devices: [] };
            }
          })
        );

        setPlants(plantsWithDevices);
        setCurrentPlant((prev) => {
          if (!prev) return plantsWithDevices[0];
          const stillExists = plantsWithDevices.find((p) => String(p.ps_id) === String(prev.ps_id));
          return stillExists || plantsWithDevices[0];
        });
      }
      setInitialLoad(false);
    } catch (err) {
      setStatus('error');
      setError(err.message);
      setInitialLoad(false);
    }
  }

  function handlePlantChange(psId) {
    const plant = plants.find((p) => String(p.ps_id) === String(psId));
    if (plant) setCurrentPlant(plant);
  }

  if (initialLoad) {
    return (
      <div className="loading-screen">
        <span className="spinner large"></span>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header-row">
        <PlantSelect
          plants={plants}
          currentPlant={currentPlant}
          onChange={handlePlantChange}
        />
        <StatusBar status={status} countdown={countdown} />
      </div>
      {error ? (
        <div className="error-card">
          <h2>Connection Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <Flow plant={currentPlant} />
      )}
    </div>
  );
}
