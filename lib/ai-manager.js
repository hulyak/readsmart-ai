import { CONTENT_LIMITS, RATE_LIMITS, DEBUG } from './config-module.js';

// Rate limiter class to prevent API quota exhaustion
class RateLimiter {
  constructor(maxRequestsPerMinute, maxConcurrentRequests) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.requestTimestamps = [];
    this.activeRequests = 0;
  }

  // Check if a request can be made
  canMakeRequest() {
    // Clean old timestamps (older than 1 minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);

    // Check rate limits
    const withinRateLimit = this.requestTimestamps.length < this.maxRequestsPerMinute;
    const withinConcurrencyLimit = this.activeRequests < this.maxConcurrentRequests;

    return withinRateLimit && withinConcurrencyLimit;
  }

  // Wait until rate limit allows a request
  async waitForSlot() {
    while (!this.canMakeRequest()) {
      if (DEBUG.enabled) console.log('[ReadSmart] Rate limit reached, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Track a new request
  trackRequest() {
    this.requestTimestamps.push(Date.now());
    this.activeRequests++;
  }

  // Mark request as complete
  completeRequest() {
    this.activeRequests--;
  }

  // Get current usage stats
  getStats() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > oneMinuteAgo);

    return {
      requestsInLastMinute: this.requestTimestamps.length,
      activeRequests: this.activeRequests,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      maxConcurrentRequests: this.maxConcurrentRequests
    };
  }
}

class AIManager {
  constructor() {
    this.promptSession = null;
    this.summarizer = null;
    this.translator = null;
    this.proofreader = null;
    this.isInitialized = false;
    this.apiAvailability = {
      languageModel: false,
      summarizer: false,
      translator: false,
      proofreader: false
    };
    // Initialize rate limiter
    this.rateLimiter = new RateLimiter(
      RATE_LIMITS.maxRequestsPerMinute,
      RATE_LIMITS.maxConcurrentRequests
    );
  }

