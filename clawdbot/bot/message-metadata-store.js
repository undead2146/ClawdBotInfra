// ============================================================
// MESSAGE METADATA STORE - Store message metadata for reaction handling
// ============================================================

/**
 * MessageMetadataStore - Stores metadata for bot messages to enable reaction handling
 */
class MessageMetadataStore {
  constructor() {
    // messageId -> metadata
    this.messages = new Map();

    // Cleanup interval (1 hour default)
    this.cleanupIntervalMs = 3600000;
    this.defaultRetentionMs = 3600000; // Keep metadata for 1 hour

    // Start automatic cleanup
    this._startCleanup();
  }

  /**
   * Store metadata for a message
   */
  store(messageId, metadata) {
    if (!messageId) {
      console.warn('[MessageMetadataStore] Cannot store metadata without messageId');
      return false;
    }

    const record = {
      ...metadata,
      createdAt: Date.now(),
      expiresAt: Date.now() + (metadata.retentionMs || this.defaultRetentionMs)
    };

    this.messages.set(String(messageId), record);

    console.log(`[MessageMetadataStore] Stored metadata for message ${messageId}`);
    return true;
  }

  /**
   * Get metadata for a message
   */
  get(messageId) {
    const record = this.messages.get(String(messageId));

    if (!record) {
      console.debug(`[MessageMetadataStore] No metadata found for message ${messageId}`);
      return null;
    }

    // Check if expired
    if (Date.now() > record.expiresAt) {
      this.messages.delete(String(messageId));
      console.debug(`[MessageMetadataStore] Metadata expired for message ${messageId}`);
      return null;
    }

    return record;
  }

  /**
   * Update metadata for a message
   */
  update(messageId, updates) {
    const record = this.messages.get(String(messageId));

    if (!record) {
      console.warn(`[MessageMetadataStore] Cannot update non-existent message ${messageId}`);
      return false;
    }

    this.messages.set(String(messageId), {
      ...record,
      ...updates,
      // Preserve timestamps
      createdAt: record.createdAt,
      expiresAt: record.expiresAt
    });

    return true;
  }

  /**
   * Delete metadata for a message
   */
  delete(messageId) {
    return this.messages.delete(String(messageId));
  }

  /**
   * Clean up old metadata entries
   */
  cleanup(olderThanMs = null) {
    const now = Date.now();
    const threshold = olderThanMs || this.defaultRetentionMs;
    let cleaned = 0;

    for (const [messageId, record] of this.messages.entries()) {
      if (now - record.createdAt > threshold || now > record.expiresAt) {
        this.messages.delete(messageId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[MessageMetadataStore] Cleaned up ${cleaned} expired metadata entries`);
    }

    return cleaned;
  }

  /**
   * Get statistics about the store
   */
  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const record of this.messages.values()) {
      if (now > record.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.messages.size,
      active,
      expired
    };
  }

  /**
   * Start automatic cleanup interval
   */
  _startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Don't block process exit
    this.cleanupTimer.unref();
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clear all metadata (useful for testing)
   */
  clear() {
    this.messages.clear();
    console.log('[MessageMetadataStore] Cleared all metadata');
  }
}

// Singleton instance
let storeInstance = null;

/**
 * Get or create the singleton instance
 */
function getInstance() {
  if (!storeInstance) {
    storeInstance = new MessageMetadataStore();
  }
  return storeInstance;
}

module.exports = {
  MessageMetadataStore,
  getInstance
};
