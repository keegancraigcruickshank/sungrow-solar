import React, { useEffect, useState } from 'react';
import { Sun, Home as HomeIcon, BatteryFull, Zap } from 'lucide-react';
import { fetchDevices, fetchRealtimeData } from '../api';
import { formatPower, powerUnit } from '../utils';

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

  // Layout: 400x460 viewBox
  // Solar at top center, Home in center, Battery bottom-left, Grid bottom-right
  const r = 20; // corner radius
  const nodeSize = 36;
  const lineGap = 6; // gap between line end and node

  // Positions - forming a square with home in center
  const solar = { x: 200, y: 60 };
  const home = { x: 200, y: 195 };
  const battery = { x: 60, y: 330 };
  const grid = { x: 340, y: 330 };

  // Outer frame edges (where the paths run along)
  const left = 60;
  const right = 340;
  const top = 60;
  const bottom = 330;

  // Gap between battery-home and grid-home lines at center
  const gap = 12;

  // Path definitions with rounded corners
  // Solar to Home: straight down from solar to home
  const pathSolarHome = `
    M${solar.x},${solar.y + nodeSize + lineGap}
    L${home.x},${home.y - nodeSize - lineGap}`;

  // Solar to Battery: from solar left side, along top edge, curve at top-left corner, down left edge to battery
  const pathSolarBattery = `
    M${solar.x - nodeSize - lineGap},${solar.y}
    L${left + r},${top}
    Q${left},${top} ${left},${top + r}
    L${battery.x},${battery.y - nodeSize - lineGap}`;

  // Solar to Grid: from solar right side, along top edge, curve at top-right corner, down right edge to grid
  const pathSolarGrid = `
    M${solar.x + nodeSize + lineGap},${solar.y}
    L${right - r},${top}
    Q${right},${top} ${right},${top + r}
    L${grid.x},${grid.y - nodeSize - lineGap}`;

  // Vertical offset to separate the home lines from the battery-grid line
  const lineOffset = 12;

  // Battery to Grid: straight horizontal line from battery right side to grid left side (lower)
  const pathBatteryGrid = `
    M${battery.x + nodeSize + lineGap},${battery.y + lineOffset}
    L${grid.x - nodeSize - lineGap},${grid.y + lineOffset}`;

  // Battery to Home: from battery right side, along bottom toward center, curve up to home (higher)
  const pathBatteryHome = `
    M${battery.x + nodeSize + lineGap},${battery.y - lineOffset}
    L${home.x - gap - r},${bottom - lineOffset}
    Q${home.x - gap},${bottom - lineOffset} ${home.x - gap},${bottom - lineOffset - r}
    L${home.x - gap},${home.y + nodeSize + lineGap}`;

  // Grid to Home: from grid left side, along bottom toward center, curve up to home (higher)
  const pathGridHome = `
    M${grid.x - nodeSize - lineGap},${grid.y - lineOffset}
    L${home.x + gap + r},${bottom - lineOffset}
    Q${home.x + gap},${bottom - lineOffset} ${home.x + gap},${bottom - lineOffset - r}
    L${home.x + gap},${home.y + nodeSize + lineGap}`;

  // Calculate power flowing through each path
  // Solar distributes to home, battery, and grid
  const solarToHome = Math.min(solarPower, loadPower);
  const solarToBattery = battCharge > 0 ? Math.min(solarPower - solarToHome, battCharge) : 0;
  const solarToGrid = gridExport;

  // Battery/grid to home
  const batteryToHome = battDischarge > 0 ? Math.min(battDischarge, loadPower - solarToHome) : 0;
  const gridToHome = gridImport > 0 ? Math.min(gridImport, loadPower - solarToHome - batteryToHome) : 0;
  const gridToBattery = gridImport > 0 && battCharge > 0 ? battCharge : 0;

  // Find max power for normalization
  const allPowers = [solarToHome, solarToBattery, solarToGrid, batteryToHome, gridToHome, gridToBattery];
  const maxPower = Math.max(...allPowers, 0.1);

  // Approximate path lengths (relative)
  const pathLengths = {
    'solar-home': 80,      // short vertical
    'solar-battery': 320,  // around corner
    'solar-grid': 320,     // around corner
    'battery-home': 200,   // along bottom + up
    'grid-home': 200,      // along bottom + up
    'battery-grid': 280,   // straight across
  };

  // Calculate duration based on power and path length (velocity represents power)
  function getFlowParams(power, pathLength) {
    if (power <= 0) return { dots: 3, duration: 2 };

    const normalizedPower = power / maxPower;

    // Fixed spacing between dots (in pixels) - longer paths get more dots
    const dotSpacing = 60;
    const dots = Math.max(2, Math.round(pathLength / dotSpacing));

    // More power = faster (shorter duration)
    // Speed ranges from 40px/s (low power) to 150px/s (max power)
    const speed = 40 + (normalizedPower * 110);
    const duration = pathLength / speed;

    return { dots, duration };
  }

  // Determine which flows are active
  const flows = [
    {
      id: 'solar-home',
      path: pathSolarHome,
      active: solarPower > 0 && loadPower > 0,
      power: solarToHome,
      color: '#eab308',
      ...getFlowParams(solarToHome, pathLengths['solar-home'])
    },
    {
      id: 'solar-battery',
      path: pathSolarBattery,
      active: solarPower > 0 && battCharge > 0,
      power: solarToBattery,
      color: '#eab308',
      ...getFlowParams(solarToBattery, pathLengths['solar-battery'])
    },
    {
      id: 'solar-grid',
      path: pathSolarGrid,
      active: solarPower > 0 && gridExport > 0,
      power: solarToGrid,
      color: '#eab308',
      ...getFlowParams(solarToGrid, pathLengths['solar-grid'])
    },
    {
      id: 'battery-home',
      path: pathBatteryHome,
      active: battDischarge > 0 && loadPower > 0,
      power: batteryToHome,
      color: '#22c55e',
      ...getFlowParams(batteryToHome, pathLengths['battery-home'])
    },
    {
      id: 'grid-home',
      path: pathGridHome,
      active: gridImport > 0 && loadPower > 0,
      power: gridToHome,
      color: '#ef4444',
      ...getFlowParams(gridToHome, pathLengths['grid-home'])
    },
    {
      id: 'battery-grid',
      path: pathBatteryGrid,
      active: gridImport > 0 && battCharge > 0,
      power: gridToBattery,
      color: '#ef4444',
      ...getFlowParams(gridToBattery, pathLengths['battery-grid'])
    },
  ];

  return (
    <div className="flow-diagram">
      <svg viewBox="0 0 400 450" className="flow-svg">
        <defs>
          {/* Glow filters for active lines */}
          <filter id="glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Flow lines */}
        {flows.map((flow) => (
          <g key={flow.id}>
            {/* Background line (always visible, dimmed) */}
            <path
              d={flow.path}
              fill="none"
              stroke="var(--border-color, rgba(255,255,255,0.1))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Active line with glow */}
            {flow.active && (
              <>
                <path
                  id={`path-${flow.id}`}
                  d={flow.path}
                  fill="none"
                  stroke={flow.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
                {/* Animated dots - count and speed based on power */}
                {Array.from({ length: flow.dots }, (_, i) => (
                  <circle key={i} r="5" fill={flow.color}>
                    <animateMotion
                      dur={`${flow.duration}s`}
                      repeatCount="indefinite"
                      begin={`${i * (flow.duration / flow.dots)}s`}
                    >
                      <mpath href={`#path-${flow.id}`} />
                    </animateMotion>
                    <animate
                      attributeName="opacity"
                      values="0;0.9;0.9;0"
                      keyTimes="0;0.1;0.9;1"
                      dur={`${flow.duration}s`}
                      repeatCount="indefinite"
                      begin={`${i * (flow.duration / flow.dots)}s`}
                    />
                  </circle>
                ))}
              </>
            )}
          </g>
        ))}

        {/* Nodes */}
        <FlowNode
          x={solar.x}
          y={solar.y}
          icon={Sun}
          label="Solar"
          status={solarPower > 0 ? 'Generating' : 'Idle'}
          value={formatPower(solarPower)}
          unit={powerUnit(solarPower)}
          color="#eab308"
          active={solarPower > 0}
          textPosition="top-right"
        />
        <FlowNode
          x={home.x}
          y={home.y}
          icon={HomeIcon}
          label="Home"
          status={loadPower > 0 ? 'Consuming' : 'Idle'}
          value={formatPower(loadPower)}
          unit={powerUnit(loadPower)}
          color="#a855f7"
          active={loadPower > 0}
          textPosition="right"
        />
        <FlowNode
          x={battery.x}
          y={battery.y}
          icon={BatteryFull}
          label={`Battery ${soc}%`}
          status={battCharge > 0 ? 'Charging' : battDischarge > 0 ? 'Discharging' : 'Idle'}
          value={formatPower(battCharge || battDischarge)}
          unit={powerUnit(battCharge || battDischarge)}
          color="#22c55e"
          active={battCharge > 0 || battDischarge > 0}
          textPosition="below"
        />
        <FlowNode
          x={grid.x}
          y={grid.y}
          icon={Zap}
          label="Grid"
          status={gridImport > 0 ? 'Importing' : gridExport > 0 ? 'Exporting' : 'Idle'}
          value={formatPower(gridImport || gridExport)}
          unit={powerUnit(gridImport || gridExport)}
          color={gridImport > 0 ? '#ef4444' : '#3b82f6'}
          active={gridImport > 0 || gridExport > 0}
          textPosition="below"
        />
      </svg>
    </div>
  );
}