  // Initialize and check API availability
  async initialize() {
    if (this.isInitialized) return;

    if (DEBUG.logInfo) console.log('[ReadSmart] Initializing AI Manager...');

    // Log Chrome version for debugging
    const userAgent = navigator.userAgent;
    const chromeVersionMatch = userAgent.match(/Chrome\/(\d+)/);
    const chromeVersion = chromeVersionMatch ? parseInt(chromeVersionMatch[1]) : 'unknown';

    if (DEBUG.enabled) console.log('[ReadSmart] Chrome version:', chromeVersion);


    if (typeof chromeVersion === 'number' && chromeVersion < 128) {
      if (DEBUG.logInfo) {
        console.warn('[ReadSmart] ⚠️ Chrome version', chromeVersion, 'detected. Chrome AI requires version 128 or later.');
      }
    }

    try {
      // Check Language Model (Prompt API)
      if ('LanguageModel' in self) {
        try {
          const availability = await LanguageModel.availability();
          this.apiAvailability.languageModel = availability !== 'no';
          if (DEBUG.enabled) console.log('[ReadSmart] LanguageModel availability:', availability);
          if (availability === 'no' && DEBUG.logInfo) {
            console.warn('[ReadSmart] LanguageModel is not available. Check chrome://flags/#prompt-api-for-gemini-nano');
          }
        } catch (e) {
          if (DEBUG.logErrors) console.warn('[ReadSmart] LanguageModel check failed:', e);
        }
      } else {
        if (DEBUG.logInfo) {
          console.warn('[ReadSmart] ⚠️ LanguageModel API not found. This API is required for Q&A features.');
          console.warn('[ReadSmart] Make sure you are using Chrome 128+ and have enabled the required flags.');
        }
      }

      // Check Summarizer API
      if ('Summarizer' in self) {
        try {
          const availability = await Summarizer.availability();
          this.apiAvailability.summarizer = availability !== 'no';
          if (DEBUG.enabled) console.log('[ReadSmart] Summarizer availability:', availability);
          if (availability === 'no' && DEBUG.logInfo) {
            console.warn('[ReadSmart] Summarizer is not available. Check chrome://flags/#summarization-api-for-gemini-nano');
          } else if (availability === 'after-download' && DEBUG.logInfo) {
            console.log('[ReadSmart] ⏳ Summarizer will be available after model download. Check chrome://components/');
          }
        } catch (e) {
          if (DEBUG.logErrors) console.warn('[ReadSmart] Summarizer check failed:', e);
        }
      } else {
        if (DEBUG.logInfo) {
          console.warn('[ReadSmart] ⚠️ Summarizer API not found. This API is required for summarization.');
          console.warn('[ReadSmart] Make sure you are using Chrome 128+ and have enabled the required flags.');
        }
      }

      // Check Translator API
      if ('Translator' in self) {
        try {
          // Check availability for English to Spanish (common pair)
          const availability = await Translator.availability({
            sourceLanguage: 'en',
            targetLanguage: 'es'
          });
          this.apiAvailability.translator = (availability === 'available' || availability === 'downloadable');
          if (DEBUG.enabled) console.log('[ReadSmart] Translator availability:', availability);
        } catch (e) {
          if (DEBUG.logErrors) console.warn('[ReadSmart] Translator check failed:', e);
          this.apiAvailability.translator = false;
        }
      } else {
        if (DEBUG.enabled) console.warn('[ReadSmart] Translator not found in global scope');
        this.apiAvailability.translator = false;
      }

      // Check Proofreader API
      if ('Proofreader' in self) {
        try {
          const availability = await Proofreader.availability();
          this.apiAvailability.proofreader = availability !== 'no';
          if (DEBUG.enabled) console.log('[ReadSmart] Proofreader availability:', availability);
        } catch (e) {
          if (DEBUG.logErrors) console.warn('[ReadSmart] Proofreader check failed:', e);
        }
      } else {
        if (DEBUG.enabled) console.warn('[ReadSmart] Proofreader not found in global scope');
      }

      // Initialize Prompt API session for Q&A if available
      if (this.apiAvailability.languageModel) {
        try {
          if (DEBUG.enabled) console.log('[ReadSmart] Creating Prompt API session for Q&A...');
          this.promptSession = await LanguageModel.create({
            systemPrompt: `You are a helpful reading assistant. Answer questions about article content concisely and clearly. Keep answers brief and to the point.`
          });
          if (DEBUG.enabled) console.log('[ReadSmart] Prompt API session created successfully');
        } catch (e) {
          if (DEBUG.logErrors) console.warn('[ReadSmart] Failed to create prompt session:', e);
          this.promptSession = null;
        }
      }

      this.isInitialized = true;
      if (DEBUG.logInfo) {
        console.log('[ReadSmart] AI Manager initialized successfully');
        console.log('[ReadSmart] API Availability:', this.apiAvailability);
      }

      // Show helpful message if no APIs available
      if (Object.values(this.apiAvailability).every(v => !v)) {
        console.error('[ReadSmart] ❌ No AI APIs available!');
        console.error('[ReadSmart] 📋 Required Chrome flags:');
        console.error('  1. chrome://flags/#optimization-guide-on-device-model → Enabled BypassPerfRequirement');
        console.error('  2. chrome://flags/#prompt-api-for-gemini-nano → Enabled');
        console.error('  3. chrome://flags/#summarization-api-for-gemini-nano → Enabled');
        console.error('[ReadSmart] 🔄 Restart Chrome after enabling flags');
        console.error('[ReadSmart] 📥 Wait for model download at chrome://components');
        console.error('[ReadSmart] ⚠️ If you cannot find "Optimization Guide On Device Model" in chrome://components:');
        console.error('  - You may be using an older Chrome version (need v128+)');
        console.error('  - Chrome AI features may not be available in your region yet');
        console.error('  - Try Dev channel');
      }

    } catch (error) {
      console.error('[ReadSmart] Error initializing AI Manager:', error);
    }
  }

