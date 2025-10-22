# 🌌 Quantum Vibe Trader

**AI-Powered Multi-Strategy Trading System for Aster Vibe Trading Arena**

> *"Where quantum mechanics meets market dynamics"*

## 🎯 Competition Overview

Quantum Vibe Trader is our entry for the **Aster Vibe Trading Arena** ($50K prize pool), designed to showcase transparent AI decision-making, sophisticated risk management, and multi-strategy fusion in live cryptocurrency trading.

## 🧠 Our "Quantum Vibe" Philosophy

### Core Principles
- **Quantum Superposition**: Multiple strategies exist simultaneously until market observation collapses them into optimal decisions
- **Entanglement**: All market factors are interconnected - technical, sentiment, and risk signals influence each other
- **Uncertainty Principle**: We embrace market uncertainty through probabilistic decision-making and dynamic risk adjustment
- **Observer Effect**: Our AI's presence in the market influences our strategy selection and execution

### Competitive Advantages
1. **Full Transparency**: Every AI decision is logged with complete reasoning chains
2. **Multi-Strategy Fusion**: Technical, sentiment, and risk strategies work in harmony
3. **Dynamic Risk Management**: Real-time correlation analysis and circuit breakers
4. **Professional Dashboard**: Live visualization of AI "thinking" process

## 🏗️ System Architecture

```
quantum-vibe-trader/
├── src/
│   ├── strategies/           # Multi-Strategy AI Engine
│   │   ├── technical_analyzer.js    # RSI, MACD, Bollinger Bands
│   │   ├── sentiment_engine.js     # Social + On-chain Analysis  
│   │   ├── risk_manager.js         # Kelly Criterion + Correlation
│   │   └── decision_engine.js      # Strategy Fusion Logic
│   ├── aster/               # Live Trading Infrastructure
│   │   ├── api_client.js           # AsterDex API Integration
│   │   └── websocket_handler.js    # Real-time Market Data
│   ├── ai/                  # AI Decision Making
│   │   ├── decision_engine.js      # Core AI Logic
│   │   └── prompt_templates.js     # LLM Prompts
│   ├── dashboard/           # Transparency Dashboard
│   │   ├── server.js              # Express + Socket.IO
│   │   └── client/                # React Dashboard
│   └── utils/
│       ├── logger.js              # Comprehensive Logging
│       └── simulator.js           # Backtesting Engine
```

## 🚀 Key Features

### 1. Multi-Strategy Decision Engine
- **Technical Analysis**: Multi-timeframe RSI, MACD, Bollinger Bands, EMA crossovers
- **Sentiment Fusion**: Social sentiment + on-chain metrics + market structure
- **Risk Management**: Kelly Criterion position sizing, correlation analysis, circuit breakers

### 2. Live Trading Infrastructure
- **Real-time Data**: WebSocket feeds with REST fallback
- **Order Execution**: Signed API requests with proper error handling
- **Portfolio Tracking**: Live P&L calculation and position monitoring

### 3. Transparent AI Dashboard
- **Decision Log**: Every AI decision with full reasoning
- **Performance Metrics**: Win rate, Sharpe ratio, drawdown analysis
- **Live Charts**: Equity curve and daily P&L visualization
- **Risk Monitoring**: Real-time correlation and volatility tracking

### 4. Advanced Risk Controls
- **Position Sizing**: Maximum 2% risk per trade using Kelly Criterion
- **Correlation Analysis**: Portfolio diversification monitoring
- **Circuit Breakers**: Automatic halt on extreme market conditions
- **Drawdown Limits**: 8% maximum drawdown protection

## 📊 Trading Strategies

### Strategy 1: Technical Momentum + Mean Reversion
```javascript
// Multi-timeframe analysis
- 5min: Scalping opportunities
- 1hr: Trend identification  
- 4hr: Macro direction

// Indicator suite
- RSI (oversold/overbought levels)
- MACD (momentum confirmation)
- Bollinger Bands (volatility breakouts)
- EMA crossovers (9/21/50 periods)
- ATR (volatility-adjusted stops)
```

