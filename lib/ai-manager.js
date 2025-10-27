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
  }

  // Initialize and check API availability
  async initialize() {
    if (this.isInitialized) return;

    console.log('[ReadSmart] Initializing AI Manager...');

    try {
      // Check Language Model (Prompt API)
      if ('LanguageModel' in self) {
        try {
          const availability = await LanguageModel.availability();
          this.apiAvailability.languageModel = availability !== 'no';
          console.log('[ReadSmart] LanguageModel availability:', availability);
        } catch (e) {
          console.warn('[ReadSmart] LanguageModel check failed:', e);
        }
      } else {
        console.warn('[ReadSmart] LanguageModel not found in global scope');
      }

      // Check Summarizer API
      if ('Summarizer' in self) {
        try {
          const availability = await Summarizer.availability();
          this.apiAvailability.summarizer = availability !== 'no';
          console.log('[ReadSmart] Summarizer availability:', availability);
        } catch (e) {
          console.warn('[ReadSmart] Summarizer check failed:', e);
        }
      } else {
        console.warn('[ReadSmart] Summarizer not found in global scope');
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
          console.log('[ReadSmart] Translator availability:', availability);
        } catch (e) {
          console.warn('[ReadSmart] Translator check failed:', e);
          this.apiAvailability.translator = false;
        }
      } else {
        console.warn('[ReadSmart] Translator not found in global scope');
        this.apiAvailability.translator = false;
      }

      // Check Proofreader API
      if ('Proofreader' in self) {
        try {
          const availability = await Proofreader.availability();
          this.apiAvailability.proofreader = availability !== 'no';
          console.log('[ReadSmart] Proofreader availability:', availability);
        } catch (e) {
          console.warn('[ReadSmart] Proofreader check failed:', e);
        }
      } else {
        console.warn('[ReadSmart] Proofreader not found in global scope');
      }

      // Initialize Prompt API session for Q&A if available
      if (this.apiAvailability.languageModel) {
        try {
          console.log('[ReadSmart] Creating Prompt API session for Q&A...');
          this.promptSession = await LanguageModel.create({
            systemPrompt: `You are a helpful reading assistant. Answer questions about article content concisely and clearly. Keep answers brief and to the point.`
          });
          console.log('[ReadSmart] Prompt API session created successfully');
        } catch (e) {
          console.warn('[ReadSmart] Failed to create prompt session:', e);
          this.promptSession = null;
        }
      }

      this.isInitialized = true;
      console.log('[ReadSmart] AI Manager initialized successfully');
      console.log('[ReadSmart] API Availability:', this.apiAvailability);

      // Show helpful message if no APIs available
      if (Object.values(this.apiAvailability).every(v => !v)) {
        console.error('[ReadSmart] ❌ No AI APIs available!');
        console.error('[ReadSmart] 📋 Required Chrome flags:');
        console.error('  1. chrome://flags/#optimization-guide-on-device-model → Enabled BypassPerfRequirement');
        console.error('  2. chrome://flags/#prompt-api-for-gemini-nano → Enabled');
        console.error('  3. chrome://flags/#summarization-api-for-gemini-nano → Enabled');
        console.error('[ReadSmart] 🔄 Restart Chrome after enabling flags');
        console.error('[ReadSmart] 📥 Wait for model download at chrome://components');
      }

    } catch (error) {
      console.error('[ReadSmart] Error initializing AI Manager:', error);
    }
  }

  // Summarize content
  async summarizeContent(content, type = 'key-points', length = 'medium') {
    if (!this.apiAvailability.summarizer) {
      console.warn('[ReadSmart] Summarizer API not available, using truncation');
      return content.substring(0, 300) + '...';
    }

    try {
      // Destroy old summarizer if exists
      if (this.summarizer) {
        this.summarizer.destroy();
      }

      // Map user-facing type names to API enum values
      const typeMapping = {
        'tl;dr': 'tldr',  // API doesn't accept semicolon
        'key-points': 'key-points',
        'teaser': 'teaser',
        'headline': 'headline'
      };

      const apiType = typeMapping[type] || 'key-points';

      // Create new summarizer
      this.summarizer = await Summarizer.create({
        type: apiType, // 'key-points', 'tldr', 'teaser', 'headline'
        format: 'plain-text',
        length: length // 'short', 'medium', 'long'
      });

      console.log('[ReadSmart] Summarizer created with:', { type: apiType, length });

      // Truncate content to avoid QuotaExceededError
      // Summarizer API has limits on input size (~4000 tokens or ~16000 chars)
      const maxChars = 15000;
      const truncatedContent = content.length > maxChars
        ? content.substring(0, maxChars) + '...'
        : content;

      if (content.length > maxChars) {
        console.log('[ReadSmart] Content truncated from', content.length, 'to', maxChars, 'chars');
      }

      // Use summarize() method
      const summary = await this.summarizer.summarize(truncatedContent);
      console.log('[ReadSmart] Summary generated:', summary.substring(0, 100) + '...');
      return summary;

    } catch (error) {
      console.error('[ReadSmart] Error summarizing:', error);
      return content.substring(0, 300) + '...';
    }
  }

  // Translate content
  async translateContent(content, targetLanguage = 'en', sourceLanguage = 'en') {
    if (!this.apiAvailability.translator) {
      throw new Error('Translator API not available');
    }

    // Check if source and target are the same
    if (sourceLanguage === targetLanguage) {
      console.log('[ReadSmart] Source and target languages are the same, skipping translation');
      return content; // Return original content unchanged
    }

    try {
      // Check availability for this specific language pair
      const availability = await Translator.availability({
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage
      });

      console.log('[ReadSmart] Translation availability for', sourceLanguage, '→', targetLanguage, ':', availability);

      if (availability === 'unavailable') {
        throw new Error(`Translation from ${sourceLanguage} to ${targetLanguage} is not supported`);
      }

      // Destroy old translator if exists
      if (this.translator) {
        this.translator.destroy();
      }

      // Create new translator with download monitoring
      console.log('[ReadSmart] Creating translator for', sourceLanguage, '→', targetLanguage);

      this.translator = await Translator.create({
        sourceLanguage: sourceLanguage,
        targetLanguage: targetLanguage,
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            console.log(`[ReadSmart] Translation model download: ${Math.round(e.loaded * 100)}%`);
          });
        }
      });

      console.log('[ReadSmart] Translator created, translating content...');

      // Use translate() method
      const translated = await this.translator.translate(content);

      console.log('[ReadSmart] Translation completed');
      return translated;

    } catch (error) {
      console.error('[ReadSmart] Error translating:', error);
      throw error; // Re-throw so background.js can handle it
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

      console.log('[ReadSmart] Proofreading found:', proofreadResult);

      return proofreadResult;

    } catch (error) {
      console.error('[ReadSmart] Error proofreading:', error);
      return null;
    }
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
