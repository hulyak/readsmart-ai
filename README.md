# ReadSmart AI

**Your AI-Powered Reading Assistant using Chrome Built-in AI (Gemini Nano)**

[![Chrome Built-in AI Challenge 2025](https://img.shields.io/badge/Chrome_Built--in_AI-Challenge_2025-4285F4?style=for-the-badge&logo=google-chrome)](https://developer.chrome.com/docs/ai/built-in)
[![Gemini Nano](https://img.shields.io/badge/Powered_by-Gemini_Nano-764ba2?style=for-the-badge)](https://deepmind.google/technologies/gemini/nano/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

## The Problem

**Information overload is overwhelming modern readers:**
- Average article takes 5-10 minutes to read
- Most people skim rather than read fully
- Over 50% of web content is in foreign languages
- Complex technical content is hard to understand
- No time to read everything that's important
- Multiple tabs open with unread articles

**Current solutions fail because:**
- They require cloud processing (privacy concerns + latency)
- They don't work offline
- They're fragmented across multiple tools
- They lack context-aware intelligence
- Limited or no Q&A capabilities
- Can't handle multiple articles at once

**ReadSmart AI solves this.**

## Solution

**ReadSmart AI** uses **Chrome's built-in AI (Gemini Nano)** to:

### Article Summaries
- **Automatic article detection** - Detects content across 30+ platforms
- **Multiple summary formats** - Key Points, TL;DR, Teaser, Headline
- **Adjustable length** - Short, Medium, or Long summaries
- **One-click generation** - Summaries in seconds
- **Works on dynamic sites** - Medium, Substack, and modern SPAs

### Q&A
- **Ask anything about the article** - AI understands context
- **Quick answers** - No need to search through text
- **Natural conversation** - Ask follow-up questions
- **Context comprehension** - Understands nuance and relationships
- **Suggested questions** - AI generates relevant questions

### Multi-Tab Summarization
- **Batch process multiple tabs** - Summarize 5, 10, or 20 tabs at once
- **Background processing** - Continues even when popup closes
- **Live progress tracking** - See real-time progress as tabs process
- **Resume on reopen** - Close and reopen popup without losing progress
- **Tab selection** - Visual checkboxes with tab previews

### Export in Multiple Formats
- **Plain Text (.txt)** - Simple, clean format
- **Markdown (.md)** - Compatible with note-taking apps
- **HTML (.html)** - Styled page ready to share
- **One-click download** - All summaries with metadata

### 30+ Platform Support
Optimized detection for:
- **Newsletters**: Substack, Ghost
- **Blogs**: Medium, Dev.to, Hashnode, WordPress, Blogger
- **News**: NYT, Guardian, BBC, CNN, Forbes, TechCrunch
- **Tech**: GitHub, Stack Overflow, ArXiv
- **Social**: Reddit, LinkedIn, Quora
- **Knowledge**: Wikipedia
- **Generic**: Any standard article page

See [SUPPORTED_PLATFORMS.md](SUPPORTED_PLATFORMS.md) for full list.

### Additional Features
- **Reading time estimates** - Know how long articles will take
- **Word count tracking** - See article length at a glance
- **Clean interface** - Modern, non-intrusive design with neural network icon
- **State persistence** - Your work is saved automatically
- **Dynamic content support** - Works with lazy-loaded content

### Privacy-First Design
- **100% local AI processing** - your data never leaves your device
- **Works offline** - read assistance even without internet
- **No external servers** - no cloud API calls
- **Zero data collection** - complete privacy guarantee
- **HTML sanitization** - Protected against XSS and injection attacks

## Chrome AI APIs Used

This extension strategically integrates **4 Chrome Built-in AI APIs**:

### 1. **Summarizer API**
**Purpose**: Generate intelligent article summaries

**Implementation**:
```javascript
const summarizer = await Summarizer.create({
  type: 'key-points',      // or 'tl;dr', 'teaser'
  format: 'plain-text',
  length: 'medium'         // or 'short', 'long'
});
const summary = await summarizer.summarize(articleContent);
```

**What it does**:
- Analyzes article structure and content
- Extracts main ideas and key points
- Generates concise, readable summaries
- Adapts to different summary types and lengths

Saves time by condensing lengthy articles into digestible summaries.

**Key Features**:
- HTML sanitization to prevent injection attacks
- 25-second timeout protection for reliable responses
- Platform-specific content extraction for 30+ sites

### 2. **Prompt API**
**Purpose**: Intelligent Q&A about article content

**Implementation**:
```javascript
const session = await LanguageModel.create({
  systemPrompt: `You are a helpful reading assistant. Answer questions about article content concisely and clearly.`
});
const answer = await session.prompt(`
  Based on this article: ${articleContent}
  Question: ${userQuestion}
  Answer:`
);
```

**What it does**:
- Answers questions about article content
- Provides explanations and clarifications
- Understands context and relationships
- Generates context-aware suggested questions

Enables active learning by allowing users to ask questions and explore topics in depth.

**Key Features**:
- Timeout protection on all AI calls (no hanging)
- Proper session management and cleanup
- Smart content truncation (3000 chars for Q&A, 5000 for summaries)

### 3. **Translator API**
**Purpose**: Multi-language article access

**Implementation**:
```javascript
// Check availability for specific language pair
const availability = await Translator.availability({
  sourceLanguage: 'en',
  targetLanguage: 'es'
});

// Create translator with download monitoring
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'es',
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Translation model download: ${Math.round(e.loaded * 100)}%`);
    });
  }
});

