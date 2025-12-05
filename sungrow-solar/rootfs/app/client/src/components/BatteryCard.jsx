import React from 'react';

export default function BatteryCard({ title, value, unit, soc }) {
  return (
    <div className="card battery">
      <h3>{title}</h3>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {soc !== undefined && (
        <div className="battery-bar">
          <div className="battery-fill" style={{ width: `${soc}%` }}></div>
        </div>
      )}
    </div>
  );
}
