'use strict';

const { analyzeMultiTimeframe } = require('../strategies/technical_analyzer');
const { fuseSentiment } = require('../strategies/sentiment_engine');
const { capOrderSizeUsd, shouldHaltTrading, computeStops, detectRegime, positionSizeUsd, marketCircuitBreaker } = require('../strategies/risk_manager');
const { decisionPrompt } = require('./prompt_templates');
const { trading } = require('../../config/trading_config');
const axios = require('axios');

function computePerfWeights(recentTrades = []) {
  const buckets = { tech: [], sentiment: [] };
  for (const t of recentTrades) {
    const key = (t.strategy || '').toLowerCase();
    if (key === 'tech' || key === 'technical') buckets.tech.push(t);
    if (key === 'sentiment') buckets.sentiment.push(t);
  }
  function score(arr) {
    if (!arr.length) return 0.5;
    const wins = arr.filter((t) => t.success === true).length / arr.length;
    const avgRr = arr.reduce((a, b) => a + (Number(b.rr) || 0), 0) / arr.length;
    return Math.max(0, Math.min(1, 0.6 * wins + 0.4 * Math.tanh(avgRr)));
  }
  const techScore = score(buckets.tech);
  const sentScore = score(buckets.sentiment);
  const sum = techScore + sentScore || 1;
  return { tech: techScore / sum, sentiment: sentScore / sum };
}

function summarizeTechnical(tech) {
  if (!tech) return 'No technical data';
  const ema = tech.context?.ema?.['1h'] || {};
  const rsi1h = tech.context?.rsi?.['1h'];
  const macd1h = tech.context?.macd?.['1h'];
  const atr1h = tech.context?.atr?.['1h'];
  return `Action: ${tech.action}, Conf: ${tech.confidence}, RSI(1h): ${rsi1h?.toFixed ? rsi1h.toFixed(1) : rsi1h}, EMA(9/21/50): ${[ema.ema9, ema.ema21, ema.ema50].map((x)=>x?.toFixed?x.toFixed(2):x).join('/')}, MACD(1h) hist: ${macd1h?.histogram?.toFixed?macd1h.histogram.toFixed(4):macd1h?.histogram}, ATR(1h): ${atr1h?.toFixed?atr1h.toFixed(2):atr1h}`;
}

function buildTradingPrompt({ token, technicalAnalysis, sentimentScore, riskProfile, currentPositions, recentTradesText }) {
  const tradingPrompt = `
You are Quantum Vibe Trader - a professional algorithmic trading AI.

CURRENT MARKET CONTEXT:
- Technical Signals: ${technicalAnalysis}
- Sentiment Score: ${sentimentScore}/100  
- Risk Assessment: ${riskProfile}
- Portfolio: ${currentPositions}

RECENT PERFORMANCE:
${recentTradesText}

YOUR TRADING PHILOSOPHY:
- Risk-managed opportunities only
- Multi-timeframe confirmation required
- Maximum 2% portfolio risk per trade

DECISION: [BUY/SELL/HOLD] ${token}
RATIONALE: [Detailed reasoning with probability estimates]
CONFIDENCE: 0.XX
POSITION_SIZE: X.X% of portfolio
STOP_LOSS: X.XX
TAKE_PROFIT: X.XX

Respond in exact JSON format.`;
  return tradingPrompt;
}

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try { return JSON.parse(slice); } catch (_) { return null; }
}

function sanitizeDecision(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const actionRaw = String(obj.action || obj.DECISION || '').toUpperCase();
  const allowed = ['BUY', 'SELL', 'HOLD'];
  const action = allowed.includes(actionRaw) ? actionRaw : 'HOLD';
  const confidence = Math.max(0, Math.min(1, Number(obj.confidence || obj.CONFIDENCE || 0)));
  const positionSizePct = Math.max(0, Math.min(100, Number(obj.position_size || obj.POSITION_SIZE || obj.position_size_pct || 0)));
  const stopLoss = Number(obj.stop_loss || obj.STOP_LOSS || 0) || 0;
  const takeProfit = Number(obj.take_profit || obj.TAKE_PROFIT || 0) || 0;
  const rationale = String(obj.rationale || obj.RATIONALE || '');
  return { action, confidence, positionSizePct, stopLoss, takeProfit, rationale };
}