const translated = await translator.translate(foreignContent);
```

**What it does**:
- Translates articles between languages
- Downloads translation models on demand
- Supports multiple language pairs
- Enables cross-language reading

Provides access to foreign language content for non-native speakers.

**Key Features**:
- Explicit source language specification for reliability
- Download progress monitoring for model downloads
- Language pair validation before translation

## Technical Architecture

### File Structure
```
scam-shield-ai/
├── manifest.json              # Extension configuration (Manifest V3)
├── background/
│   └── background.js          # Service worker & batch processing
├── content/
│   ├── readsmart.js           # Article detection & UI (900+ lines)
│   └── readsmart.css          # Interface styles
├── lib/
│   └── ai-manager.js          # Chrome AI API wrapper (260 lines)
├── popup/
│   ├── popup.html             # Multi-tab summarizer UI
│   ├── popup.js               # Background processing coordination
│   └── popup.css              # Popup styling
├── icons/
│   ├── icon16.png             # Extension icons
│   ├── icon48.png
│   ├── icon128.png
│   └── readsmart-icon.svg     # Neural network icon
├── test-pages/
│   ├── test-article.html      # Testing article
├── SUPPORTED_PLATFORMS.md     # 30+ supported platforms
├── SETUP_GUIDE.md             # Detailed setup instructions
├── TESTING_INSTRUCTIONS.md    # Testing guide
└── README.md                  
```

### Key Components

**1. AI Manager** (`lib/ai-manager.js`)
- Initializes and manages all Chrome AI APIs
- Handles Gemini Nano sessions with timeout protection
- Manages API lifecycle and resource cleanup
- Provides unified interface for summarization, Q&A, and translation
- HTML escaping and sanitization for security
- Timeout wrappers for all AI calls

**2. Background Service Worker** (`background/background.js`)
- Coordinates AI operations across tabs
- Background batch processing for multi-tab summaries
- Progress tracking in chrome.storage.local
- Manages statistics (articles read, summaries generated, time saved)
- Handles message passing between components
- Tracks user reading patterns

**3. Content Script** (`content/readsmart.js`)
- Platform-specific detection for 30+ sites
- Mutation observer for dynamic content (Medium, Substack)
- Retry logic with max 5 attempts
- Intelligently detects articles on web pages
- Shows floating button with neural network icon
- Creates sliding sidebar interface
- Manages summary display and Q&A chat
- Extracts clean article text with platform-specific cleanup

**4. Multi-Tab Popup** (`popup/popup.js`)
- Background processing coordination
- Progress polling every 500ms
- State persistence across popup closes
- Multi-format export (Text, Markdown, HTML)
- Visual tab selection with checkboxes
- Live progress display
- Resume capability

## Installation & Setup

### Prerequisites

**IMPORTANT:** Chrome's built-in AI requires specific setup:

1. **Chrome Dev or Canary** (Version 128+)
   - [Download Chrome Canary](https://www.google.com/chrome/canary/)
   - [Download Chrome Dev](https://www.google.com/chrome/dev/)

2. **Enable 4 Chrome Flags** at `chrome://flags`:
   - `#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
   - `#prompt-api-for-gemini-nano` → Enabled
   - `#summarization-api-for-gemini-nano` → Enabled
   - `#translation-api` → Enabled

