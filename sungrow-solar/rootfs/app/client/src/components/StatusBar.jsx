import React from 'react';

export default function StatusBar({ status, countdown }) {
  const dotClass = status === 'error' ? 'error' : 'ok';
  const statusText = status === 'error' ? 'Error' : 'Connected';
  const countdownStr = String(countdown).padStart(2, '0');

  return (
    <div className="status-bar">
      <div>
        <span className={`status-dot ${dotClass}`}></span>
        <span>{statusText}</span>
      </div>
      {status === 'loading' ? (
        <span className="spinner"></span>
      ) : (
        <span className="refresh-text">Refresh in {countdownStr}s</span>
      )}
    </div>
  );
}
