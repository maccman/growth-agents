---
name: linkedin-login
description: Opens LinkedIn in the Cursor IDE browser so the user can log in and persist their session cookies. Use when the user needs to authenticate LinkedIn for scraping, when LinkedIn scraping fails due to login wall, or when the user says "sign in to LinkedIn", "log in to LinkedIn", or "set up LinkedIn".
---

# LinkedIn Login (Browser Setup)

Opens LinkedIn's login page in the Cursor IDE browser. Once the user logs in, the session cookie persists automatically — no further setup needed for future LinkedIn scraping tasks.

## Steps

1. **Open LinkedIn login in the browser:**

```
browser_navigate → url: https://www.linkedin.com/login, take_screenshot_afterwards: true
```

2. **Tell the user:**

> "LinkedIn is now open in the browser. Please log in with your credentials. Once you're logged in and land on the LinkedIn feed, let me know and I'll confirm the session is active."

3. **Wait for the user to confirm they've logged in**, then take a screenshot and check the URL:

```
browser_take_screenshot
```

If the URL is `https://www.linkedin.com/feed/` or any non-login LinkedIn page, the login was successful.

4. **Confirm success:**

> "You're logged in! Your LinkedIn session is now saved in the Cursor browser. Future LinkedIn scraping tasks will work automatically."

## Notes

- The Cursor browser persists cookies across sessions, so this is a one-time setup.
- If the user is redirected to a CAPTCHA or verification page, ask them to complete it and then confirm again.
- Do not attempt to fill in credentials automatically — let the user type them manually for security.
