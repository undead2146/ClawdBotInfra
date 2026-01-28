// ============================================================
// SESSION PERSISTENCE STORE
// ============================================================
// File-based persistence for chat sessions
// Stores conversation history across bot restarts

const fs = require('fs').promises;
const path = require('path');

// Path to session storage file - use /tmp in Docker for writability
const BASE_DIR = process.env.WORKSPACE || '/tmp';
const SESSION_FILE = path.join(BASE_DIR, 'clawdbot-sessions.json');
const BACKUP_FILE = path.join(BASE_DIR, 'clawdbot-sessions.backup.json');

// In-memory cache of sessions
let sessionsCache = new Map();
let lastSaveTime = 0;
const SAVE_INTERVAL = 60000; // Auto-save every 60 seconds

/**
 * Initialize the session store by loading from disk
 */
async function init() {
  try {
    await loadSessions();
    console.log(`[SessionStore] Initialized with ${sessionsCache.size} sessions`);
    return sessionsCache.size;
  } catch (error) {
    console.error(`[SessionStore] Init failed: ${error.message}`);
    // Start with empty sessions if file doesn't exist
    sessionsCache = new Map();
    return 0;
  }
}

/**
 * Load sessions from disk
 */
async function loadSessions() {
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf8');
    const parsed = JSON.parse(data);

    sessionsCache = new Map();

    for (const [userId, sessionData] of Object.entries(parsed)) {
      // Convert plain object back to Map-like structure
      sessionsCache.set(userId, {
        history: sessionData.history || [],
        context: sessionData.context || {},
        turnCount: sessionData.turnCount || 0,
        lastActive: sessionData.lastActive || new Date().toISOString()
      });
    }

    console.log(`[SessionStore] Loaded ${sessionsCache.size} sessions from disk`);
    return sessionsCache;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[SessionStore] No existing sessions file, starting fresh');
      sessionsCache = new Map();
      return sessionsCache;
    }
    throw error;
  }
}

/**
 * Save sessions to disk
 */
async function saveSessions() {
  try {
    // Create backup of existing file
    try {
      await fs.copyFile(SESSION_FILE, BACKUP_FILE);
    } catch (backupError) {
      // Backup might fail if file doesn't exist yet, that's ok
      if (backupError.code !== 'ENOENT') {
        console.warn(`[SessionStore] Backup failed: ${backupError.message}`);
      }
    }

    // Convert Map to plain object for JSON serialization
    const plainObject = {};
    for (const [userId, sessionData] of sessionsCache.entries()) {
      plainObject[userId] = sessionData;
    }

    const json = JSON.stringify(plainObject, null, 2);
    await fs.writeFile(SESSION_FILE, json, 'utf8');

    lastSaveTime = Date.now();
    console.log(`[SessionStore] Saved ${sessionsCache.size} sessions to disk`);
  } catch (error) {
    console.error(`[SessionStore] Save failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get a session by user ID
 */
function getSession(userId) {
  return sessionsCache.get(userId);
}

/**
 * Set/update a session
 */
function setSession(userId, sessionData) {
  sessionsCache.set(userId, {
    ...sessionData,
    lastActive: new Date().toISOString()
  });
}

/**
 * Delete a session
 */
function deleteSession(userId) {
  const deleted = sessionsCache.delete(userId);
  if (deleted) {
    console.log(`[SessionStore] Deleted session for user ${userId}`);
  }
  return deleted;
}

/**
 * Get all sessions
 */
function getAllSessions() {
  return new Map(sessionsCache);
}

/**
 * Clear all sessions
 */
function clearAllSessions() {
  const count = sessionsCache.size;
  sessionsCache.clear();
  console.log(`[SessionStore] Cleared ${count} sessions`);
  return count;
}

/**
 * Get session count
 */
function getSessionCount() {
  return sessionsCache.size;
}

/**
 * Auto-save timer - periodically saves sessions
 */
function startAutoSave(intervalMs = SAVE_INTERVAL) {
  setInterval(async () => {
    if (sessionsCache.size > 0) {
      try {
        await saveSessions();
      } catch (error) {
        console.error(`[SessionStore] Auto-save failed: ${error.message}`);
      }
    }
  }, intervalMs);

  console.log(`[SessionStore] Auto-save enabled (${intervalMs}ms interval)`);
}

/**
 * Clean up old sessions (optional)
 * Remove sessions inactive for more than specified days
 */
function cleanupOldSessions(daysOld = 7) {
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  let cleaned = 0;

  for (const [userId, sessionData] of sessionsCache.entries()) {
    const lastActive = new Date(sessionData.lastActive || 0).getTime();
    if (lastActive < cutoff) {
      sessionsCache.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[SessionStore] Cleaned up ${cleaned} old sessions`);
  }

  return cleaned;
}

module.exports = {
  init,
  loadSessions,
  saveSessions,
  getSession,
  setSession,
  deleteSession,
  getAllSessions,
  clearAllSessions,
  getSessionCount,
  startAutoSave,
  cleanupOldSessions
};
