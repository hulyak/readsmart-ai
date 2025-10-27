// Background Service Worker for ReadSmart AI
// Handles AI initialization, summarization, and Q&A

import { AIManager } from '../lib/ai-manager.js';

// Content length limits for AI processing
const CONTENT_LIMITS = {
  SUMMARY: 5000,           // Max characters for summarization
  QA_CONTEXT: 3000,        // Max characters for Q&A context
  QUESTIONS_GEN: 2500,     // Max characters for generating questions (reduced for faster response)
  MIN_ARTICLE: 500,        // Minimum article length to process
  MIN_BATCH_CONTENT: 100   // Minimum content for batch processing
};

let aiManager = null;
let stats = {
  articlesRead: 0,
  summariesGenerated: 0,
  questionsAnswered: 0,
  timeSaved: 0, // Estimated minutes saved
  lastUpdated: Date.now()
};

// Initialize on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ReadSmart] Extension installed/updated');

  // Load existing stats
  const stored = await chrome.storage.local.get(['stats']);
  if (stored.stats) {
    stats = stored.stats;
  }

  // Create context menus
  createContextMenus();

  if (details.reason === 'install') {
    // Show notification (using absolute path for icon)
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'ReadSmart AI Ready!',
      message: 'Your AI-powered reading assistant is now active. Look for the ✨ ReadSmart button on articles!'
    });
  }
});

// Initialize AI Manager
async function initializeAI() {
  if (!aiManager) {
    aiManager = new AIManager();
    await aiManager.initialize();
    console.log('[ReadSmart] AI Manager ready');
  }
  return aiManager;
}

// Create context menu items
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'readsmart-summarize',
      title: 'Summarize with ReadSmart AI',
      contexts: ['selection', 'page']
    });

    chrome.contextMenus.create({
      id: 'readsmart-explain',
      title: 'Explain this',
      contexts: ['selection']
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'readsmart-summarize') {
      const content = info.selectionText || await getPageContent(tab.id);
      const ai = await initializeAI();
      const summary = await ai.summarizeContent(content, 'key-points');

      // Send to content script to display
      chrome.tabs.sendMessage(tab.id, {
        action: 'showSummary',
        summary
      });
    } else if (info.menuItemId === 'readsmart-explain') {
      const ai = await initializeAI();

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Explanation timed out after 25 seconds')), 25000);
      });

      const promptPromise = ai.promptSession?.prompt(`Explain this simply: ${info.selectionText}`);
      const explanation = await Promise.race([promptPromise, timeoutPromise]);

      // Send to content script to display
      chrome.tabs.sendMessage(tab.id, {
        action: 'showExplanation',
        explanation
      });
    }
  } catch (error) {
    console.error('[ReadSmart] Context menu error:', error);
    // Show error notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'ReadSmart Error',
      message: error.message || 'An error occurred'
    });
  }
});

// Get page content
async function getPageContent(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.innerText
    });
    return results[0].result;
  } catch (error) {
    console.error('[ReadSmart] Error getting page content:', error);
    return '';
  }
}

