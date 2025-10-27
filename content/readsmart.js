// ReadSmart AI - Content Script
// Intelligently detects articles and provides AI-powered reading assistance

console.log('[ReadSmart] Content script loaded');

// Configuration
const CONFIG = {
  minArticleLength: 500, // Minimum text length to show ReadSmart button
  autoDetect: true,
  showOnLoad: true,
  buttonDelay: 1000, // Wait 1 second before showing button
  maxRetries: 5, // Retry detection for dynamic content
  retryInterval: 1000, // Retry every 1 second
};

let isArticlePage = false;
let articleContent = null;
let currentSummary = null;
let sidebarOpen = false;
let detectionAttempts = 0;
let mutationObserver = null;
let retryIntervalId = null;
let detectionTimeout = null;
let bodyCheckAttempts = 0;
const MAX_BODY_CHECK_ATTEMPTS = 50; // 5 seconds max
let messageIdCounter = 0; // Counter to ensure unique message IDs

// Initialize
function init() {
  // Clear any existing intervals from previous init
  cleanup();

  // Initial detection attempt
  setTimeout(() => {
    detectArticle();
  }, CONFIG.buttonDelay);

  // Set up mutation observer for dynamically loaded content (e.g., Medium, Substack)
  setupMutationObserver();

  // Retry detection for SPA pages that load content after initial page load
  retryIntervalId = setInterval(() => {
    if (isArticlePage) {
      clearInterval(retryIntervalId);
      retryIntervalId = null;
      return;
    }

    detectionAttempts++;
    console.log(`[ReadSmart] Retry detection attempt ${detectionAttempts}/${CONFIG.maxRetries}`);
    detectArticle();

    if (detectionAttempts >= CONFIG.maxRetries) {
      clearInterval(retryIntervalId);
      retryIntervalId = null;
      console.log('[ReadSmart] Max detection attempts reached, stopping retry');
    }
  }, CONFIG.retryInterval);
}

// Cleanup function to prevent memory leaks
function cleanup() {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
  }
  if (detectionTimeout) {
    clearTimeout(detectionTimeout);
    detectionTimeout = null;
  }
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
}

// Set up mutation observer to detect dynamically loaded content
function setupMutationObserver() {
  if (mutationObserver) return;

  // Wait for body to exist (with max attempts)
  if (!document.body) {
    bodyCheckAttempts++;
    if (bodyCheckAttempts < MAX_BODY_CHECK_ATTEMPTS) {
      console.log(`[ReadSmart] Body not ready, waiting... (attempt ${bodyCheckAttempts}/${MAX_BODY_CHECK_ATTEMPTS})`);
      setTimeout(setupMutationObserver, 100);
    } else {
      console.error('[ReadSmart] Body never loaded after 50 attempts (5 seconds)');
    }
    return;
  }

  try {
    mutationObserver = new MutationObserver((mutations) => {
      // Only trigger detection if article hasn't been found yet
      if (!isArticlePage) {
        // Debounce detection to avoid running too frequently
        clearTimeout(detectionTimeout);
        detectionTimeout = setTimeout(() => {
          detectArticle();
        }, 500);
      }
    });

    // Observe the entire document for changes
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[ReadSmart] Mutation observer set up successfully');
  } catch (error) {
    console.error('[ReadSmart] Error setting up mutation observer:', error);
  }
}

// Detect if current page is an article
function detectArticle() {
  try {
    // Skip if already detected
    if (isArticlePage) {
      return;
    }

    const content = extractArticleContent();

    if (!content || content.text.length < CONFIG.minArticleLength) {
      console.log('[ReadSmart] Page does not appear to be an article (too short or no content)');
      console.log('[ReadSmart] Content length:', content ? content.text.length : 0, 'characters (min:', CONFIG.minArticleLength, ')');
      if (content && content.text.length > 0 && content.text.length < CONFIG.minArticleLength) {
        console.log('[ReadSmart] First 200 chars of extracted content:', content.text.substring(0, 200));
      }
      return;
    }

    isArticlePage = true;
    articleContent = content;

    console.log('[ReadSmart] ✅ Article detected!');
    console.log('[ReadSmart] Domain:', content.domain);
    console.log('[ReadSmart] Title:', content.title);
    console.log('[ReadSmart] Length:', content.text.length, 'characters');
    console.log('[ReadSmart] Words:', content.wordCount);
    console.log('[ReadSmart] Estimated reading time:', content.readingTime, 'minutes');

    // Stop mutation observer once article is found
    if (mutationObserver) {
      mutationObserver.disconnect();
      console.log('[ReadSmart] Stopped mutation observer');
    }

    // Show ReadSmart button
    showFloatingButton();

  } catch (error) {
    console.error('[ReadSmart] Error detecting article:', error);
  }
}

