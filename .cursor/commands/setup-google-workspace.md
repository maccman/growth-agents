# Setup Google Workspace

This command sets up Google Workspace API access by installing the `gws` CLI and the `googleapis` npm package for TypeScript agent scripts.

> **Steps 1-4 MUST be run by the user in a real Terminal window, NOT from inside Cursor.** The `gws` auth flow is highly interactive (opens browsers, requires terminal input) and cannot be automated.

---

## Step 1 — Install gws

Tell the user to open **Terminal** and run:

```bash
npm install -g @googleworkspace/cli
```

Verify:

```bash
gws --version
```

---

## Step 2 — Run gws auth setup

**This step is interactive and MUST be done in Terminal, not from Cursor.**

### If `gcloud` is installed:

Tell the user to run:

```bash
gws auth setup
```

This single command handles everything:
- Creates a GCP project
- Enables required APIs
- Configures OAuth consent screen
- Logs you in via browser

### If `gcloud` is NOT installed:

Two options:

1. **Install gcloud first** — `brew install --cask google-cloud-sdk`, then run `gws auth setup` as above.
2. **Manual path** — Create a project in [Cloud Console](https://console.cloud.google.com/), configure OAuth consent screen, create a Desktop OAuth client, download the client JSON to `~/.config/gws/client_secret.json`, then run:
   ```bash
   gws auth login
   ```

Credentials are stored encrypted in the OS keychain (`~/.config/gws/`).

---

## Step 3 — Scope warning

Unverified apps (testing mode) are limited to ~25 OAuth scopes. Instead of accepting the broad default scope set, use the `--scopes` flag to request only what you need:

```bash
gws auth login --scopes drive,gmail,calendar
```

Tell the user to keep their scope list minimal to stay under the limit.

---

## Step 4 — Verify gws

Smoke-test in Terminal:

```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 5}'
gws calendar events list --params '{"calendarId": "primary"}'
```

**Expected:** JSON output with email message IDs and calendar events.

**Troubleshooting:**
- Auth issues — re-run `gws auth login`
- `permission denied` / `403` — an API isn't enabled; re-run `gws auth setup` or enable manually in Cloud Console
- `account not added as test user` — add your email under OAuth consent screen > Test Users in Cloud Console

---

## Step 5 — googleapis for TypeScript

The `gws` CLI and the `googleapis` TypeScript SDK use **separate auth**. The TypeScript scripts need OAuth client credentials stored in `.env`.

### 5a — Install googleapis

```bash
pnpm add googleapis
```

### 5b — Create OAuth client credentials

Use the GCP project that `gws auth setup` created. Walk the user through the Cloud Console:

1. Open the [Credentials page](https://console.cloud.google.com/apis/credentials) for the project
2. Click **+ Create Credentials** > **OAuth client ID**
3. Application type: **Desktop app**, Name: any name
4. Click **Create**, then **Download JSON**

> Keep the JSON file outside the repo (e.g. `~/Downloads/`). Never commit it.

### 5c — Extract credentials to .env

Find and read the downloaded JSON:

```bash
ls ~/Downloads/client_secret_*.json
```

Extract client ID and secret:

```bash
python3 -c "
import json, sys
with open('PATH_TO_JSON') as f:
    d = json.load(f)['installed']
print('CLIENT_ID:', d['client_id'])
print('CLIENT_SECRET:', d['client_secret'])
"
```

Write to `.env`:

```
# Google APIs (Gmail & Calendar)
GOOGLE_PROJECT_ID=<project ID from gws auth setup>
GOOGLE_CLIENT_ID=<extracted client_id>
GOOGLE_CLIENT_SECRET=<extracted client_secret>
GOOGLE_CREDENTIALS_PATH=<full path to the downloaded JSON file>
GOOGLE_REDIRECT_URI=http://localhost:8080/oauth2callback
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
GOOGLE_TOKEN_EXPIRY=
GOOGLE_AUTH_EMAIL=
```

### 5d — Create the OAuth token exchange script

Create `scripts/google-oauth-setup.ts` if it doesn't already exist:

```typescript
import { config } from 'dotenv'
import { google } from 'googleapis'
import http from 'http'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REDIRECT_URI = 'http://localhost:8080/oauth2callback'
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
]

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env first')
    process.exit(1)
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  console.log('Opening browser for Google authorization...')
  console.log('If the browser does not open automatically, visit this URL:')
  console.log(authUrl)
  console.log('')

  exec(`open "${authUrl}"`)

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return
      const url = new URL(req.url, 'http://localhost:8080')
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end(`<h1>Authorization failed: ${error}</h1><p>You can close this tab.</p>`)
        server.close()
        reject(new Error(`OAuth error: ${error}`))
        return
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>',
        )
        server.close()
        resolve(code)
      }
    })

    server.on('error', reject)
    server.listen(8080, () => {
      console.log('Waiting for authorization on http://localhost:8080 ...')
    })
  })

  console.log('Authorization code received. Exchanging for tokens...')

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: userInfo } = await oauth2.userinfo.get()

  console.log(`Authenticated as: ${userInfo.email}`)

  const envPath = path.join(__dirname, '..', '.env')
  let envContent = fs.readFileSync(envPath, 'utf-8')

  const updates: Record<string, string> = {
    GOOGLE_ACCESS_TOKEN: tokens.access_token ?? '',
    GOOGLE_REFRESH_TOKEN: tokens.refresh_token ?? '',
    GOOGLE_TOKEN_EXPIRY: String(tokens.expiry_date ?? ''),
    GOOGLE_AUTH_EMAIL: userInfo.email ?? '',
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`)
    } else {
      envContent += `\n${key}=${value}`
    }
  }

  fs.writeFileSync(envPath, envContent)

  console.log('')
  console.log('Tokens saved to .env:')
  console.log('   GOOGLE_ACCESS_TOKEN  done')
  console.log('   GOOGLE_REFRESH_TOKEN done')
  console.log('   GOOGLE_TOKEN_EXPIRY  done')
  console.log('   GOOGLE_AUTH_EMAIL   ', userInfo.email)
  console.log('')
  console.log('OAuth setup complete! Run the smoke test:')
  console.log('   pnpm start scripts/google-smoke-test.ts')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
