import React, { useState, useEffect } from 'react';

const LiveStatus = ({ connected }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="live-status">
      <div className="status-item">
        <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
          <div className="status-dot"></div>
        </div>
        <span className="status-text">
          {connected ? 'Live Trading' : 'Disconnected'}
        </span>
      </div>
      
      <div className="status-item">
        <span className="time-label">Market Time:</span>
        <span className="time-value">
          {currentTime.toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default LiveStatus;