// Extract article content intelligently
function extractArticleContent() {
  const domain = window.location.hostname;

  // Platform-specific selectors for better detection
  const platformSelectors = {
    // Substack (newsletters)
    'substack.com': ['.post-content', '.body', 'article', '.available-content'],

    // Medium
    'medium.com': ['article', '[data-testid="storyContent"]', '.postArticle-content'],

    // Dev.to (developer community)
    'dev.to': [
      '#article-body',
      '.crayons-article__main',
      '.crayons-article__body',
      '.article-body',
      'article .crayons-article__content',
      '[itemprop="articleBody"]',
      'article'
    ],

    // Hashnode (developer blogs)
    'hashnode.dev': ['article', '.post-content', '.article-content'],
    'hashnode.com': ['article', '.post-content', '.article-content'],

    // Ghost blogs (common blogging platform)
    'ghost.io': ['article', '.post-content', '.gh-content'],

    // WordPress (most popular CMS)
    'wordpress.com': ['.entry-content', '.post-content', 'article'],

    // Blogger
    'blogspot.com': ['.post-body', 'article', '.entry-content'],

    // Notion pages
    'notion.site': ['.notion-page-content', 'article', 'main'],

    // GitHub (README, wikis, discussions)
    'github.com': ['article', '.markdown-body', 'readme-toc'],

    // Stack Overflow
    'stackoverflow.com': ['.s-prose', '.post-text', 'article'],

    // Reddit
    'reddit.com': ['[data-test-id="post-content"]', '.md', 'article'],

    // LinkedIn articles
    'linkedin.com': ['.article-content', '[data-test-id="article-content"]', 'article'],

    // Quora
    'quora.com': ['.q-text', '.AnswerBase', 'article'],

    // Wikipedia
    'wikipedia.org': ['#mw-content-text', '.mw-parser-output', 'article'],

    // The New York Times
    'nytimes.com': ['article', '.StoryBodyCompanionColumn', '[data-testid="article-body"]'],

    // The Guardian
    'theguardian.com': ['.article-body-commercial-selector', 'article', '.content__article-body'],

    // BBC
    'bbc.com': ['article', '[data-component="text-block"]', '.article__body'],

    // CNN
    'cnn.com': ['article', '.article__content', '.zn-body__paragraph'],

    // Forbes
    'forbes.com': ['article', '.article-body', '.body-container'],

    // TechCrunch
    'techcrunch.com': ['article', '.article-content', '.entry-content'],

    // Hacker News (Show HN, Ask HN posts)
    'news.ycombinator.com': ['.toptext', 'article', '.comment'],

    // ArXiv (research papers)
    'arxiv.org': ['.ltx_abstract', '.ltx_page_content', 'article']
  };

  // Try to find main article content using platform-specific selectors first
  let articleSelectors = [];

  // Check if domain matches any platform
  for (const [platform, selectors] of Object.entries(platformSelectors)) {
    if (domain.includes(platform)) {
      articleSelectors = [...selectors];
      console.log('[ReadSmart] Detected platform:', platform);
      break;
    }
  }

  // Add generic selectors as fallback
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
    '.content',
    'main',
  ];

  let mainElement = null;

  // Try each selector
  for (const selector of articleSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      mainElement = element;
      console.log('[ReadSmart] Found content using selector:', selector);
      break;
    }
  }

  // Fallback to body if no article element found
  if (!mainElement) {
    console.log('[ReadSmart] No article element found, using body');
    mainElement = document.body;
  }

  // Extract text
  const text = extractCleanText(mainElement);
  const wordCount = text.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words/min

  // Extract title
  const title = document.title ||
                document.querySelector('h1')?.innerText ||
                'Untitled Article';

  // Extract metadata
  const url = window.location.href;
  // domain already declared at top of function

  return {
    text,
    title,
    url,
    domain,
    wordCount,
    readingTime,
    element: mainElement
  };
}

