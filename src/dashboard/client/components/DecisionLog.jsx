import React, { useState } from 'react';

const DecisionLog = ({ decisions }) => {
  const [expandedDecision, setExpandedDecision] = useState(null);

  const toggleExpanded = (decisionId) => {
    setExpandedDecision(expandedDecision === decisionId ? null : decisionId);
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.7) return '#4caf50';
    if (confidence >= 0.4) return '#ff9800';
    return '#f44336';
  };

  const getActionColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'buy': return '#4caf50';
      case 'sell': return '#f44336';
      default: return '#757575';
    }
  };

  return (
    <div className="decision-log">
      <div className="section-header">
        <h2>🧠 AI Decision Engine</h2>
        <p>Real-time AI decision making with full transparency</p>
      </div>

      {decisions.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🤖</span>
          <p>AI is initializing... First decisions will appear here shortly.</p>
        </div>
      ) : (
        <div className="decisions-container">
          {decisions.map(decision => (
            <div key={decision.id} className="decision-card">
              <div className="decision-header" onClick={() => toggleExpanded(decision.id)}>
                <div className="decision-main">
                  <div className="symbol-action">
                    <span className="symbol">{decision.symbol}</span>
                    <span 
                      className="action"
                      style={{ color: getActionColor(decision.action) }}
                    >
                      {decision.action?.toUpperCase()}
                    </span>
                  </div>
                  <div className="confidence-bar">
                    <div className="confidence-label">
                      Confidence: {(decision.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="confidence-progress">
                      <div 
                        className="confidence-fill"
                        style={{ 
                          width: `${decision.confidence * 100}%`,
                          backgroundColor: getConfidenceColor(decision.confidence)
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="decision-meta">
                  <div className="timestamp">
                    {new Date(decision.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="expand-icon">
                    {expandedDecision === decision.id ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {expandedDecision === decision.id && (
                <div className="decision-details">
                  <div className="strategy-breakdown">
                    <h4>Strategy Analysis</h4>
                    <div className="strategy-grid">
                      <div className="strategy-item">
                        <span className="strategy-label">Technical:</span>
                        <span className="strategy-value">
                          {decision.regime?.trending ? 'Trending' : 'Range-bound'}
                        </span>
                      </div>
                      <div className="strategy-item">
                        <span className="strategy-label">Volatility:</span>
                        <span className="strategy-value">
                          {decision.regime?.highVol ? 'High' : 'Low'}
                        </span>
                      </div>
                      <div className="strategy-item">
                        <span className="strategy-label">Size (USD):</span>
                        <span className="strategy-value">${decision.sizeUsd}</span>
                      </div>
                    </div>
                  </div>

                  {decision.stops && (
                    <div className="risk-management">
                      <h4>Risk Management</h4>
                      <div className="stops-grid">
                        <div className="stop-item">
                          <span className="stop-label">Stop Loss:</span>
                          <span className="stop-value">${decision.stops.stopLoss?.toFixed(2)}</span>
                        </div>
                        <div className="stop-item">
                          <span className="stop-label">Take Profit:</span>
                          <span className="stop-value">${decision.stops.takeProfit?.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {decision.tradingPrompt && (
                    <div className="ai-prompt">
                      <h4>AI Prompt & Reasoning</h4>
                      <div className="prompt-container">
                        <pre className="prompt-text">
                          {decision.tradingPrompt.substring(0, 500)}
                          {decision.tradingPrompt.length > 500 && '...'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {decision.llmDecision && (
                    <div className="llm-response">
                      <h4>LLM Response</h4>
                      <div className="response-container">
                        {decision.llmDecision.rationale ? (
                          <div className="rationale">
                            <strong>Rationale:</strong> {decision.llmDecision.rationale}
                          </div>
                        ) : (
                          <pre className="response-raw">
                            {JSON.stringify(decision.llmDecision, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DecisionLog;
