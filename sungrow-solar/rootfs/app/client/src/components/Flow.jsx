import React, { useEffect, useState } from 'react';
import { fetchDevices, fetchRealtimeData } from '../api';
import { formatPower, powerUnit } from '../utils';
import Card from './Card';

export default function Flow({ plant }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flowData, setFlowData] = useState(null);

  useEffect(() => {
    if (!plant) return;
    loadFlowData();
  }, [plant]);

  async function loadFlowData() {
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
      const deviceType = device.device_type || 14;

      const data = await fetchRealtimeData(psKey, deviceType);
      console.log(data)

      if (data.device_point_list && data.device_point_list.length > 0) {
        setFlowData(data.device_point_list[0].device_point);
      } else {
        setError('No flow data available');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!plant) {
    return <div className="loading">Select a plant to view energy flow</div>;
  }

  if (loading && !flowData) {
    return <div className="loading">Loading flow data...</div>;
  }

  if (error) {
    return (
      <div className="error-card">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!flowData) {
    return <div className="loading">No flow data</div>;
  }

  return <FlowDiagram dp={flowData} />;
}

function FlowDiagram({ dp }) {
  const solarPower = parseFloat(dp.p13003) || 0;
  const loadPower = parseFloat(dp.p13119) || 0;
  const gridExport = parseFloat(dp.p13121) || 0;
  const gridImport = parseFloat(dp.p13149) || 0;
  const battCharge = parseFloat(dp.p13126) || 0;
  const battDischarge = parseFloat(dp.p13150) || 0;
  const socRaw = parseFloat(dp.p13141) || 0;
  const soc = socRaw <= 1 ? (socRaw * 100).toFixed(0) : socRaw.toFixed(0);

  // Node positions
  const solar = { x: 250, y: 80 };
  const home = { x: 250, y: 250 };
  const battery = { x: 100, y: 400 };
  const grid = { x: 400, y: 400 };

  // Active flows
  const flows = [
    { id: 'solar-home', from: solar, to: home, active: solarPower > 0 && loadPower > 0, colorClass: 'flow-line-solar' },
    { id: 'solar-battery', from: solar, to: battery, active: solarPower > 0 && battCharge > 0, colorClass: 'flow-line-solar' },
    { id: 'solar-grid', from: solar, to: grid, active: solarPower > 0 && gridExport > 0, colorClass: 'flow-line-solar' },
    { id: 'battery-home', from: battery, to: home, active: battDischarge > 0 && loadPower > 0, colorClass: 'flow-line-battery' },
    { id: 'grid-home', from: grid, to: home, active: gridImport > 0 && loadPower > 0, colorClass: 'flow-line-grid-import' },
    { id: 'grid-battery', from: grid, to: battery, active: gridImport > 0 && battCharge > 0, colorClass: 'flow-line-grid-import' },
  ];

  return (
    <>
      <div className="flow-container">
        <svg className="flow-svg" viewBox="0 0 500 500">
          {/* Lines */}
          {flows.map((flow) => (
            <FlowLine key={flow.id} {...flow} />
          ))}

          {/* Nodes */}
          <FlowNode pos={solar} icon="☀️" label="Solar" value={formatPower(solarPower)} unit={powerUnit(solarPower)} colorClass="flow-node-solar" />
          <FlowNode pos={home} icon="🏠" label="Home" value={formatPower(loadPower)} unit={powerUnit(loadPower)} colorClass="flow-node-home" />
          <FlowNode pos={battery} icon="🔋" label={`Battery ${soc}%`} value={formatPower(battCharge || battDischarge)} unit={powerUnit(battCharge || battDischarge)} colorClass="flow-node-battery" />
          <FlowNode pos={grid} icon="⚡" label="Grid" value={formatPower(gridImport || gridExport)} unit={powerUnit(gridImport || gridExport)} colorClass="flow-node-grid" />
        </svg>
      </div>

      <div className="grid" style={{ marginTop: 20 }}>
        <Card title="Solar" value={formatPower(solarPower)} unit={powerUnit(solarPower)} variant="solar" />
        <Card title="Home" value={formatPower(loadPower)} unit={powerUnit(loadPower)} variant="load" />
        <Card
          title="Battery"
          value={`${battCharge > 0 ? '+' : battDischarge > 0 ? '-' : ''}${formatPower(battCharge || battDischarge)}`}
          unit={powerUnit(battCharge || battDischarge)}
          variant="battery"
        />
        <Card
          title="Grid"
          value={`${gridImport > 0 ? '+' : gridExport > 0 ? '-' : ''}${formatPower(gridImport || gridExport)}`}
          unit={powerUnit(gridImport || gridExport)}
          variant={gridImport > 0 ? 'grid-import' : 'grid-export'}
        />
      </div>
    </>
  );
}

function FlowLine({ id, from, to, active, colorClass }) {
  const pathId = `path-${id}`;
  const d = `M${from.x},${from.y} L${to.x},${to.y}`;
  const lineClass = active ? `flow-line flow-line-active ${colorClass}` : 'flow-line';
  const dotClass = colorClass.replace('flow-line-', 'flow-dot-');

  return (
    <>
      <path id={pathId} d={d} className={lineClass} />
      {active && (
        <>
          {[0, 1, 2].map((i) => (
            <circle key={i} r="5" className={`flow-dot ${dotClass}`}>
              <animateMotion dur="1.5s" repeatCount="indefinite" begin={`${i * 0.5}s`}>
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          ))}
        </>
      )}
    </>
  );
}

function FlowNode({ pos, icon, label, value, unit, colorClass }) {
  return (
    <g transform={`translate(${pos.x},${pos.y})`}>
      <circle r="45" className={`flow-node ${colorClass}`} />
      <text y="-8" className="flow-icon">{icon}</text>
      <text y="18" className="flow-value">
        {value}
        <tspan className="flow-label"> {unit}</tspan>
      </text>
      <text y="70" className="flow-label">{label}</text>
    </g>
  );
}
