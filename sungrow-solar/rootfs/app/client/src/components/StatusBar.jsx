import React from 'react';

export default function StatusBar({ status }) {
  const dotClass = status === 'error' ? 'error' : 'ok';
  const statusText = status === 'error' ? 'Error' : 'Connected';

  return (
    <div className="status-bar">
      <div>
        <span className={`status-dot ${dotClass}`}></span>
        <span>{statusText}</span>
      </div>
    </div>
  );
}
