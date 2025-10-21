'use strict';

const decisionPrompt = ({ symbol, tech, sentiment, positions }) => `
You are Quantum Vibe Trader AI. Decide trade for ${symbol}.
Technical signal: ${JSON.stringify(tech)}
Sentiment: ${JSON.stringify(sentiment)}
Positions: ${JSON.stringify(positions)}
Respond strictly as JSON: {"action":"buy|sell|hold","confidence":0..1}
`;

module.exports = { decisionPrompt };
