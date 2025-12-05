import React from 'react';

export default function Card({ title, value, unit, variant }) {
  return (
    <div className={`card ${variant || ''}`}>
      <h3>{title}</h3>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}
