// ============================================================
// FAST RESPONDER - Immediate Acknowledgment Agent
// ============================================================
// Provides instant feedback to users before actual processing
// Eliminates the "stuck" feeling during long operations

/**
 * Quick response patterns - instant responses without API calls
 */
const QUICK_RESPONSES = {
  // Math patterns
  math: [
    /what is\s+(\d+)\s*[x*]\s*(\d+)/i,
    /(\d+)\s*[x*]\s*(\d+)\s*=*\?*/i,
    /calculate\s+(\d+)\s*[x*+\-\/]\s*(\d+)/i,
  ],
  // Greetings
  greeting: [
    /^(hi|hello|hey|yo|sup)/i,
    /what'?s\s+up/i,
  ],
  // Identity
  identity: [
    /who\s+are\s+you/i,
    /what\s+are\s+you/i,
    /your\s+name/i,
  ],
  // Time
  time: [
    /what\s+(time|day|date)\s+is\s+it/i,
    /current\s+(time|day|date)/i,
  ]
};

/**
 * Get instant acknowledgment message
 */
function getAcknowledgment(message) {
  const msg = message.toLowerCase().trim();

  // Detect intent and return appropriate acknowledgment
  if (QUICK_RESPONSES.math.some(pattern => pattern.test(message))) {
    return {
      text: "🔢 I'll calculate that for you...",
      intent: 'math',
      canAnswerInstantly: true
    };
  }

  if (QUICK_RESPONSES.greeting.some(pattern => pattern.test(message))) {
    return {
      text: "👋 Hey there!",
      intent: 'greeting',
      canAnswerInstantly: true
    };
  }

  if (QUICK_RESPONSES.identity.some(pattern => pattern.test(message))) {
    return {
      text: "🤖 I'm ClawdBot, your AI assistant!",
      intent: 'identity',
      canAnswerInstantly: true
    };
  }

  if (QUICK_RESPONSES.time.some(pattern => pattern.test(message))) {
    return {
      text: "🕐 Let me check the time for you...",
      intent: 'time',
      canAnswerInstantly: true
    };
  }

  // Default acknowledgment
  return {
    text: "⚡ Got it! Processing...",
    intent: 'general',
    canAnswerInstantly: false
  };
}

/**
 * Try to answer instantly without API call
 */
function tryInstantAnswer(message) {
  const msg = message.toLowerCase().trim();

  // Simple math: 2x2, 3*4, "what is 2x2", "calculate 5+3", etc.
  const mathMatch = message.match(/(\d+)\s*([x*+\-\/])\s*(\d+)/);
  if (mathMatch && message.length < 50) {
    const a = parseInt(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseInt(mathMatch[3]);
    let result;

    // Only handle simple math with small numbers
    if (a < 1000 && b < 1000) {
      switch (op) {
        case 'x':
        case '*':
          result = a * b;
          return {
            answered: true,
            text: `${a} × ${b} = ${result}`
          };
        case '+':
          result = a + b;
          return {
            answered: true,
            text: `${a} + ${b} = ${result}`
          };
        case '-':
          result = a - b;
          return {
            answered: true,
            text: `${a} - ${b} = ${result}`
          };
        case '/':
          if (b !== 0 && a % b === 0) {
            result = a / b;
            return {
              answered: true,
              text: `${a} ÷ ${b} = ${result}`
            };
          }
          break;
      }
    }
  }

  // Greetings
  if (/^(hi|hello|hey|yo|sup)/i.test(msg)) {
    const greetings = [
      "Hello! How can I help you today?",
      "Hey! What can I do for you?",
      "Hi there! Ready to assist!",
    ];
    return {
      answered: true,
      text: greetings[Math.floor(Math.random() * greetings.length)]
    };
  }

  // Identity
  if (/who\s+are\s+you|what\s+are\s+you|your\s+name/i.test(msg)) {
    return {
      answered: true,
      text: "I'm ClawdBot v4.0, your AI-powered assistant! I can help with code, research, docker management, and more."
    };
  }

  // Time
  if (/what\s+(time|day|date)\s+is\s+it|current\s+(time|day|date)/i.test(msg)) {
    const now = new Date();
    return {
      answered: true,
      text: `📅 ${now.toLocaleDateString()} | 🕐 ${now.toLocaleTimeString()}`
    };
  }

  // Check for docker environment questions
  if (/docker|container/i.test(msg) && /inside|running/i.test(msg)) {
    return {
      answered: true,
      text: "🐳 Yes, I'm running inside a Docker container! I have access to Docker management capabilities."
    };
  }

  return {
    answered: false,
    text: null
  };
}

/**
 * Get status update message based on intent
 */
function getStatusUpdate(intent, progress = 0) {
  const updates = {
    math: ["🔢 Calculating...", "🔢 Almost done..."],
    greeting: ["👋", "✨"],
    identity: ["🤖", "✨"],
    time: ["🕐", "✨"],
    general: ["⚙️ Processing...", "🔄 Working on it...", "📝 Thinking..."]
  };

  const options = updates[intent] || updates.general;
  return options[Math.min(Math.floor(progress / 25), options.length - 1)];
}

module.exports = {
  getAcknowledgment,
  tryInstantAnswer,
  getStatusUpdate,
  QUICK_RESPONSES
};
