# ReadSmart AI - Testing Instructions

Complete testing guide for all features and functionality.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Verification Test](#quick-verification-test)
- [Single Article Features](#single-article-features)
- [Multi-Tab Summarization](#multi-tab-summarization)
- [Platform Support Testing](#platform-support-testing)
- [Export Functionality](#export-functionality)
- [Testing Checklist](#testing-checklist)

## Prerequisites

Before testing, ensure your environment is properly set up:

- **Chrome Dev or Canary** (Version 128+) with AI flags enabled
- **AI Model downloaded** - Check `chrome://components`
- **Extension installed** - Loaded at `chrome://extensions`

**Setup Not Complete?** See **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for detailed installation and troubleshooting.


## Quick Verification Test

**Purpose**: Verify your setup is working correctly

**Steps**:
1. Open `test-pages/test-article.html` in Chrome
2. Wait 3-5 seconds for the floating button to appear (bottom-right)
3. Click the button to open the sidebar
4. Wait for the summary to generate
5. Try asking a question in the Q&A section

**Expected Results**:
- Floating button appears within 3-5 seconds
- Sidebar opens smoothly
- Summary generates in 3-5 seconds
- Q&A responds to questions
- No errors in console

**If This Works**: Your setup is correct! Continue with full testing below.

**Troubleshooting**:
- No button appears → Check flags at `chrome://flags`
- "API not available" → Check model at `chrome://components`
- Timeout errors → Model still downloading, wait 10-15 minutes
- Console errors → Restart Chrome after enabling flags

---

## Single Article Features

### Test 1: Article Detection

**Test Sites** (in order of complexity):
1. `test-pages/test-article.html` (easiest)
2. https://en.wikipedia.org/wiki/Artificial_intelligence
3. https://techcrunch.com (any article)
4. https://medium.com (any article) - dynamic content
5. https://theguardian.com (any article)

**Steps**:
1. Open test site
2. Wait up to 5 seconds
3. Look for purple button with AI brain icon (bottom-right)

**Expected Results**:
- Button appears within 1-5 seconds
- Console shows:
  ```
  [ReadSmart] Content script loaded
  [ReadSmart] Detected platform: [platform name]
  [ReadSmart] Found content using selector: [selector]
  [ReadSmart] Article detected!
  [ReadSmart] Length: [number] characters
  [ReadSmart] Words: [number]
  [ReadSmart] Estimated reading time: [number] minutes
  ```

**If Button Doesn't Appear**:
1. Open DevTools (F12) → Console tab
2. Check for [ReadSmart] messages
3. Common issues:
   - "Page does not appear to be an article" → Content too short (< 500 chars)
   - "No article element found" → Platform not optimized, using body fallback
   - Syntax errors → Reload extension at `chrome://extensions`
   - No logs at all → Content script not injected, check manifest.json

### Test 2: Summary Generation

**Steps**:
1. Click the floating ReadSmart button
2. Sidebar slides in from right
3. Wait 3-5 seconds
4. Summary appears automatically

**Expected Results**:
- Sidebar opens smoothly
- "Generating summary..." appears with spinner
- Summary appears in 3-5 seconds
- Summary is formatted as bullet points (Key Points default)
- No HTML tags visible in summary
- Summary makes sense and captures main ideas

**Test Different Summary Types**:
1. Change type dropdown to "TL;DR"
2. Click "Regenerate Summary" button
3. New summary appears as single paragraph
4. Repeat for "Teaser" and "Headline"

**Test Different Lengths**:
1. Change length dropdown to "Short"
2. Regenerate - should be 2-3 sentences/bullets
3. Change to "Long"
4. Regenerate - should be comprehensive

**Common Issues**:
- Timeout error → AI response took > 25 seconds, try again
- "Could not generate summary" → Check API availability
- HTML tags visible → Bug, report with screenshot
- Summary is nonsense → Article content extraction failed

### Test 3: Q&A Functionality

**Steps**:
1. With sidebar open, scroll to Q&A section
2. Type a question: "What is the main idea?"
3. Press Enter or click Send button
4. Wait 2-4 seconds

**Expected Results**:
- Question appears in chat
- "AI is thinking..." message with spinner
- Answer appears in 2-4 seconds
- Answer is relevant to article content
- Can ask follow-up questions

**Test Questions**:
- "What is the main idea?"
- "Summarize this in one sentence"
- "What are the key challenges?"
- "Explain [specific concept] mentioned"
- "What does [person] say about [topic]?"

**Common Issues**:
- Timeout after 25 seconds → AI overloaded or model issue
- Generic answer not related to article → Content extraction problem
- "Prompt API not available" → Check flags, restart Chrome
- Infinite "Thinking..." → Bug fixed in v1.1, reload extension

### Test 4: Suggested Questions

**Steps**:
1. Wait for sidebar to generate suggested questions
2. Click on a suggested question
3. Verify it gets asked automatically

**Expected Results**:
- 3-5 suggested questions appear
- Questions are specific to the article (not generic)
- Clicking a question sends it to Q&A

### Test 5: Reading Stats

**Steps**:
1. Generate several summaries on different articles
2. Ask some questions
3. Check stats at bottom of sidebar

**Expected Results**:
- Articles Read increments
- Summaries Generated increments
- Questions Answered increments
- Time Saved increases (~4 min per article)

---

## Multi-Tab Summarization

### Test 1: Basic Batch Summarization

**Setup**:
1. Open 5 different articles in separate tabs:
   - Wikipedia article
   - TechCrunch article
   - Medium article
   - Any blog post
   - Any news article

**Steps**:
1. Click ReadSmart AI extension icon (toolbar)
2. Popup opens showing all tabs
3. Select 3-5 tabs using checkboxes
4. Click "Summarize X Tabs" button

**Expected Results**:
- Button changes to "Summarizing 1/5..."
- Progress updates in real-time
- After 15-25 seconds, all results appear
- Each result shows:
  - Tab title
  - Tab favicon
  - Summary (bulleted or paragraph)
- Time Saved stat increases

**Console Checks**:
```
[ReadSmart Popup] Starting batch summary for 5 tabs
[ReadSmart Popup] Batch summary started in background
[ReadSmart] Processing batch summary for 5 tabs
[ReadSmart] Summarizing tab 1 / 5 : [title]
[ReadSmart] Summarizing tab 2 / 5 : [title]
...
[ReadSmart] Batch summary completed!
```

### Test 2: Background Processing (Critical!)

**Steps**:
1. Start batch summarization (5+ tabs)
2. **Immediately click outside popup** to close it
3. Wait 10 seconds
4. Click extension icon to reopen popup

**Expected Results**:
- Processing continues after closing popup!
- Reopening shows live progress: "Summarizing 3/5..."
- Results appear when complete
- No data lost

**This Tests**:
- Background script processing
- chrome.storage.local progress tracking
- Popup polling mechanism (500ms)
- Resume capability

**Common Issues**:
- Progress resets to 0 → Bug, background processing not working
- "Select tabs again" message → State not persisting (fixed in v1.1)
- No progress shown → Check console for errors

### Test 3: State Persistence

**Steps**:
1. Select several tabs
2. Start summarization
3. Wait for completion
4. Close popup
5. Wait 30 seconds
6. Reopen popup

**Expected Results**:
- Results still displayed!
- Selected tabs still checked
- Stats still showing
- Can click "Clear" to reset

**Test Expiration** (30 minutes):
1. Follow steps above
2. Wait 30 minutes
3. Reopen popup

**Expected**:
- State cleared (too old)
- Fresh tab list
- No previous results

### Test 4: Select All / Deselect All

**Steps**:
1. Open popup
2. Click "Select All" button
3. Verify all tabs checked
4. Click "Deselect All" (button text changes)
5. Verify all unchecked

### Test 5: Error Handling

**Test with Problematic Tabs**:
1. Open tabs with:
   - Very short content (< 100 chars)
   - Non-article pages (like homepages)
   - Error pages (404)
2. Include in batch summarization

**Expected Results**:
- Error tabs show: "Could not extract enough content"
- Other tabs process normally
- Batch completes successfully
- No crashes

---

## Platform Support Testing

### Quick Platform Test

Test these platforms in order (easiest to hardest):

#### Tier 1: Static Sites
1. **Wikipedia**: https://en.wikipedia.org/wiki/Machine_learning
   - Expected: Instant detection, clean summary
2. **TechCrunch**: https://techcrunch.com (any article)
   - Expected: Detection within 2 seconds
3. **The Guardian**: https://theguardian.com (any article)
   - Expected: Clean extraction, no ads in summary

#### Tier 2: Dynamic Sites (Important!)
4. **Medium**: https://medium.com (any article)
   - Expected: Detection after 1-3 seconds (retry logic)
   - Console: Shows retry attempts
5. **Substack**: (any newsletter article)
   - Expected: Detects `.post-content` selector
   - Console: `[ReadSmart] Detected platform: substack.com`
6. **Dev.to**: https://dev.to (any article)
   - Expected: Technical articles summarize well

#### Tier 3: Developer Platforms
7. **GitHub**: https://github.com (any README)
   - Expected: Detects `.markdown-body`
8. **Stack Overflow**: (any question with long answer)
   - Expected: Summarizes question + accepted answer

### Full Platform Test

See [SUPPORTED_PLATFORMS.md](SUPPORTED_PLATFORMS.md) for complete list of 30+ platforms.

**Testing Method**:
1. Visit platform
2. Open any article
3. Check console for platform detection message
4. Verify button appears
5. Generate summary
6. Check summary quality

**Create Test Report**:
```
Platform: Medium
URL: [test URL]
Platform detected: Yes
Button appeared: Yes (2 seconds)
Summary generated: Yes (4 seconds)
Summary quality: Good
Issues: None
```

## Testing Checklist

### Basic Functionality
- [ ] Extension loads without errors
- [ ] Quick verification test passes (test-article.html works)
- [ ] Button appears on Wikipedia
- [ ] Summary generates successfully
- [ ] Q&A works
- [ ] Stats update correctly

### Advanced Features
- [ ] Multi-tab summarization works
- [ ] Background processing continues after popup close
- [ ] State persists across popup opens
- [ ] Export works (all 3 formats)
- [ ] Platform detection works (test 5+ platforms)

### Edge Cases
- [ ] Very short articles (500-1000 chars)
- [ ] Very long articles (10,000+ words)
- [ ] Dynamic content sites (Medium, Substack)
- [ ] Non-article pages (homepages, category pages)
- [ ] Error pages (404, 500)

### Bug Verification
- [ ] No HTML injection in summaries
- [ ] No infinite "Thinking..." spinner
- [ ] Translation has explicit source language
- [ ] Icons display correctly (16, 48, 128)
- [ ] No syntax errors in console

