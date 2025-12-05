import React, { useEffect, useState } from 'react';
import { fetchPlants } from './api';
import StatusBar from './components/StatusBar';
import Tabs from './components/Tabs';
import Overview from './components/Overview';
import Flow from './components/Flow';
import LiveStats from './components/LiveStats';

export default function App() {
  const [status, setStatus] = useState('loading');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [plants, setPlants] = useState([]);
  const [currentPlant, setCurrentPlant] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    setStatus('loading');
    try {
      const data = await fetchPlants();
      setStatus('ok');
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);

      if (data.pageList && data.pageList.length > 0) {
        setPlants(data.pageList);
        setCurrentPlant(data.pageList[0]);
      }
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }

  function renderContent() {
    if (error) {
      return (
        <div className="error-card">
          <h2>Connection Error</h2>
          <p>{error}</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <Overview plants={plants} />;
      case 'flow':
        return <Flow plant={currentPlant} />;
      case 'live':
        return <LiveStats plant={currentPlant} />;
      default:
        return null;
    }
  }

  return (
    <div className="container">
      <h1>Sungrow Solar</h1>
      <StatusBar status={status} lastUpdate={lastUpdate} />
      <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
      {renderContent()}
    </div>
  );
}