// Extract clean text from element
function extractCleanText(element) {
  // Clone element to avoid modifying the page
  const clone = element.cloneNode(true);

  // Remove unwanted elements (expanded list for better filtering)
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer', 'aside',
    '.ad', '.advertisement', '.social-share', '.comments', '.comment-section',
    '.related-posts', '.sidebar', '.navigation', '.menu',
    '[role="navigation"]', '[role="complementary"]',
    '.share-buttons', '.subscription-widget', '.newsletter',
    '#comments', '#sidebar', '.author-bio',
    // Platform-specific
    '.substack-subscribe', // Substack
    '.pw-multi-vote-icon', // Medium claps
    '[data-testid="storyComments"]', // Medium comments
    '.crayons-comment', // Dev.to comments
    '.reactions-container' // Dev.to reactions
  ];

  const unwanted = clone.querySelectorAll(unwantedSelectors.join(', '));
  unwanted.forEach(el => el.remove());

  // Get text content
  let text = clone.innerText || clone.textContent || '';

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// Show floating ReadSmart button
function showFloatingButton() {
  // Check if button already exists
  if (document.getElementById('readsmart-button')) {
    return;
  }

  const button = document.createElement('div');
  button.id = 'readsmart-button';
  button.className = 'readsmart-floating-button';

  // Use the actual icon SVG
  const iconUrl = chrome.runtime.getURL('icons/readsmart-icon.svg');
  button.innerHTML = `
    <img src="${iconUrl}" alt="ReadSmart" class="readsmart-button-icon-img">
  `;

  button.addEventListener('click', () => {
    if (sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  document.body.appendChild(button);

  // Animate in
  setTimeout(() => {
    button.classList.add('readsmart-visible');
  }, 100);
}

// Open ReadSmart sidebar
function openSidebar() {
  if (sidebarOpen) return;

  const sidebar = createSidebar();
  document.body.appendChild(sidebar);

  // Animate in
  setTimeout(() => {
    sidebar.classList.add('readsmart-sidebar-open');
  }, 50);

  sidebarOpen = true;

  // Update button state
  const button = document.getElementById('readsmart-button');
  if (button) {
    button.classList.add('readsmart-button-active');
  }

  // Auto-generate summary and questions
  generateSummary();
  generateSuggestedQuestions();
}

// Close sidebar
function closeSidebar() {
  const sidebar = document.getElementById('readsmart-sidebar');
  if (!sidebar) return;

  sidebar.classList.remove('readsmart-sidebar-open');
  setTimeout(() => {
    sidebar.remove();
  }, 300);

  sidebarOpen = false;

  // Update button state
  const button = document.getElementById('readsmart-button');
  if (button) {
    button.classList.remove('readsmart-button-active');
  }
}

// Create sidebar UI
function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'readsmart-sidebar';
  sidebar.className = 'readsmart-sidebar';

  sidebar.innerHTML = `
    <div class="readsmart-sidebar-header">
      <div class="readsmart-sidebar-title">
        <span class="readsmart-icon">✨</span>
        <span>ReadSmart AI</span>
      </div>
      <button class="readsmart-close-btn" id="readsmart-close">✕</button>
    </div>

    <div class="readsmart-sidebar-content">
      <!-- Article Info -->
      <div class="readsmart-article-info">
        <div class="readsmart-article-title">${escapeHtml(articleContent.title)}</div>
        <div class="readsmart-article-meta">
          <span>📖 ${articleContent.wordCount} words</span>
          <span>⏱️ ${articleContent.readingTime} min read</span>
        </div>
      </div>

      <!-- Translation Section -->
      <div class="readsmart-section">
        <div class="readsmart-section-header">
          <h3>🌍 Translate</h3>
          <div class="readsmart-translate-options">
            <select id="readsmart-target-language" class="readsmart-select">
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="ja">Japanese</option>
              <option value="zh">Chinese</option>
              <option value="ko">Korean</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
              <option value="tr">Turkish</option>
            </select>
            <button id="readsmart-translate-btn" class="readsmart-btn-secondary">
              Translate
            </button>
          </div>
        </div>
        <div id="readsmart-translation-content" class="readsmart-translation-content" style="display: none;">
          <div class="readsmart-translation-text"></div>
          <button id="readsmart-show-original" class="readsmart-btn-text">
            Show Original
          </button>
        </div>
      </div>

      <!-- Summary Section -->
      <div class="readsmart-section">
        <div class="readsmart-section-header">
          <h3>✨ Summary</h3>
          <div class="readsmart-summary-options">
            <select id="readsmart-summary-length" class="readsmart-select">
              <option value="short">Short</option>
              <option value="medium" selected>Medium</option>
              <option value="long">Long</option>
            </select>
            <select id="readsmart-summary-type" class="readsmart-select">
              <option value="key-points" selected>Key Points</option>
              <option value="tl;dr">TL;DR</option>
              <option value="teaser">Teaser</option>
            </select>
          </div>
        </div>
        <div id="readsmart-summary-content" class="readsmart-summary-content">
          <div class="readsmart-loading">
            <div class="readsmart-spinner"></div>
            <p>Analyzing article...</p>
          </div>
        </div>
        <button id="readsmart-regenerate-summary" class="readsmart-btn-secondary" style="display: none;">
          🔄 Regenerate Summary
        </button>
      </div>

      <!-- Q&A Section -->
      <div class="readsmart-section">
        <div class="readsmart-section-header">
          <h3>💬 Ask Questions</h3>
        </div>

        <!-- Suggested Questions -->
        <div id="readsmart-suggested-questions" class="readsmart-suggested-questions">
          <div class="readsmart-questions-loading">
            <div class="readsmart-spinner-small"></div>
            <span>Generating questions...</span>
          </div>
        </div>

        <div id="readsmart-qa-messages" class="readsmart-qa-messages">
          <div class="readsmart-qa-placeholder">
            Ask me anything about this article...
          </div>
        </div>
        <div class="readsmart-qa-input-container">
          <input
            type="text"
            id="readsmart-qa-input"
            class="readsmart-qa-input"
            placeholder="What's the main argument?"
          />
          <button id="readsmart-qa-send" class="readsmart-btn-primary">
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  setTimeout(() => {
    // Close button
    document.getElementById('readsmart-close').addEventListener('click', closeSidebar);

    // Summary options
    document.getElementById('readsmart-summary-length').addEventListener('change', regenerateSummary);
    document.getElementById('readsmart-summary-type').addEventListener('change', regenerateSummary);
    document.getElementById('readsmart-regenerate-summary')?.addEventListener('click', regenerateSummary);

    // Q&A
    document.getElementById('readsmart-qa-send').addEventListener('click', sendQuestion);
    document.getElementById('readsmart-qa-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendQuestion();
      }
    });

    // Translation
    document.getElementById('readsmart-translate-btn')?.addEventListener('click', translateArticle);
    document.getElementById('readsmart-show-original')?.addEventListener('click', showOriginalArticle);
  }, 100);

  return sidebar;
}

// Generate summary
async function generateSummary() {
  try {
    const summaryContent = document.getElementById('readsmart-summary-content');
    if (!summaryContent) return;

    // Show loading
    summaryContent.innerHTML = `
      <div class="readsmart-loading">
        <div class="readsmart-spinner"></div>
        <p>Generating summary...</p>
      </div>
    `;

    // Get options
    const length = document.getElementById('readsmart-summary-length')?.value || 'medium';
    const type = document.getElementById('readsmart-summary-type')?.value || 'key-points';

    console.log('[ReadSmart] Generating summary...', { length, type });

    // Request summary from background script
    const response = await chrome.runtime.sendMessage({
      action: 'summarizeContent',
      content: articleContent.text,
      type: type,
      length: length
    });

    console.log('[ReadSmart] Summary response:', response);

    if (response && response.success) {
      console.log('[ReadSmart] Summary received, length:', response.summary?.length);
      console.log('[ReadSmart] Summary preview:', response.summary?.substring(0, 200));

      currentSummary = response.summary;
      displaySummary(response.summary, type);
    } else {
      throw new Error(response?.error || 'Failed to generate summary');
    }

  } catch (error) {
    console.error('[ReadSmart] Error generating summary:', error);
    showSummaryError(error.message);
  }
}

// Display summary
function displaySummary(summary, type) {
  const summaryContent = document.getElementById('readsmart-summary-content');
  if (!summaryContent) return;

  let html = '';

  if (type === 'key-points') {
    // Try to parse as bullet points
    const points = summary.split('\n').filter(line => line.trim());
    html = '<ul class="readsmart-bullet-list">';
    points.forEach(point => {
      const cleanPoint = point.replace(/^[•\-\*]\s*/, '').trim();
      if (cleanPoint) {
        html += `<li>${escapeHtml(cleanPoint)}</li>`;
      }
    });
    html += '</ul>';
  } else {
    // Display as paragraph - escape HTML to prevent injection
    html = `<p class="readsmart-summary-text">${escapeHtml(summary)}</p>`;
  }

  summaryContent.innerHTML = html;

  // Show regenerate button
  const regenBtn = document.getElementById('readsmart-regenerate-summary');
  if (regenBtn) {
    regenBtn.style.display = 'block';
  }
}

// Show summary error
function showSummaryError(message) {
  const summaryContent = document.getElementById('readsmart-summary-content');
  if (!summaryContent) return;

  summaryContent.innerHTML = `
    <div class="readsmart-error">
      <p>❌ Could not generate summary</p>
      <p class="readsmart-error-detail">${escapeHtml(message)}</p>
      <p class="readsmart-error-hint">Make sure Chrome AI APIs are enabled in chrome://flags</p>
    </div>
  `;

  // Show regenerate button
  const regenBtn = document.getElementById('readsmart-regenerate-summary');
  if (regenBtn) {
    regenBtn.style.display = 'block';
  }
}

// Regenerate summary
function regenerateSummary() {
  generateSummary();
}

// Generate suggested questions based on article content
async function generateSuggestedQuestions() {
  try {
    const questionsContainer = document.getElementById('readsmart-suggested-questions');
    if (!questionsContainer) return;

    // Show loading
    questionsContainer.innerHTML = `
      <div class="readsmart-questions-loading">
        <div class="readsmart-spinner-small"></div>
        <span>Generating questions...</span>
      </div>
    `;

    console.log('[ReadSmart] Generating suggested questions...');

    // Request AI to generate questions with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), 20000);
    });

    const responsePromise = chrome.runtime.sendMessage({
      action: 'generateQuestions',
      content: articleContent.text,
      title: articleContent.title
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    console.log('[ReadSmart] Questions response:', response);

    if (response && response.success && response.questions) {
      displaySuggestedQuestions(response.questions);
    } else {
      // Fallback: Use simple template questions
      displaySuggestedQuestions(getDefaultQuestions());
    }

  } catch (error) {
    console.error('[ReadSmart] Error generating questions:', error);
    // Show default questions on error
    displaySuggestedQuestions(getDefaultQuestions());
  }
}

// Display suggested questions as clickable chips
function displaySuggestedQuestions(questions) {
  const questionsContainer = document.getElementById('readsmart-suggested-questions');
  if (!questionsContainer) {
    console.warn('[ReadSmart] Questions container not found');
    return;
  }

  console.log('[ReadSmart] Displaying', questions.length, 'suggested questions');
  console.log('[ReadSmart] Questions array:', questions);

  // Filter out empty or invalid questions
  const validQuestions = questions.filter(q => q && typeof q === 'string' && q.trim().length > 0);

  if (validQuestions.length === 0) {
    console.warn('[ReadSmart] No valid questions to display');
    questionsContainer.innerHTML = '';
    return;
  }

  console.log('[ReadSmart] Valid questions:', validQuestions);

  let html = '<div class="readsmart-questions-label">💡 Suggested questions:</div>';
  html += '<div class="readsmart-questions-chips">';

  validQuestions.forEach((question, index) => {
    html += `
      <button class="readsmart-question-chip" data-question="${question.replace(/"/g, '&quot;')}">
        ${escapeHtml(question)}
      </button>
    `;
  });

  html += '</div>';

  console.log('[ReadSmart] Setting questions HTML, length:', html.length);
  questionsContainer.innerHTML = html;

  console.log('[ReadSmart] Questions container HTML after setting:', questionsContainer.innerHTML.substring(0, 200));

  // Add click handlers
  questionsContainer.querySelectorAll('.readsmart-question-chip').forEach((chip, index) => {
    chip.addEventListener('click', () => {
      const question = chip.getAttribute('data-question');
      console.log('[ReadSmart] Suggested question clicked:', question);
      const input = document.getElementById('readsmart-qa-input');
      if (input) {
        input.value = question;
        input.focus();
        // Auto-send the question
        sendQuestion();
      }
    });
  });

  console.log('[ReadSmart] Suggested questions displayed and click handlers attached');
}

// Get default template questions
function getDefaultQuestions() {
  return [
    "What's the main idea?",
    "What are the key points?",
    "Can you explain this in simple terms?",
    "What are the implications?",
    "Who is the target audience?"
  ];
}

// Send question
async function sendQuestion() {
  const input = document.getElementById('readsmart-qa-input');
  const question = input?.value?.trim();

  if (!question) return;

  // Clear input
  input.value = '';

  // Add user message
  addQAMessage('user', question);

  // Show thinking indicator
  const thinkingId = addQAMessage('assistant', '...', true);

  try {
    console.log('[ReadSmart] Asking question:', question);

    // Request answer from background script with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out after 30 seconds')), 30000);
    });

    const responsePromise = chrome.runtime.sendMessage({
      action: 'answerQuestion',
      content: articleContent.text,
      question: question,
      context: {
        title: articleContent.title,
        url: articleContent.url
      }
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    console.log('[ReadSmart] Answer response:', response);

    // Remove thinking indicator
    removeQAMessage(thinkingId);

    if (response && response.success) {
      addQAMessage('assistant', response.answer);
    } else {
      throw new Error(response?.error || 'Failed to get answer');
    }

  } catch (error) {
    console.error('[ReadSmart] Error answering question:', error);
    removeQAMessage(thinkingId);
    addQAMessage('assistant', '❌ Sorry, I could not answer that question. ' + error.message);
  }
}

// Add Q&A message
function addQAMessage(role, text, isThinking = false) {
  const messagesContainer = document.getElementById('readsmart-qa-messages');
  if (!messagesContainer) return null;

  // Remove placeholder
  const placeholder = messagesContainer.querySelector('.readsmart-qa-placeholder');
  if (placeholder) {
    placeholder.remove();
  }

  // Use counter + timestamp to ensure truly unique IDs
  messageIdCounter++;
  const messageId = 'qa-msg-' + Date.now() + '-' + messageIdCounter;
  const messageDiv = document.createElement('div');
  messageDiv.id = messageId;
  messageDiv.className = `readsmart-qa-message readsmart-qa-${role}`;

  if (isThinking) {
    messageDiv.classList.add('readsmart-qa-thinking');
    messageDiv.innerHTML = `
      <div class="readsmart-spinner-small"></div>
      <span>Thinking...</span>
    `;
  } else {
    messageDiv.textContent = text;
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  console.log('[ReadSmart] Added message:', messageId, 'role:', role, 'isThinking:', isThinking);

  return messageId;
}

// Remove Q&A message
function removeQAMessage(messageId) {
  console.log('[ReadSmart] Removing message:', messageId);
  const message = document.getElementById(messageId);
  if (message) {
    console.log('[ReadSmart] Message found and removed');
    message.remove();
  } else {
    console.warn('[ReadSmart] Message not found:', messageId);
  }
}

// Translate article
async function translateArticle() {
  try {
    const targetLang = document.getElementById('readsmart-target-language')?.value;
    const translationContent = document.getElementById('readsmart-translation-content');
    const translationText = translationContent?.querySelector('.readsmart-translation-text');

    if (!translationContent || !translationText) return;

    // Show loading
    translationContent.style.display = 'block';
    translationText.innerHTML = `
      <div class="readsmart-loading">
        <div class="readsmart-spinner"></div>
        <p>Translating to ${getLanguageName(targetLang)}...</p>
      </div>
    `;

    console.log('[ReadSmart] Translating to:', targetLang);

    // Request translation from background script
    // Always translate from English
    const response = await chrome.runtime.sendMessage({
      action: 'translateContent',
      content: articleContent.text,
      targetLanguage: targetLang,
      sourceLanguage: 'en'
    });

    console.log('[ReadSmart] Translation response:', response);

    if (response && response.success) {
      translationText.innerHTML = `
        <div class="readsmart-translation-header">
          <span class="readsmart-translation-badge">🌍 Translated to ${escapeHtml(getLanguageName(targetLang))}</span>
        </div>
        <div class="readsmart-translation-body">${escapeHtml(response.translation)}</div>
      `;
    } else {
      throw new Error(response?.error || 'Translation failed');
    }

  } catch (error) {
    console.error('[ReadSmart] Error translating:', error);
    const translationText = document.querySelector('.readsmart-translation-text');
    if (translationText) {
      translationText.innerHTML = `
        <div class="readsmart-error">
          <p>❌ Could not translate article</p>
          <p class="readsmart-error-detail">${escapeHtml(error.message)}</p>
          <p class="readsmart-error-hint">Make sure Translator API is enabled in chrome://flags</p>
        </div>
      `;
    }
  }
}

// Show original article
function showOriginalArticle() {
  const translationContent = document.getElementById('readsmart-translation-content');
  if (translationContent) {
    translationContent.style.display = 'none';
  }
}

// Get language name from code
function getLanguageName(code) {
  const languages = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'zh': 'Chinese',
    'ko': 'Korean',
    'ar': 'Arabic',
    'hi': 'Hindi'
  };
  return languages[code] || code;
}

// Escape HTML to prevent XSS/rendering issues
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle any messages from background if needed
  sendResponse({ success: true });
  return true;
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Cleanup on page unload to prevent memory leaks
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

console.log('[ReadSmart] Content script initialized');