```

### 5e — Run the OAuth token exchange

```bash
pnpm start scripts/google-oauth-setup.ts
```

This opens a browser for Google sign-in. After the user clicks **Allow**, tokens are written to `.env`.

### 5f — Create and run the TypeScript smoke test

Create `scripts/google-smoke-test.ts` if it doesn't already exist:

```typescript
import { config } from 'dotenv'
import { google } from 'googleapis'

config()

async function main() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  )

  oauth2Client.setCredentials({
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    expiry_date: process.env.GOOGLE_TOKEN_EXPIRY
      ? parseInt(process.env.GOOGLE_TOKEN_EXPIRY)
      : undefined,
  })

  console.log(`Authenticated as: ${process.env.GOOGLE_AUTH_EMAIL}\n`)

  // --- Gmail ---
  console.log('Gmail — 5 most recent emails:\n')
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const { data: listData } = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 5,
  })

  if (listData.messages?.length) {
    for (const msg of listData.messages) {
      const { data: full } = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      })
      const headers = full.payload?.headers ?? []
      const subject = headers.find(h => h.name === 'Subject')?.value ?? '(no subject)'
      const from = headers.find(h => h.name === 'From')?.value ?? '(unknown)'
      const date = headers.find(h => h.name === 'Date')?.value ?? ''
      console.log(`  Subject : ${subject}`)
      console.log(`  From    : ${from}`)
      console.log(`  Date    : ${date}`)
      console.log()
    }
  } else {
    console.log('  No messages found.\n')
  }

  // --- Calendar ---
  console.log('Google Calendar — next 7 days:\n')
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const now = new Date()
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: calData } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: oneWeekLater.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  })

  if (calData.items?.length) {
    for (const event of calData.items) {
      const start = event.start?.dateTime ?? event.start?.date ?? 'all-day'
      console.log(`  ${event.summary ?? '(no title)'}`)
      console.log(`  When: ${start}`)
      console.log()
    }
  } else {
    console.log('  No upcoming events in the next 7 days.\n')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
```

Run it:

```bash
pnpm start scripts/google-smoke-test.ts
```

**Expected:** The authenticated email, followed by Gmail subjects and upcoming calendar events.

**Troubleshooting:**
- `invalid_grant` — re-run `pnpm start scripts/google-oauth-setup.ts` for fresh tokens
- `Access Not Configured` — enable the API in Cloud Console
- `insufficient authentication scopes` — re-run the OAuth setup script

---

## Finish

Once both smoke tests pass (gws in Step 4, TypeScript in Step 5f), the user is all set.

> `.env` is gitignored — nothing to commit. Credentials live only on this machine.

For subsequent `gws` logins: `gws auth login`

---

## Quick reference — gws commands

```bash
# Gmail
gws gmail users messages list --params '{"userId": "me", "maxResults": 10, "q": "from:boss@example.com newer_than:7d"}'
gws gmail users messages list --params '{"userId": "me", "maxResults": 20, "q": "is:unread"}'
gws gmail users messages get --params '{"userId": "me", "id": "<messageId>"}'

# Calendar
gws calendar events list --params '{"calendarId": "primary", "maxResults": 10}'
gws calendar events list --params '{"calendarId": "primary", "q": "standup", "maxResults": 50}'

# Drive
gws drive files list --params '{"q": "name contains '\''Q4 report'\''", "pageSize": 10}'
gws drive files get --params '{"fileId": "<fileId>", "alt": "media"}' > ./file.pdf

# Tasks
gws tasks tasklists list
gws tasks tasks list --params '{"tasklist": "<tasklistId>"}'
```
