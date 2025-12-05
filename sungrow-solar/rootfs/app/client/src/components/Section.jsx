import React from 'react';

export default function Section({ title, meta, children }) {
  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title">{title}</div>
        {meta && <div className="section-meta">{meta}</div>}
      </div>
      {children}
    </div>
  );
}