function FlowNode({ x, y, icon: Icon, label, status, value, unit, color, active, textPosition = 'below' }) {
  const size = 36;

  // Text positioning based on node location to avoid wires
  const diag = Math.round(size * 0.7); // 45 degree offset
  const textOffsets = {
    above: { x: 0, y: -size - 12, anchor: 'middle' },
    below: { x: 0, y: size + 20, anchor: 'middle' },
    left: { x: -size - 12, y: 0, anchor: 'end' },
    right: { x: size + 12, y: 0, anchor: 'start' },
    'top-right': { x: diag + 16, y: -diag - 20, anchor: 'start' },
  };

  const offset = textOffsets[textPosition];

  return (
    <g transform={`translate(${x}, ${y})`} className="flow-node-group">
      {/* Background circle */}
      <circle
        r={size}
        fill="var(--bg-card, rgba(0,0,0,0.3))"
        stroke={active ? color : 'var(--border-color, rgba(255,255,255,0.2))'}
        strokeWidth="2.5"
      />

      {/* Icon */}
      <g transform="translate(-12, -12)">
        <Icon size={24} color={color} />
      </g>

      {/* Text group */}
      <g transform={`translate(${offset.x}, ${offset.y})`}>
        <text
          textAnchor={offset.anchor}
          dominantBaseline="middle"
          className="flow-node-label"
          fill="var(--text-muted, #999)"
        >
          {label}
        </text>
        <text
          y={16}
          textAnchor={offset.anchor}
          dominantBaseline="middle"
          className="flow-node-status"
          fill="var(--text-dim, #666)"
        >
          {status}
        </text>
        <text
          y={32}
          textAnchor={offset.anchor}
          dominantBaseline="middle"
          className="flow-node-value"
          fill="var(--text-primary, #fff)"
        >
          {value}
          <tspan className="flow-node-unit" fill="var(--text-muted, #999)"> {unit}</tspan>
        </text>
      </g>
    </g>
  );
}
