// ============================================================
// METRICS COLLECTOR - Centralized timing metrics collection
// ============================================================

/**
 * MetricsCollector - Tracks timing and flow metadata throughout message processing
 */
class MetricsCollector {
  constructor(messageId, userMessage = '') {
    this.messageId = messageId;
    this.userMessage = userMessage;

    // Timing data - records when each step occurred
    this.timings = {
      receivedAt: null,          // When bot receives message from Telegram
      fastPathCheck: null,       // After fast path check completes
      acknowledgmentSent: null,  // When acknowledgment message is sent
      orchestratorStart: null,   // When orchestrator starts processing
      orchestratorEnd: null,     // When orchestrator completes
      skillDetection: null,      // After skill detection completes
      modelSelection: null,      // After model selection completes
      promptBuilding: null,      // After specialized prompt is built
      apiCallStart: null,        // Before HTTP request to proxy
      apiCallEnd: null,          // After HTTP response received
      responseFormatStart: null, // Before response formatting
      responseFormatEnd: null,   // After response formatting
      responseSent: null         // When response is sent to Telegram
    };

    // Flow metadata - what was used
    this.flow = {
      skill: null,               // Skill that was detected
      model: null,               // Model that was chosen
      modelExplanation: null,    // Why this model was chosen
      complexityScore: null,     // Task complexity score
      confidence: null,          // Skill detection confidence
      agent: 'orchestrator',     // Main agent used
      subAgents: [],             // Any sub-agents or skills invoked
      hasError: false,           // Whether any error occurred
      errorMessage: null         // Error message if any
    };

    // Initial timestamp
    this.mark('receivedAt');
  }

  /**
   * Mark a timing checkpoint
   */
  mark(event) {
    if (this.timings.hasOwnProperty(event)) {
      this.timings[event] = Date.now();
    } else {
      console.warn(`[MetricsCollector] Unknown timing event: ${event}`);
    }
  }

  /**
   * Set flow metadata
   */
  setFlow(key, value) {
    if (this.flow.hasOwnProperty(key)) {
      this.flow[key] = value;
    } else if (key === 'subAgent') {
      // Add sub-agent to the list
      this.flow.subAgents.push(value);
    } else {
      console.warn(`[MetricsCollector] Unknown flow key: ${key}`);
    }
  }

  /**
   * Mark that an error occurred
   */
  markError(error) {
    this.flow.hasError = true;
    this.flow.errorMessage = error.message || String(error);
  }

  /**
   * Calculate duration between two timing points
   */
  getDuration(startEvent, endEvent) {
    const start = this.timings[startEvent];
    const end = this.timings[endEvent];

    if (!start || !end) {
      return null;
    }

    return end - start;
  }

  /**
   * Get detailed timing breakdown
   */
  getBreakdown() {
    const now = Date.now();

    // Calculate each segment duration
    const fastPathDuration = this.getDuration('receivedAt', 'fastPathCheck');
    const acknowledgmentDuration = this.getDuration('fastPathCheck', 'acknowledgmentSent');
    const preOrchestratorDuration = this.getDuration('acknowledgmentSent', 'orchestratorStart');
    const skillDetectionDuration = this.getDuration('orchestratorStart', 'skillDetection');
    const modelSelectionDuration = this.getDuration('skillDetection', 'modelSelection');
    const promptBuildingDuration = this.getDuration('modelSelection', 'promptBuilding');
    const apiCallDuration = this.getDuration('apiCallStart', 'apiCallEnd');
    const formattingDuration = this.getDuration('responseFormatStart', 'responseFormatEnd');
    const postProcessingDuration = this.getDuration('responseFormatEnd', 'responseSent');

    // Total processing time
    const totalTime = this.timings.responseSent
      ? this.timings.responseSent - this.timings.receivedAt
      : now - this.timings.receivedAt;

    // Orchestrator time (from start to API call end)
    const orchestratorTime = this.timings.apiCallEnd
      ? this.timings.apiCallEnd - this.timings.orchestratorStart
      : null;

    return {
      // Absolute timestamps
      timestamps: { ...this.timings },

      // Segment durations
      fastPathCheck: fastPathDuration,
      acknowledgment: acknowledgmentDuration,
      preOrchestrator: preOrchestratorDuration,
      skillDetection: skillDetectionDuration,
      modelSelection: modelSelectionDuration,
      promptBuilding: promptBuildingDuration,
      apiCall: apiCallDuration,
      formatting: formattingDuration,
      postProcessing: postProcessingDuration,

      // Aggregated times
      orchestrator: orchestratorTime,
      total: totalTime,

      // Flow metadata
      flow: { ...this.flow }
    };
  }

  /**
   * Get a one-line summary of metrics
   */
  getSummary() {
    const breakdown = this.getBreakdown();
    const now = Date.now();
    const totalTime = breakdown.total || (now - this.timings.receivedAt);

    return {
      totalTime,
      model: this.flow.model,
      skill: this.flow.skill,
      hasError: this.flow.hasError
    };
  }

  /**
   * Get formatted timing string for display
   */
  getTimingString(verbosity = 'medium') {
    const breakdown = this.getBreakdown();

    if (verbosity === 'minimal') {
      return `${breakdown.total}ms`;
    }

    if (verbosity === 'medium') {
      const parts = [];
      if (breakdown.apiCall) parts.push(`API: ${breakdown.apiCall}ms`);
      parts.push(`Total: ${breakdown.total}ms`);
      return parts.join(' | ');
    }

    // Full verbosity
    const lines = [];
    lines.push(`⏱️ **Timing Breakdown**`);
    lines.push(`Total: ${breakdown.total}ms`);

    if (breakdown.fastPathCheck) {
      lines.push(`├─ Fast Path Check: ${breakdown.fastPathCheck}ms`);
    }
    if (breakdown.acknowledgment) {
      lines.push(`├─ Acknowledgment: ${breakdown.acknowledgment}ms`);
    }
    if (breakdown.skillDetection) {
      lines.push(`├─ Skill Detection: ${breakdown.skillDetection}ms`);
    }
    if (breakdown.modelSelection) {
      lines.push(`├─ Model Selection: ${breakdown.modelSelection}ms`);
    }
    if (breakdown.promptBuilding) {
      lines.push(`├─ Prompt Building: ${breakdown.promptBuilding}ms`);
    }
    if (breakdown.apiCall) {
      lines.push(`├─ API Call: ${breakdown.apiCall}ms`);
    }
    if (breakdown.formatting) {
      lines.push(`├─ Formatting: ${breakdown.formatting}ms`);
    }
    if (breakdown.postProcessing) {
      lines.push(`└─ Post-Processing: ${breakdown.postProcessing}ms`);
    }

    return lines.join('\n');
  }

  /**
   * Check if metrics collection is complete
   */
  isComplete() {
    return !!this.timings.responseSent;
  }
}

module.exports = MetricsCollector;
