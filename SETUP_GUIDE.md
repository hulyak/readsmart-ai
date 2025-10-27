# ReadSmart AI Setup Guide

## Q&A Feature Not Working?

If you're getting the error **"I'm unable to process this question right now"**, it means Chrome's AI APIs are not properly enabled.

## Quick Fix (5 minutes)

### Step 1: Enable Chrome Flags

1. Open a new tab and go to: `chrome://flags`

2. Search for and enable these 4 flags:

   **Required Flags:**
   ```
   #optimization-guide-on-device-model
   → Set to "Enabled BypassPerfRequirement"

   #prompt-api-for-gemini-nano
   → Set to "Enabled"

   #summarization-api-for-gemini-nano
   → Set to "Enabled"

   #translation-api
   → Set to "Enabled"
   ```

3. Click the blue **"Relaunch"** button at the bottom

### Step 2: Wait for Model Download

1. After Chrome restarts, open: `chrome://components`

2. Find **"Optimization Guide On Device Model"**

3. Status should show **"Registered"** or **"Up to date"**

4. If it shows "Not registered", click **"Check for update"**

5. **Wait 5-15 minutes** for the AI model to download (~1.5GB)
   - You can use Chrome normally during download
   - Check back periodically

### Step 3: Test ReadSmart AI

1. Reload the extension at `chrome://extensions`

2. Open: `test-pages/test-article.html`

3. Click the purple 📚 button

4. Try asking: **"What are the main AI challenges?"**

5. Should get a proper answer now! 

---

## Troubleshooting

### "Language Model not available"
- **Cause**: Prompt API flag not enabled
- **Fix**: Double-check `chrome://flags/#prompt-api-for-gemini-nano` is "Enabled"
- **Then**: Restart Chrome completely


### "Model still downloading"
- **Cause**: AI model download in progress
- **Fix**: Wait 10-15 minutes, check `chrome://components`
- **Note**: Model is ~1.5GB, takes time on slower connections

### "APIs show unavailable even after enabling"
- **Cause**: Flags not applied or Chrome version too old
- **Fix**:
  1. Make sure you clicked "Relaunch" after enabling flags
  2. Verify Chrome version is 128+ (check `chrome://version`)
  3. Try Chrome Canary: https://www.google.com/chrome/canary/

### "Summarization works but Q&A doesn't"
- **Cause**: Different APIs have different availability status
- **Fix**:
  1. Check console logs in DevTools (F12)
  2. Look for `[ReadSmart] Prompt Session Status` message
  3. Should show `promptSessionExists: true`

---

## Quick Checklist

- [ ] Opened `chrome://flags`
- [ ] Enabled all 4 required flags
- [ ] Clicked "Relaunch" button
- [ ] Waited for Chrome to restart
- [ ] Opened `chrome://components`
- [ ] Verified model is downloaded ("Registered" or "Up to date")
- [ ] Reloaded extension at `chrome://extensions`
- [ ] Tested on test-article.html
- [ ] Q&A feature now works!

---

## Expected Behavior

**When working correctly:**

1. **Summaries**: Generate in 3-5 seconds
2. **Q&A**: Respond in 2-4 seconds
3. **Console logs**: Show `[ReadSmart] Prompt API session created successfully`
4. **No errors**: No fallback messages

**Console output when working:**
```
[ReadSmart] Initializing AI Manager...
[ReadSmart] LanguageModel availability: readily
[ReadSmart] Summarizer availability: readily
[ReadSmart] Creating Prompt API session for Q&A...
[ReadSmart] Prompt API session created successfully
[ReadSmart] AI Manager initialized successfully
```

---

## Still Having Issues?

1. **Check Console**: Open DevTools (F12) → Console tab
2. **Look for errors**: Search for `[ReadSmart]` messages
3. **Check flags again**: Sometimes flags reset after updates
4. **Try Chrome Canary**: More stable AI API support
5. **Open an issue**: Include console logs and Chrome version

---

## Once Working

ReadSmart AI will:
- ✅ Detect articles automatically
- ✅ Generate summaries in seconds
- ✅ Answer questions about content
- ✅ Work 100% offline (no cloud APIs)
- ✅ Keep all data private on your device

**Enjoy faster, smarter reading!** 
