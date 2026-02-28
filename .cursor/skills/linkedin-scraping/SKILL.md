---
name: linkedin-scraping
description: Scrape LinkedIn profiles and company pages. Use when the user wants to extract data from a LinkedIn profile or company page, look up someone on LinkedIn, or enrich a lead with LinkedIn data.
---

# Scraping LinkedIn

LinkedIn blocks unauthenticated scrapers. Use the methods below in order of preference.

## Method 1: WebFetch (fastest, free)

Try this first — no credits needed.

```
WebFetch: https://www.linkedin.com/in/<handle>/
```

Returns name, headline, about, full experience, education, skills, certifications, and recent activity.

## Method 2: cursor-ide-browser MCP (visual/interactive)

Use when you need to scroll, screenshot, or interact with the page.

```
browser_navigate → url: https://www.linkedin.com/in/<handle>/, take_screenshot_afterwards: true
browser_lock
browser_scroll → ref: <element ref>, scrollIntoView: true   # use browser_snapshot to find refs
browser_take_screenshot
browser_unlock
```

Always `browser_lock` before interacting, `browser_unlock` when done.

## Method 3: Firecrawl browser (if credits available)

Check credits first with `firecrawl --status`. Skip if credits are negative.

```bash
firecrawl browser "open https://www.linkedin.com/in/<handle>/"
firecrawl browser "scrape" -o .firecrawl/linkedin-<handle>.md
firecrawl browser close
```

Use `firecrawl browser` (not `firecrawl scrape`) — LinkedIn requires browser automation.

## First-Time Setup

If scraping returns a login wall, use the `linkedin-login` skill to authenticate the Cursor browser first. This is a one-time step.

## Notes

- All methods rely on the user's existing LinkedIn session cookies — never handle credentials in code.
- Company pages (`/company/<slug>/`) work the same way as profiles.