// Process batch summary in background
async function processBatchSummary(tabIds) {
  console.log('[ReadSmart] Processing batch summary for', tabIds.length, 'tabs');

  // Initialize progress
  const progress = {
    status: 'running',
    total: tabIds.length,
    completed: 0,
    current: 0,
    results: [],
    startTime: Date.now()
  };

  await chrome.storage.local.set({ batchProgress: progress });

  const ai = await initializeAI();

  // Process each tab
  for (let i = 0; i < tabIds.length; i++) {
    const tabId = tabIds[i];

    // Update progress
    progress.current = i + 1;
    await chrome.storage.local.set({ batchProgress: progress });

    try {
      // Get tab info
      const tab = await chrome.tabs.get(tabId);

      console.log('[ReadSmart] Summarizing tab', i + 1, '/', tabIds.length, ':', tab.title);

      // Extract content using platform-specific selectors
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const domain = window.location.hostname;

          // Platform-specific selectors (same as content script)
          const platformSelectors = {
            'substack.com': ['.post-content', '.body', 'article', '.available-content'],
            'medium.com': ['article', '[data-testid="storyContent"]', '.postArticle-content'],
            'dev.to': [
              '#article-body',
              '.crayons-article__main',
              '.crayons-article__body',
              '.article-body',
              'article .crayons-article__content',
              '[itemprop="articleBody"]',
              'article'
            ],
            'hashnode.dev': ['article', '.post-content', '.article-content'],
            'hashnode.com': ['article', '.post-content', '.article-content'],
            'ghost.io': ['article', '.post-content', '.gh-content'],
            'wordpress.com': ['.entry-content', '.post-content', 'article'],
            'blogspot.com': ['.post-body', 'article', '.entry-content'],
            'notion.site': ['.notion-page-content', 'article', 'main'],
            'github.com': ['article', '.markdown-body', 'readme-toc'],
            'stackoverflow.com': ['.s-prose', '.post-text', 'article'],
            'reddit.com': ['[data-test-id="post-content"]', '.md', 'article'],
            'linkedin.com': ['.article-content', '[data-test-id="article-content"]', 'article'],
            'quora.com': ['.q-text', '.AnswerBase', 'article'],
            'wikipedia.org': ['#mw-content-text', '.mw-parser-output', 'article'],
            'nytimes.com': ['article', '.StoryBodyCompanionColumn', '[data-testid="article-body"]'],
            'theguardian.com': ['.article-body-commercial-selector', 'article', '.content__article-body'],
            'bbc.com': ['article', '[data-component="text-block"]', '.article__body'],
            'cnn.com': ['article', '.article__content', '.zn-body__paragraph'],
            'forbes.com': ['article', '.article-body', '.body-container'],
            'techcrunch.com': ['article', '.article-content', '.entry-content'],
            'news.ycombinator.com': ['.toptext', 'article', '.comment'],
            'arxiv.org': ['.ltx_abstract', '.ltx_page_content', 'article']
          };

          // Try platform-specific selectors first
          let articleSelectors = [];
          for (const [platform, selectors] of Object.entries(platformSelectors)) {
            if (domain.includes(platform)) {
              articleSelectors = [...selectors];
              break;
            }
          }

          // Add generic fallbacks
          articleSelectors = [
            ...articleSelectors,
            'article',
            '[role="article"]',
            '[role="main"]',
            'main article',
            '.article-content',
            '.post-content',
            '.entry-content',
            '.blog-post',
            'main'
          ];

          // Find content
          let element = null;
          for (const selector of articleSelectors) {
            element = document.querySelector(selector);
            if (element) break;
          }

          if (!element) {
            element = document.body;
          }

          // Clone and clean content
          const clone = element.cloneNode(true);

          // Remove unwanted elements
          const unwantedSelectors = [
            'script', 'style', 'nav', 'header', 'footer', 'aside',
            '.ad', '.advertisement', '.social-share', '.comments',
            '.related-posts', '.sidebar', '[role="navigation"]',
            '#comments', '.subscription-widget', '.newsletter'
          ];

          clone.querySelectorAll(unwantedSelectors.join(', ')).forEach(el => el.remove());

          // Get clean text
          let content = clone.innerText || clone.textContent || '';
          content = content.replace(/\s+/g, ' ').trim();

          return content.substring(0, 5000);
        }
      });

      const content = result.result;

      if (!content || content.length < CONTENT_LIMITS.MIN_BATCH_CONTENT) {
        progress.results.push({
          tab: { id: tab.id, title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl },
          summary: 'Could not extract enough content from this page.',
          error: true
        });
        progress.completed++;
        await chrome.storage.local.set({ batchProgress: progress });
        continue;
      }

      // Generate summary
      const summary = await ai.summarizeContent(content, 'key-points', 'short');

      progress.results.push({
        tab: { id: tab.id, title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl },
        summary: summary,
        error: false
      });

      progress.completed++;
      await chrome.storage.local.set({ batchProgress: progress });

      // Update stats
      stats.summariesGenerated++;
      stats.articlesRead++;
      stats.timeSaved += 4;
      stats.lastUpdated = Date.now();
      await chrome.storage.local.set({ stats });

    } catch (error) {
      console.error('[ReadSmart] Error summarizing tab:', error);

      progress.results.push({
        tab: { id: tabId, title: 'Error', url: '', favIconUrl: '' },
        summary: 'Error: ' + error.message,
        error: true
      });

      progress.completed++;
      await chrome.storage.local.set({ batchProgress: progress });
    }
  }

  // Mark as complete
  progress.status = 'completed';
  progress.endTime = Date.now();
  await chrome.storage.local.set({ batchProgress: progress });

  console.log('[ReadSmart] Batch summary completed!');
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case 'summarizeContent': {
          console.log('[ReadSmart] Summarizing content...', {
            length: request.length,
            type: request.type
          });
          const ai = await initializeAI();
          const summary = await ai.summarizeContent(request.content, request.type, request.length);

          // Update stats
          stats.summariesGenerated++;
          stats.articlesRead++;
          // Estimate time saved (average article = 5 min read, summary saves ~4 min)
          stats.timeSaved += 4;
          stats.lastUpdated = Date.now();
          await chrome.storage.local.set({ stats });

          sendResponse({ success: true, summary });
          break;
        }

        case 'answerQuestion': {
          console.log('[ReadSmart] Answering question:', request.question);
          const ai = await initializeAI();

          // Debug: Check if Prompt API is available
          console.log('[ReadSmart] Prompt Session Status:', {
            promptSessionExists: !!ai.promptSession,
            languageModelAvailable: ai.apiAvailability?.languageModel
          });

          // Check if Prompt API is available
          if (!ai.promptSession) {
            console.error('[ReadSmart] Prompt API session not available!');
            console.error('[ReadSmart] Please enable chrome://flags/#prompt-api-for-gemini-nano');
            sendResponse({
              success: false,
              error: 'Prompt API not available. Please enable chrome://flags/#prompt-api-for-gemini-nano and restart Chrome.'
            });
            break;
          }

          try {
            // Use Prompt API to answer question about the content
            const prompt = `Based on this article content, please answer the following question concisely:

Article: ${request.content.substring(0, CONTENT_LIMITS.QA_CONTEXT)}

Question: ${request.question}

Answer:`;

            console.log('[ReadSmart] Sending prompt to AI...');

            // Add timeout to prompt() call
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('AI response timed out after 25 seconds')), 25000);
            });

            const promptPromise = ai.promptSession.prompt(prompt);
            const answer = await Promise.race([promptPromise, timeoutPromise]);

            console.log('[ReadSmart] Received answer from AI');

            // Update stats
            stats.questionsAnswered++;
            stats.lastUpdated = Date.now();
            await chrome.storage.local.set({ stats });

            sendResponse({ success: true, answer });
          } catch (error) {
            console.error('[ReadSmart] Error in answerQuestion:', error);
            sendResponse({
              success: false,
              error: error.message || 'Failed to get answer from AI'
            });
          }
          break;
        }

        case 'generateQuestions': {
          console.log('[ReadSmart] Generating suggested questions...');

          // Check if LanguageModel API is available
          if (!('LanguageModel' in self)) {
            console.warn('[ReadSmart] LanguageModel API not available, using default questions');
            sendResponse({
              success: true,
              questions: [
                "What's the main idea?",
                "What are the key points?",
                "Can you explain this in simple terms?",
                "What are the implications?"
              ]
            });
            break;
          }

          const availability = await LanguageModel.availability();
          console.log('[ReadSmart] LanguageModel availability:', availability);

          if (availability === 'no') {
            console.warn('[ReadSmart] LanguageModel not available, using default questions');
            sendResponse({
              success: true,
              questions: [
                "What's the main idea?",
                "What are the key points?",
                "Can you explain this in simple terms?",
                "What are the implications?"
              ]
            });
            break;
          }

          const contentForQuestions = request.content.substring(0, CONTENT_LIMITS.QUESTIONS_GEN);

          console.log('[ReadSmart] Article title:', request.title);
          console.log('[ReadSmart] Full content length:', request.content.length);
          console.log('[ReadSmart] Content for questions:', contentForQuestions.substring(0, 300) + '...');

          let questionSession = null;
          try {
            // Create a dedicated session with system prompt for question generation
            questionSession = await LanguageModel.create({
              initialPrompts: [{
                role: 'system',
                content: `You are a reading comprehension expert who generates specific, content-based questions.

Your goal: Create questions that can ONLY be answered by reading THIS specific article.

Requirements for EVERY question:
- Must reference specific people, concepts, data, or arguments from the article
- Must be answerable from the content provided
- Must include specific terms or names from the article

FORBIDDEN (DO NOT generate):
- Generic questions like "What's the main idea?" or "What are the implications?"
- Questions that could apply to any article
- Vague questions about themes or feelings

CRITICAL: Questions must be so specific that someone who hasn't read this article cannot answer them.`
              }]
            });

            const questionsPrompt = `Article Title: "${request.title}"

Article Content:
${contentForQuestions}

---

Examples of content-specific questions:

For an article about "Tesla announces Cybertruck production in Austin":
✓ GOOD: "In which city will Tesla produce the Cybertruck?"
✓ GOOD: "What vehicle did Tesla announce in the article?"
✗ BAD: "What are the implications?"
✗ BAD: "What's the main idea?"

For an article about "Study shows coffee reduces diabetes risk by 30%":
✓ GOOD: "By what percentage does coffee reduce diabetes risk according to the study?"
✓ GOOD: "What health condition does the study connect to coffee consumption?"
✗ BAD: "What are the health benefits?"
✗ BAD: "Can you explain this?"

---

Now analyze the article above and generate exactly 5 specific questions.

Each question MUST:
1. Include specific names, numbers, terms, or concepts from the article
2. Be answerable only by someone who read THIS article
3. Reference concrete details, not abstract themes

CRITICAL: DO NOT use generic questions. Ask about specific details mentioned in the content.

Generate 5 questions now (one per line, no numbering):`;

            console.log('[ReadSmart] Sending questions prompt to AI...');
            console.log('[ReadSmart] Prompt length:', questionsPrompt.length);

            // Add timeout to prompt() call (40s for complex articles)
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('AI response timed out')), 40000);
            });

            const promptPromise = questionSession.prompt(questionsPrompt);
            const questionsText = await Promise.race([promptPromise, timeoutPromise]);

            console.log('[ReadSmart] ===== RAW AI RESPONSE =====');
            console.log(questionsText);
            console.log('[ReadSmart] ==========================');

            // Parse questions from response
            const questions = questionsText
              .split('\n')
              .map(q => q.trim())
              .map(q => q.replace(/^\d+\.\s*/, '')) // Remove numbering
              .map(q => q.replace(/^[-•*]\s*/, '')) // Remove bullets
              .filter(q => q.length > 10 && q.includes('?')) // Valid questions
              .map(q => {
                // Ensure question ends with ?
                if (!q.endsWith('?')) {
                  const qIndex = q.lastIndexOf('?');
                  if (qIndex > 0) {
                    q = q.substring(0, qIndex + 1);
                  }
                }
                return q;
              })
              .slice(0, 5);

            console.log('[ReadSmart] Parsed questions:', questions);

            // Quality check: Reject if questions look too generic
            const genericPatterns = [
              /what'?s the main idea/i,
              /what are the implications/i,
              /can you explain/i,
              /what does this mean/i,
              /how does this relate/i,
              /what are the key points/i
            ];

            const genericCount = questions.filter(q =>
              genericPatterns.some(pattern => pattern.test(q))
            ).length;

            console.log('[ReadSmart] Generic question count:', genericCount);

            // Cleanup session
            questionSession.destroy();

            if (questions.length >= 3 && genericCount < 2) {
              console.log('[ReadSmart] ✓ Questions passed quality check');
              sendResponse({
                success: true,
                questions: questions
              });
            } else {
              console.warn('[ReadSmart] Questions failed quality check or insufficient count');
              console.warn('[ReadSmart] Using fallback questions');
              sendResponse({
                success: true,
                questions: [
                  "What's the main idea?",
                  "What are the key points?",
                  "Can you explain this in simple terms?",
                  "What are the implications?",
                  "How does this relate to current events?"
                ]
              });
            }
          } catch (error) {
            console.error('[ReadSmart] Error generating questions:', error);
            console.error('[ReadSmart] Error details:', error.message, error.stack);

            // Cleanup session if it was created
            if (questionSession) {
              try {
                questionSession.destroy();
              } catch (cleanupError) {
                console.error('[ReadSmart] Error cleaning up session:', cleanupError);
              }
            }

            sendResponse({
              success: true,
              questions: [
                "What's the main idea?",
                "What are the key points?",
                "Can you explain this in simple terms?",
                "What are the implications?",
                "Who or what is this about?"
              ]
            });
          }
          break;
        }

        case 'getStats':
          sendResponse({ success: true, stats });
          break;

        case 'clearStats':
          stats = {
            articlesRead: 0,
            summariesGenerated: 0,
            questionsAnswered: 0,
            timeSaved: 0,
            lastUpdated: Date.now()
          };
          await chrome.storage.local.set({ stats });
          sendResponse({ success: true });
          break;

        case 'translateContent': {
          console.log('[ReadSmart] Translating content to:', request.targetLanguage);
          const ai = await initializeAI();

          if (!ai.apiAvailability.translator) {
            sendResponse({
              success: false,
              error: 'Translator API not available. Please enable chrome://flags/#translation-api'
            });
            break;
          }

          try {
            const translation = await ai.translateContent(
              request.content,
              request.targetLanguage,
              request.sourceLanguage
            );

            console.log('[ReadSmart] Translation completed');
            sendResponse({ success: true, translation });
          } catch (error) {
            console.error('[ReadSmart] Translation error:', error);
            sendResponse({
              success: false,
              error: error.message || 'Translation failed'
            });
          }
          break;
        }

        case 'checkAPIAvailability': {
          const ai = await initializeAI();
          sendResponse({
            success: true,
            availability: {
              prompt: ai.apiAvailability.languageModel,
              summarizer: ai.apiAvailability.summarizer,
              translator: ai.apiAvailability.translator
            }
          });
          break;
        }

        case 'startBatchSummary': {
          console.log('[ReadSmart] Starting batch summary for', request.tabIds.length, 'tabs');

          // Start the batch process in the background
          processBatchSummary(request.tabIds);

          sendResponse({ success: true, message: 'Batch summary started' });
          break;
        }

        case 'getBatchProgress': {
          // Return current progress from storage
          const { batchProgress } = await chrome.storage.local.get(['batchProgress']);
          sendResponse({ success: true, progress: batchProgress });
          break;
        }

        case 'cancelBatchSummary': {
          // Clear batch progress
          await chrome.storage.local.remove(['batchProgress']);
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[ReadSmart] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true; // Keep message channel open for async response
});

// Periodic stats save
setInterval(() => {
  chrome.storage.local.set({ stats });
}, 60000); // Save every minute

console.log('[ReadSmart] Background service worker initialized');