3. **Restart Chrome** and wait for AI model download (5-15 minutes)

4. **Verify** at `chrome://components` - "Optimization Guide On Device Model" shows "Registered"

**🚨 Having Issues?** See **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for detailed setup instructions and troubleshooting.

### Installing the Extension

1. **Clone this repository**
   ```bash
   git clone https://github.com/hulyak/readsmart-ai.git
   cd readsmart-ai
   ```

2. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `readsmart-ai` folder
   - Extension should load successfully

## User Guide

### Single Article Reading

**Automatic Detection:**
1. Open any article/blog/news page
2. Purple button with AI brain icon appears bottom-right
3. Click button → Sidebar slides in
4. Summary generates automatically in 3-5 seconds
5. Ask questions in the Q&A section

**Supported Sites:**
- ✅ All major news sites (NYT, Guardian, BBC, CNN, Forbes)
- ✅ Tech blogs (TechCrunch, Ars Technica, The Verge)
- ✅ Developer platforms (Medium, Dev.to, Hashnode, GitHub)
- ✅ Newsletters (Substack, Ghost)
- ✅ Knowledge bases (Wikipedia, Stack Overflow)
- ✅ Social platforms (Reddit, LinkedIn, Quora)

See [SUPPORTED_PLATFORMS.md](SUPPORTED_PLATFORMS.md) for full list.

### Multi-Tab Summarization

**Batch Process Multiple Tabs:**
1. Click ReadSmart AI extension icon
2. Select tabs you want to summarize (checkboxes)
3. Click "Summarize X Tabs"
4. **Close popup if you want** - processing continues in background!
5. Reopen popup anytime to see progress
6. Results appear when complete

**Features:**
- ✅ Process 5, 10, 20+ tabs at once
- ✅ Live progress: "Summarizing 3/5..."
- ✅ Continues in background
- ✅ Resume on popup reopen
- ✅ State persists for 30 minutes

### Export Summaries

**Three Format Options:**
1. Click "Export" button after summarization
2. Choose format:
   - **📄 Text (.txt)** - Plain text with titles and URLs
   - **📝 Markdown (.md)** - Formatted with links and headers
   - **🌐 HTML (.html)** - Styled page with gradient header
3. File downloads automatically

**Use Cases:**
- Note-taking apps (Notion, Obsidian)
- Sharing with colleagues
- Archiving research
- Creating reading lists

### Reading Stats

Track your productivity:
- **Selected** - Tabs currently selected
- **Articles** - Total tabs available
- **Min Saved** - Estimated time saved

## Features in Detail

### 📝 Summary Types

**Key Points** - Bulleted list (best for scanning)
- Extracts main ideas as bullet points
- Easy to scan and digest
- Useful for quick reviews

**TL;DR** - Single paragraph (quickest overview)
- One concise paragraph
- Fastest way to understand content
- Helps determine if article is worth reading

**Teaser** - Engaging preview
- Hook-style summary
- Helps decide if article is interesting
- Marketing-style presentation

### Q&A Features

**Ask Anything:**
- "What's the main argument?"
- "Explain [concept] in simple terms"
- "What are the key challenges?"
- "How does this relate to [topic]?"
- "What did [person] say about [subject]?"

**Smart Suggestions:**
AI generates context-aware questions based on article content

**Response Time:**
- 2-4 seconds per question
- Timeout protection (25 seconds max)
- Error handling with user-friendly messages

### 🌐 Translation

**How to Use:**
1. Open sidebar on foreign article
2. Click translate button
3. Select target language
4. AI translates entire article
5. Model downloads if needed (progress shown)

**Supported:**
- Major language pairs
- Download progress monitoring
- Proper error messages

## Privacy & Security

### Data Privacy

- **100% Local Processing** - All AI runs on your device
- **No Cloud Uploads** - Article content never leaves Chrome
- **No Tracking** - We don't collect any usage data
- **No External APIs** - Everything runs on Gemini Nano locally
- **Open Source** - Audit the code yourself

### Security Enhancements

- **HTML Sanitization** - All AI output is escaped to prevent XSS
- **Content Security** - CSP headers and safe rendering
- **Timeout Protection** - No infinite waits, 25-second max
- **Error Boundaries** - Graceful failure handling

### Permissions Explained

