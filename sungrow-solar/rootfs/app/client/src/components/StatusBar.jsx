import React from 'react';

export default function StatusBar({ status, lastUpdate }) {
  const dotClass = status === 'loading' ? 'loading' : status === 'error' ? 'error' : 'ok';
  const statusText = status === 'loading' ? 'Updating...' : status === 'error' ? 'Error' : 'Connected';

  return (
    <div className="status-bar">
      <div>
        <span className={`status-dot ${dotClass}`}></span>
        <span>{statusText}</span>
      </div>
      <div>Last updated: {lastUpdate || '--'}</div>
    </div>
  );
}
