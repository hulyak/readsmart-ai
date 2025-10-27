# ReadSmart AI - Supported Platforms

ReadSmart AI now intelligently detects and works on **30+ popular platforms** including:

## News & Media
- **The New York Times** - nytimes.com
- **The Guardian** - theguardian.com
- **BBC** - bbc.com
- **CNN** - cnn.com
- **Forbes** - forbes.com

## Tech & Developer Platforms
- **Medium** - medium.com
- **Dev.to** - dev.to
- **Hashnode** - hashnode.dev, hashnode.com
- **TechCrunch** - techcrunch.com
- **Hacker News** - news.ycombinator.com

## Newsletter Platforms
- **Substack** - substack.com (all newsletters!)
- **Ghost** - ghost.io (any Ghost-powered blog)

## Blogging Platforms
- **WordPress** - wordpress.com
- **Blogger** - blogspot.com
- **Ghost** - ghost.io

## Knowledge & Q&A
- **Wikipedia** - wikipedia.org
- **Stack Overflow** - stackoverflow.com
- **Quora** - quora.com

## Developer Resources
- **GitHub** - github.com (README files, wikis, discussions)
- **ArXiv** - arxiv.org (research papers)

## Social & Professional
- **LinkedIn** - linkedin.com (articles)
- **Reddit** - reddit.com (posts)

## Documentation & Notes
- **Notion** - notion.site (public pages)

## Generic Support
Works on **ANY website** with article content using:
- Standard HTML5 `<article>` tags
- Common class names like `.article-content`, `.post-content`, `.entry-content`
- Semantic HTML with `role="article"` or `role="main"`

## How It Works

1. **Platform Detection**: ReadSmart automatically identifies which platform you're on
2. **Smart Content Extraction**: Uses platform-specific selectors to find article content
3. **Clean Text Processing**: Removes ads, comments, sidebars, and other clutter
4. **AI Processing**: Sends only the main article content to Chrome's built-in AI

## Minimum Requirements

- Article must be at least **500 characters** long
- Content must be readable text (not just images or videos)

## Console Logging

Open DevTools Console to see:
```
[ReadSmart] Detected platform: substack.com
[ReadSmart] Found content using selector: .post-content
[ReadSmart] Article detected!
[ReadSmart] Length: 5432 words: 890
[ReadSmart] Estimated reading time: 5 minutes
```

This helps you understand how ReadSmart detected your article!