- **activeTab** - Access current tab's content to detect articles
- **storage** - Save your reading stats and state locally
- **scripting** - Inject ReadSmart interface into pages
- **tabs** - Multi-tab summarization
- **contextMenus** - Right-click summarization
- **notifications** - Optional welcome notification

**We never:**
- Upload your data to servers
- Track your reading habits externally
- Share information with third parties
- Store article content permanently

## Technical Challenges & Solutions

### Problem 1: Q&A Hanging Forever
**Issue**: `ai.promptSession.prompt()` calls hung indefinitely with no response
**Solution**: Added Promise.race() timeout wrappers (25-30 seconds) to all AI calls
```javascript
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('AI response timed out')), 25000);
});
const answer = await Promise.race([promptPromise, timeoutPromise]);
```


### Problem 2: Translation API Not Working
**Issue**: API doesn't support auto-detection, failed with generic errors
**Solution**:
- Changed to explicit source language (default 'en')
- Added language pair availability checking
- Implemented download progress monitoring
```javascript
const availability = await Translator.availability({
  sourceLanguage: 'en',
  targetLanguage: targetLang
});
```

### Problem 3: Dynamic Sites Not Detected
**Issue**: Medium, Substack loaded content after initial page load
**Solution**:
- Added MutationObserver for content changes
- Implemented retry logic (5 attempts)
- Platform-specific selectors for 30+ sites

### Problem 4: Multi-Tab Popup Closing
**Issue**: Clicking outside popup stopped batch summarization
**Solution**:
- Moved processing to background script
- Used chrome.storage.local for progress tracking
- Popup polls every 500ms for updates
- Resume capability when reopening

### Problem 5: Generic Suggested Questions
**Issue**: AI generated same generic questions ("What's the main idea?", "What are the implications?") for every article instead of content-specific questions
**Root Cause**:
- Gemini Nano requires explicit, example-driven prompts
- No system prompt defining the AI's role
- Zero-shot prompting without examples
- Reusing general session instead of task-specific one

**Solution**:
- Created dedicated session with system prompt for question generation
- Added few-shot examples showing good vs bad questions
- Included negative constraints (what NOT to generate)
- Implemented quality checks to reject generic questions
- Used LanguageModel API directly in service worker context

```javascript
// Create dedicated session with system prompt
const questionSession = await LanguageModel.create({
  initialPrompts: [{
    role: 'system',
    content: `You are a reading comprehension expert who generates specific, content-based questions.

FORBIDDEN (DO NOT generate):
- Generic questions like "What's the main idea?"
- Questions that could apply to any article`
  }]
});

// Include few-shot examples in prompt
const prompt = `Article: "${title}"
Content: ${content}

Examples of content-specific questions:
For "Tesla announces Cybertruck in Austin":
✓ GOOD: "In which city will Tesla produce the Cybertruck?"
✗ BAD: "What are the implications?"

Generate 5 specific questions about THIS article...`;

// Quality check before accepting
const genericCount = questions.filter(q =>
  /what's the main idea|what are the implications/i.test(q)
).length;

if (genericCount < 2) {
  // Accept questions
} else {
  // Use fallback
}
```

**Key Insight**: Gemini Nano is better at following examples rather than following instructions alone.

## Troubleshooting

**Setup Issues?** See [SETUP_GUIDE.md](SETUP_GUIDE.md) for installation and API setup troubleshooting.

**Testing Issues?** See [TESTING_INSTRUCTIONS.md](TESTING_INSTRUCTIONS.md) for detailed testing troubleshooting.

**Common Issues:**

**Button doesn't appear:**
- Check if page has 500+ characters
- Open DevTools (F12) → Console → Look for `[ReadSmart]` logs
- Try reloading page (content may load dynamically)

**"Could not generate summary":**
- See [SETUP_GUIDE.md](SETUP_GUIDE.md) to verify Chrome AI APIs are enabled
- Try reloading the extension at `chrome://extensions`

**Multi-tab summarization stops:**
- Check console for errors
- Try with fewer tabs (start with 3-5)

## Development

### Adding New Platform Support

1. Open `content/readsmart.js`
2. Add platform to `platformSelectors` object:
```javascript
'example.com': ['.article', '.content', 'main']
```
3. Test on actual site
4. Add cleanup selectors if needed

### Testing Changes

```bash
# 1. Make changes to code
# 2. Go to chrome://extensions
# 3. Click reload button on ReadSmart AI
# 4. Test on target site
# 5. Check console for [ReadSmart] logs
```


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
