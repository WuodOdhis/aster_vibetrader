import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const PerformanceMetrics = ({ performance, trades }) => {
  // Calculate equity curve from trades
  const equityCurve = trades.reduce((acc, trade, index) => {
    const prevEquity = acc.length > 0 ? acc[acc.length - 1].equity : 10000;
    const newEquity = prevEquity + (trade.pnl || 0);
    acc.push({
      index: trades.length - index,
      equity: newEquity,
      time: new Date(trade.timestamp).toLocaleTimeString(),
      pnl: trade.pnl || 0
    });
    return acc;
  }, []).reverse();

  // Calculate daily P&L
  const dailyPnL = trades.reduce((acc, trade) => {
    const date = new Date(trade.timestamp).toDateString();
    if (!acc[date]) acc[date] = 0;
    acc[date] += trade.pnl || 0;
    return acc;
  }, {});

  const dailyData = Object.entries(dailyPnL).map(([date, pnl]) => ({
    date: new Date(date).toLocaleDateString(),
    pnl: pnl
  }));

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const calculateSharpeRatio = () => {
    if (dailyData.length < 2) return 0;
    const returns = dailyData.map(d => d.pnl);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, ret) => acc + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); // Annualized
  };

  const metrics = [
    {
      label: 'Total Trades',
      value: performance.totalTrades || 0,
      icon: '📊',
      color: '#2196f3'
    },
    {
      label: 'Win Rate',
      value: formatPercentage(performance.winRate || 0),
      icon: '🎯',
      color: performance.winRate >= 0.5 ? '#4caf50' : '#f44336'
    },
    {
      label: 'Total P&L',
      value: formatCurrency(performance.totalPnl || 0),
      icon: '💰',
      color: (performance.totalPnl || 0) >= 0 ? '#4caf50' : '#f44336'
    },
    {
      label: 'Max Drawdown',
      value: formatPercentage(performance.maxDrawdown || 0),
      icon: '📉',
      color: (performance.maxDrawdown || 0) <= 0.05 ? '#4caf50' : '#f44336'
    },
    {
      label: 'Sharpe Ratio',
      value: calculateSharpeRatio().toFixed(2),
      icon: '📈',
      color: calculateSharpeRatio() >= 1 ? '#4caf50' : '#ff9800'
    },
    {
      label: 'Avg P&L',
      value: formatCurrency(performance.avgPnl || 0),
      icon: '⚖️',
      color: (performance.avgPnl || 0) >= 0 ? '#4caf50' : '#f44336'
    }
  ];

  return (
    <div className="performance-metrics">
      <div className="section-header">
        <h2>📊 Performance Analytics</h2>
        <p>Real-time trading performance and risk metrics</p>
      </div>

      <div className="metrics-grid">
        {metrics.map((metric, index) => (
          <div key={index} className="metric-card">
            <div className="metric-icon" style={{ color: metric.color }}>
              {metric.icon}
            </div>
            <div className="metric-content">
              <div className="metric-label">{metric.label}</div>
              <div className="metric-value" style={{ color: metric.color }}>
                {metric.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {equityCurve.length > 1 && (
        <div className="charts-container">
          <div className="chart-section">
            <h3>Equity Curve</h3>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={equityCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis 
                    dataKey="index" 
                    stroke="#888"
                    tick={{ fill: '#888' }}
                  />
                  <YAxis 
                    stroke="#888"
                    tick={{ fill: '#888' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1f3a', 
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [formatCurrency(value), 'Equity']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="equity" 
                    stroke="#64b5f6" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {dailyData.length > 0 && (
            <div className="chart-section">
              <h3>Daily P&L</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#888"
                      tick={{ fill: '#888' }}
                    />
                    <YAxis 
                      stroke="#888"
                      tick={{ fill: '#888' }}
                      tickFormatter={formatCurrency}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1a1f3a', 
                        border: '1px solid #333',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => [formatCurrency(value), 'P&L']}
                    />
                    <Bar 
                      dataKey="pnl" 
                      fill={(entry) => entry >= 0 ? '#4caf50' : '#f44336'}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {trades.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">📈</span>
          <p>Performance metrics will appear after the first trades are executed.</p>
        </div>
      )}
    </div>
  );
};

export default PerformanceMetrics;