### Strategy 2: Sentiment + On-Chain Analysis
```javascript
// Social sentiment scoring (0-100)
- Twitter/Telegram sentiment
- Google Trends analysis
- News sentiment processing

// On-chain metrics
- Whale wallet movements
- Exchange flow analysis
- Network activity indicators
```

### Strategy 3: Risk-Managed Decision Fusion
```javascript
// Portfolio risk management
- Kelly Criterion position sizing
- Correlation-based diversification
- Dynamic stop-loss placement
- Market regime detection
```

## 🎮 Getting Started

### Prerequisites
- Node.js 16+
- AsterDex API credentials
- DeepSeek AI API key (optional)

### Installation
```bash
git clone https://github.com/WuodOdhis/aster_vibetrader.git
cd quantum-vibe-trader
npm install
```

### Configuration
```bash
cp .env.example .env
# Edit .env with your API keys
```

### Running the System
```bash
# Start dashboard (port 3000)
npm start

# Start trading engine
npm run trade

# Build React dashboard
npm run build-dashboard

# Development mode
npm run dev
```

## 📈 Performance Monitoring

### Real-time Metrics
- **Win Rate**: Percentage of profitable trades
- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Peak-to-trough decline
- **Correlation Analysis**: Portfolio diversification
- **Volatility Tracking**: Market regime detection

### Dashboard Features
- Live AI decision stream with full transparency
- Real-time P&L and equity curve
- Strategy confidence scores and fusion logic
- Risk metrics and circuit breaker status
- Trade execution log with detailed reasoning

## 🔒 Risk Management

### Position Sizing
- Maximum 2% portfolio risk per trade
- Kelly Criterion optimization
- Volatility-adjusted sizing using ATR

### Portfolio Protection
- Correlation analysis between positions
- Maximum 8% drawdown limit
- Circuit breakers for extreme market conditions
- Dynamic stop-loss placement

### Market Regime Detection
- Trend vs. range-bound identification
- High vs. low volatility modes
- Liquidity assessment
- Sentiment regime classification

## 🧪 Simulation & Backtesting

```javascript
const { TradingSimulator } = require('./src/utils/simulator');

const simulator = new TradingSimulator({
  initialBalance: 10000,
  fees: 0.001
});

const results = await simulator.backtest(
  historicalData, 
  ['AVAXUSDT', 'SOLUSDT'], 
  '2024-01-01', 
  '2024-12-01'
);
```

## 📝 Logging & Transparency

Every decision and trade is logged with:
- Complete AI reasoning chain
- Strategy confidence scores
- Risk assessment details
- Market context and indicators
- Execution details and outcomes

## 🏆 Competition Strategy

### Judge Appeal Factors
1. **Transparency**: Full AI decision visibility
2. **Sophistication**: Multi-strategy fusion with advanced risk controls
3. **Performance**: Consistent returns with controlled risk
4. **Innovation**: Quantum-inspired trading philosophy
5. **Professional Presentation**: Clean dashboard and comprehensive documentation

### Target Performance
- **Return Target**: 15-25% during competition period
- **Risk Target**: Maximum 8% drawdown
- **Sharpe Ratio**: > 2.0
- **Win Rate**: > 55%

## 🔧 Technical Implementation

### API Integration
- AsterDex futures trading via Binance-compatible endpoints
- HMAC-SHA256 signed requests for authentication
- Rate limiting and error handling
- WebSocket real-time data with REST fallback

### AI Decision Engine
- Multi-strategy signal fusion
- Performance-weighted strategy selection
- Market regime-aware conflict resolution
- Optional DeepSeek AI integration for advisory decisions

### Dashboard Technology
- React frontend with real-time updates
- Socket.IO for live data streaming
- Recharts for performance visualization
- Responsive design for mobile monitoring

## 📞 Support & Contact

For competition judges and technical review:
- **GitHub**: [WuodOdhis/aster_vibetrader](https://github.com/WuodOdhis/aster_vibetrader)
- **Dashboard**: http://localhost:3000 (when running)
- **Documentation**: This README and inline code comments

---

*Built with ❤️ for the Aster Vibe Trading Arena*

**"In the quantum realm of trading, every decision exists in superposition until the market observes it into reality."**
