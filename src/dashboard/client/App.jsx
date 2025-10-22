import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import DecisionLog from './components/DecisionLog';
import PerformanceMetrics from './components/PerformanceMetrics';
import LiveStatus from './components/LiveStatus';
import './styles.css';

const App = () => {
  const [socket, setSocket] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [performance, setPerformance] = useState({});
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('decisions');

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('initial-data', (data) => {
      setDecisions(data.decisions || []);
      setTrades(data.trades || []);
      setPerformance(data.performance || {});
    });

    newSocket.on('new-decision', (decision) => {
      setDecisions(prev => [decision, ...prev.slice(0, 49)]);
    });

    newSocket.on('new-trade', (trade) => {
      setTrades(prev => [trade, ...prev.slice(0, 49)]);
    });

    newSocket.on('performance-update', (perf) => {
      setPerformance(perf);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const tabs = [
    { id: 'decisions', label: 'AI Decisions', icon: '🧠' },
    { id: 'trades', label: 'Live Trades', icon: '⚡' },
    { id: 'performance', label: 'Performance', icon: '📊' }
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🌌</span>
            <h1>Quantum Vibe Trader</h1>
            <span className="subtitle">AI-Powered Multi-Strategy Trading</span>
          </div>
          <LiveStatus connected={connected} />
        </div>
      </header>

      <nav className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main-content">
        {activeTab === 'decisions' && (
          <DecisionLog decisions={decisions} />
        )}
        {activeTab === 'trades' && (
          <div className="trades-container">
            <h2>Live Trading Activity</h2>
            {trades.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">📈</span>
                <p>No trades executed yet. AI is analyzing market conditions...</p>
              </div>
            ) : (
              <div className="trades-grid">
                {trades.map(trade => (
                  <div key={trade.id} className="trade-card">
                    <div className="trade-header">
                      <span className="symbol">{trade.symbol}</span>
                      <span className={`side ${trade.side?.toLowerCase()}`}>
                        {trade.side}
                      </span>
                    </div>
                    <div className="trade-details">
                      <div className="detail">
                        <span className="label">Quantity:</span>
                        <span className="value">{trade.quantity}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Price:</span>
                        <span className="value">${trade.price}</span>
                      </div>
                      {trade.pnl !== undefined && (
                        <div className="detail">
                          <span className="label">P&L:</span>
                          <span className={`value ${trade.pnl >= 0 ? 'profit' : 'loss'}`}>
                            ${trade.pnl.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="trade-time">
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'performance' && (
          <PerformanceMetrics performance={performance} trades={trades} />
        )}
      </main>
    </div>
  );
};

export default App;