  // Summarize content
  async summarizeContent(content, type = 'key-points', length = 'medium') {
    if (!this.apiAvailability.summarizer) {
      throw new Error('❌ Chrome AI Summarizer not available.\n\n' +
        '🔧 Setup Instructions:\n' +
        '1. Update Chrome to version 128 or later\n' +
        '2. Enable: chrome://flags/#optimization-guide-on-device-model\n' +
        '3. Enable: chrome://flags/#summarization-api-for-gemini-nano\n' +
        '4. Restart Chrome completely\n' +
        '5. Visit chrome://components/ and update "Optimization Guide On Device Model"\n\n' +
        '⚠️ If the component is not listed, Chrome AI may not be available in your region or Chrome version.');
    }

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();
    this.rateLimiter.trackRequest();

    try {
      // Destroy old summarizer if exists
      if (this.summarizer) {
        try {
          this.summarizer.destroy();
        } catch (e) {
          if (DEBUG.logErrors) console.warn('[ReadSmart] Error destroying old summarizer:', e);
        }
        this.summarizer = null;
      }

      // Map user-facing type names to API enum values
      const typeMapping = {
        'tl;dr': 'tldr',
        'key-points': 'key-points',
        'teaser': 'teaser',
        'headline': 'headline'
      };

      const apiType = typeMapping[type] || 'key-points';

      if (DEBUG.enabled) console.log('[ReadSmart] Creating summarizer with:', { type: apiType, length });

      this.summarizer = await Summarizer.create({
        type: apiType,
        format: 'plain-text',
        length: length
      });

      // Truncate content to avoid QuotaExceededError
      // Summarizer API has limits on input size (~4000 tokens or ~16000 chars)
      const truncatedContent = content.length > CONTENT_LIMITS.MAX_AI_INPUT
        ? content.substring(0, CONTENT_LIMITS.MAX_AI_INPUT) + '...'
        : content;

      if (content.length > CONTENT_LIMITS.MAX_AI_INPUT && DEBUG.enabled) {
        console.log('[ReadSmart] Content truncated from', content.length, 'to', CONTENT_LIMITS.MAX_AI_INPUT, 'chars');
      }

      if (DEBUG.enabled) console.log('[ReadSmart] Calling summarizer.summarize()...');
      const summary = await this.summarizer.summarize(truncatedContent);
      if (DEBUG.logInfo) console.log('[ReadSmart] ✅ Summary generated successfully');
      return summary;

    } catch (error) {
      // Properly log DOMException and other error types
      console.error('[ReadSmart] Error summarizing:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });

      // Check for model crash error
      if (error.message && error.message.includes('crashed')) {
        throw new Error('⚠️ Chrome AI model has crashed. Please restart Chrome and go to chrome://components/ to update the "Optimization Guide On Device Model"');
      }

      // Check for NotAllowedError (model blocked or insufficient space)
      if (error.name === 'NotAllowedError') {
        // Check if it's a space issue
        if (error.message && error.message.includes('not have enough space')) {
          throw new Error('⚠️ Not enough storage space for Chrome AI model. Please free up some disk space and try again. You need at least 2-3GB of free space.');
        }
        // Otherwise it's likely a crash/block issue
        throw new Error('⚠️ Chrome AI model is blocked due to crashes. Please: 1) Completely quit Chrome, 2) Restart your computer, 3) Go to chrome://components/ and update the AI model');
      }

      throw new Error('Failed to generate summary: ' + error.message);
    } finally {
      this.rateLimiter.completeRequest();
    }
  }

  // Translate content
  async translateContent(content, targetLanguage = 'en', sourceLanguage = 'en') {
    if (!this.apiAvailability.translator) {
      throw new Error('Translator API not available');
    }

    // Check if source and target are the same
    if (sourceLanguage === targetLanguage) {
      if (DEBUG.enabled) console.log('[ReadSmart] Source and target languages are the same, skipping translation');
      return content; // Return original content unchanged
    }

    // Wait for rate limit slot
    await this.rateLimiter.waitForSlot();
    this.rateLimiter.trackRequest();

    try {
      // Check availability for this specific language pair
      const availability = await Translator.availability({
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      });

      if (DEBUG.enabled) console.log('[ReadSmart] Translation availability for', sourceLanguage, '→', targetLanguage, ':', availability);

      if (availability === 'unavailable') {
        throw new Error(`Translation from ${sourceLanguage} to ${targetLanguage} is not supported`);
      }

      // Destroy old translator if exists
      if (this.translator) {
        this.translator.destroy();
      }

      // Create new translator with download monitoring
      if (DEBUG.enabled) console.log('[ReadSmart] Creating translator for', sourceLanguage, '→', targetLanguage);

      this.translator = await Translator.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            if (DEBUG.logInfo) console.log(`[ReadSmart] Translation model download: ${Math.round(e.loaded * 100)}%`);
          });
        }
      });

      if (DEBUG.enabled) console.log('[ReadSmart] Translator created, translating content...');

      // Use translate() method
      const translated = await this.translator.translate(content);

      if (DEBUG.logInfo) console.log('[ReadSmart] Translation completed');
      return translated;

    } catch (error) {
      // Properly log DOMException and other error types
      console.error('[ReadSmart] Error translating:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error; // Re-throw so background.js can handle it
    } finally {
      this.rateLimiter.completeRequest();
    }
  }

  // Proofread content for grammar and spelling errors
  async proofreadContent(content) {
    if (!this.apiAvailability.proofreader) {
      return null;
    }

    try {
      // Destroy old proofreader if exists
      if (this.proofreader) {
        this.proofreader.destroy();
      }

      // Create new proofreader
      this.proofreader = await Proofreader.create({
        expectedInputLanguages: ['en']
      });

      // Use proofread() method
      const proofreadResult = await this.proofreader.proofread(content);

      if (DEBUG.enabled) console.log('[ReadSmart] Proofreading found:', proofreadResult);

      return proofreadResult;

    } catch (error) {
      // Properly log DOMException and other error types
      console.error('[ReadSmart] Error proofreading:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return null;
    }
  }

  // Ensure prompt session is available (recreate if destroyed)
  async ensurePromptSession() {
    // Check if session exists and is valid
    if (this.promptSession) {
      try {
        // Test if session is still valid by checking a property
        // If the session was destroyed, accessing it might throw
        return this.promptSession;
      } catch (e) {
        if (DEBUG.enabled) console.warn('[ReadSmart] Prompt session was destroyed, recreating...');
        this.promptSession = null;
      }
    }

    // Create new session
    if (this.apiAvailability.languageModel) {
      try {
        if (DEBUG.enabled) console.log('[ReadSmart] Creating new Prompt API session...');
        this.promptSession = await LanguageModel.create({
          systemPrompt: `You are a helpful reading assistant. Answer questions about article content concisely and clearly. Keep answers brief and to the point.`
        });
        if (DEBUG.enabled) console.log('[ReadSmart] Prompt API session created successfully');
        return this.promptSession;
      } catch (e) {
        // Properly log DOMException and other error types
        console.error('[ReadSmart] Failed to create prompt session:', {
          name: e.name,
          message: e.message,
          code: e.code,
          stack: e.stack
        });

        // Check for model crash
        if (e.message && e.message.includes('crashed')) {
          throw new Error('⚠️ Chrome AI model has crashed. Please restart Chrome completely and go to chrome://components/ to update the AI model');
        }

        // Check for NotAllowedError
        if (e.name === 'NotAllowedError') {
          // Check if it's a space issue
          if (e.message && e.message.includes('not have enough space')) {
            throw new Error('⚠️ Not enough storage space for Chrome AI model. Please free up at least 2-3GB of disk space and try again.');
          }
          // Otherwise it's likely a crash/block issue
          throw new Error('⚠️ Chrome AI is blocked due to crashes. FIX: Completely quit Chrome (Cmd+Q), restart your Mac, then go to chrome://components/ and click "Check for update" on Optimization Guide');
        }

        throw new Error('Could not create AI session: ' + e.message);
      }
    } else {
      throw new Error('Language Model API not available');
    }
  }

  // Get rate limiter stats
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }

  // Clean up resources
  destroy() {
    if (this.promptSession) {
      this.promptSession.destroy();
      this.promptSession = null;
    }
    if (this.summarizer) {
      this.summarizer.destroy();
      this.summarizer = null;
    }
    if (this.translator) {
      this.translator.destroy();
      this.translator = null;
    }
    if (this.proofreader) {
      this.proofreader.destroy();
      this.proofreader = null;
    }
  }
}

// Export for use in ES6 modules (Chrome extension service workers)
export { AIManager };

// Also support CommonJS for backwards compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIManager;
}