async function consultDeepSeek({ prompt }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const use = String(process.env.USE_DEEPSEEK || '').toLowerCase() === 'true';
  if (!apiKey || !use) return null;
  try {
    const res = await axios.post(
      process.env.DEEPSEEK_URL || 'https://api.deepseek.com/v1/chat/completions',
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You must respond ONLY with a valid JSON object matching the schema: {"action":"BUY|SELL|HOLD","rationale":"string","confidence":0..1,"position_size":0..100,"stop_loss":number,"take_profit":number}. No prose.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 256
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const text = res.data?.choices?.[0]?.message?.content?.trim();
    const parsed = extractJson(text) || null;
    return sanitizeDecision(parsed) || { raw: text };
  } catch (e) {
    return null;
  }
}

async function decideTrade({ symbol, candles, events, positions, multiTf, recentTrades }) {
  const circuit = marketCircuitBreaker({ change1hPct: 0, change5mPct: 0, orderbookImbalance: 0 });
  if (shouldHaltTrading({ realizedPnlTodayUsd: 0, circuitBreaker: circuit })) {
    return { action: 'hold', reason: 'risk_halt' };
  }

  const tech = analyzeMultiTimeframe(multiTf || { candles5m: candles, candles1h: candles, candles4h: candles });
  const lastClose = multiTf?.candles1h?.[multiTf.candles1h.length - 1]?.close || candles?.[candles.length - 1]?.close || 0;
  const sentiment = fuseSentiment({ social: events?.social, onchain: events?.onchain, market: events?.market, lastPrice: lastClose });

  // Strategy fusion: regime + performance weighting
  const atr1 = tech?.context?.atr?.['1h'] || 0;
  const atrPct = atr1 && lastClose ? atr1 / lastClose : 0;
  const ema9 = tech?.context?.ema?.['1h']?.ema9 || lastClose;
  const ema21 = tech?.context?.ema?.['1h']?.ema21 || lastClose;
  const emaSlope = (ema9 - ema21) / Math.max(1, lastClose);
  const regime = detectRegime({ atrPct, emaSlope, liquidityScore: events?.market?.orderbook ? 0.6 : 0.5 });

  const baseTechWeight = regime.trending ? 0.65 : 0.45;
  const baseSentWeight = 1 - baseTechWeight;
  const perfW = computePerfWeights(recentTrades || []);
  const techWeight = Math.min(0.8, Math.max(0.2, 0.5 * baseTechWeight + 0.5 * perfW.tech));
  const sentWeight = Math.min(0.8, Math.max(0.2, 0.5 * baseSentWeight + 0.5 * perfW.sentiment));
  const norm = techWeight + sentWeight || 1;

  const techBias = tech.action === 'BUY' ? 1 : tech.action === 'SELL' ? -1 : 0;
  const techStrength = tech.confidence || 0.5;
  const sentimentBias = (sentiment.score - 50) / 50; // -1..1

  const fused = (techBias * techStrength) * (techWeight / norm) + (sentimentBias) * (sentWeight / norm);
  let action = fused > 0.1 ? 'buy' : fused < -0.1 ? 'sell' : 'hold';
  let confidence = Math.min(0.99, Math.abs(fused));

  const conflict = (techBias > 0 && sentimentBias < -0.25) || (techBias < 0 && sentimentBias > 0.25);
  if (conflict && confidence < 0.25) {
    action = 'hold';
  } else if (conflict && confidence >= 0.25) {
    action = regime.trending ? (techBias > 0 ? 'buy' : 'sell') : (sentimentBias > 0 ? 'buy' : 'sell');
  }

  const accountEquityUsd = positions?.equityUsd || 10000;
  const notionalSize = positionSizeUsd({ accountEquityUsd, confidence, atrPct, maxRiskPctPerTrade: 0.02 });
  const sizeUsd = capOrderSizeUsd(notionalSize);

  const techSummary = summarizeTechnical(tech);
  const recentTradesText = Array.isArray(recentTrades) ? recentTrades.map((t, i) => `#${i+1} ${t.strategy||'n/a'} rr:${t.rr||'n/a'} pnl:${t.pnlUsd||'n/a'} ${t.success?'win':'loss'}`).join('\n') : 'N/A';
  const riskProfile = `regime: ${regime.trending ? 'trend' : 'range'} | vol:${(atrPct*100).toFixed(2)}% | equity:$${accountEquityUsd}`;
  const currentPositions = JSON.stringify(positions || {});
  const tradingPrompt = buildTradingPrompt({ token: symbol, technicalAnalysis: techSummary, sentimentScore: sentiment.score, riskProfile, currentPositions, recentTradesText });
  const llmDecision = await consultDeepSeek({ prompt: tradingPrompt });

  // Final decision gating: prefer LLM only if aligned with regime and not riskier
  if (llmDecision && llmDecision.action) {
    const llmBias = llmDecision.action === 'BUY' ? 1 : llmDecision.action === 'SELL' ? -1 : 0;
    const aligns = (action === 'buy' && llmBias > 0) || (action === 'sell' && llmBias < 0) || (action === 'hold' && llmBias === 0);
    const confOk = (llmDecision.confidence || 0) >= (confidence - 0.1);
    if ((aligns && confOk) || (llmDecision.confidence || 0) > confidence + 0.2) {
      action = llmDecision.action.toLowerCase();
      confidence = Math.max(confidence, llmDecision.confidence || 0);
      if (llmDecision.positionSizePct) {
        const llmSizeUsd = accountEquityUsd * (llmDecision.positionSizePct / 100);
        const sized = capOrderSizeUsd(llmSizeUsd);
        if (sized > 0) {
          // prefer smaller of heuristic vs llm sizing
          sizeUsd = Math.min(sizeUsd, sized);
        }
      }
    }
  }

  return {
    symbol,
    action,
    confidence,
    sizeUsd,
    regime,
    stops: computeStops(lastClose || 0, action === 'sell' ? 'sell' : 'buy', atr1),
    prompt: decisionPrompt({ symbol, tech, sentiment, positions }),
    tradingPrompt,
    llmDecision
  };
}

module.exports = { decideTrade };
