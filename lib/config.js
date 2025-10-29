// ReadSmart AI - Centralized Configuration
// All timeouts, limits, and settings in one place

const CONFIG = {
  // Debug mode - set to false in production to reduce console noise
  DEBUG: {
    // Enable verbose logging (set to false for production)
    enabled: false,

    // Always log errors even if debug is disabled
    logErrors: true,

    // Log initialization and major events (set to false for production)
    logInfo: false
  },

  // Content length limits for AI processing
  CONTENT_LIMITS: {
    // Maximum content sent to summarizer (reduced to prevent QuotaExceededError)
    SUMMARY: 5000,

    // Maximum content for Q&A context window
    QA_CONTEXT: 3000,

    // Maximum content for generating suggested questions (reduced for faster response)
    QUESTIONS_GEN: 2500,

    // Minimum article length to show ReadSmart button
    MIN_ARTICLE: 500,

    // Minimum content length for batch processing
    MIN_BATCH_CONTENT: 100,

    // Hard limit for AI Manager truncation (to prevent API quota errors)
    MAX_AI_INPUT: 15000
  },

  // Timeout values (in milliseconds)
  TIMEOUTS: {
    // Timeout for summarization requests
    SUMMARIZE: 30000, // 30 seconds

    // Timeout for Q&A requests
    QA: 30000, // 30 seconds

    // Timeout for question generation
    QUESTIONS_GEN: 45000, // 45 seconds

    // Timeout for translation requests
    TRANSLATE: 30000, // 30 seconds

    // Timeout for context menu operations
    CONTEXT_MENU: 25000, // 25 seconds

    // Timeout for mutation observer (prevent memory leaks)
    MUTATION_OBSERVER: 15000 // 15 seconds
  },

  // Article detection settings
  DETECTION: {
    // Wait before initial detection attempt
    buttonDelay: 1000, // 1 second

    // Maximum retry attempts for dynamic content
    maxRetries: 5,

    // Interval between retry attempts
    retryInterval: 1000, // 1 second

    // Auto-detect articles on page load
    autoDetect: true,

    // Show button immediately when article detected
    showOnLoad: true
  },

  // Rate limiting settings
  RATE_LIMITS: {
    // Maximum API requests per minute
    maxRequestsPerMinute: 20,

    // Maximum concurrent requests
    maxConcurrentRequests: 3,

    // Cooldown period after hitting rate limit (ms)
    cooldownPeriod: 60000 // 1 minute
  },

  // Statistics tracking
  STATS: {
    // Auto-save interval for statistics
    saveInterval: 60000, // 1 minute

    // Estimated minutes saved per summary
    timeSavedPerSummary: 4
  }
};

// Export individual sections for convenience
const DEBUG = CONFIG.DEBUG;
const CONTENT_LIMITS = CONFIG.CONTENT_LIMITS;
const TIMEOUTS = CONFIG.TIMEOUTS;
const DETECTION = CONFIG.DETECTION;
const RATE_LIMITS = CONFIG.RATE_LIMITS;
const STATS = CONFIG.STATS;

// Set as browser globals for content scripts
if (typeof window !== 'undefined') {
  window.READSMART_CONFIG = CONFIG;
  window.READSMART_DEBUG = DEBUG;
  window.READSMART_CONTENT_LIMITS = CONTENT_LIMITS;
  window.READSMART_TIMEOUTS = TIMEOUTS;
  window.READSMART_DETECTION = DETECTION;
  window.READSMART_RATE_LIMITS = RATE_LIMITS;
  window.READSMART_STATS = STATS;
  if (DEBUG.logInfo) {
    console.log('[ReadSmart Config] Configuration loaded');
  }
}

// For ES6 modules (service workers) - use config-module.js instead
// This file is for content scripts only
