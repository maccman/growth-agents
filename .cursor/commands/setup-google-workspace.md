# Setup Gmail & Google Calendar

When the user triggers this command, walk them through setting up Gmail and Google Calendar API access using OAuth 2.0. Run each automated step immediately — don't wait to be asked. Speak in plain, friendly language. Pause for user input only when explicitly noted.

## Overview

This sets up Google Workspace API access so agents can read Gmail, Calendar, Drive, and more on behalf of the user. It installs two things:

1. **`googleapis` npm package** — for use inside TypeScript agent scripts
2. **`gws`** ([github.com/googleworkspace/cli](https://github.com/googleworkspace/cli)) — the official Google Workspace CLI (`@googleworkspace/cli` on npm) for Gmail, Calendar, Drive, Sheets, Tasks, Contacts, and more, with structured JSON output

Both use the same GCP project. At the end, tokens are saved to `.env` for TypeScript scripts and `gws` has its own auth — smoke tests confirm everything works.

---

## Step 1 — Install the Google Cloud CLI

Check if it's already installed:

```bash
gcloud --version
```

If not installed, install it via Homebrew:

```bash
brew install --cask google-cloud-sdk
```

After installing, verify it's available. If `gcloud` isn't on the PATH, tell the user to restart their terminal and re-trigger this command.

---

## Step 2 — Authenticate with Google

First check if already authenticated:

```bash
gcloud auth list
```

If an account is already listed with a `*` (active), ask the user if that's the Google account they want to use for Gmail and Calendar. If yes, skip the login step.

If not authenticated (or they want a different account):

```bash
gcloud auth login
```

This opens the browser for Google sign-in. Tell the user to log in with the Google account whose Gmail and Calendar they want to access. Wait for them to confirm before continuing.

---

## Step 3 — Install the gws CLI

Install the official Google Workspace CLI:

```bash
npm install -g @googleworkspace/cli
```

Verify it installed:

```bash
gws --version
```

---

## Step 4 — Set up gws auth (project creation + OAuth)

`gws auth setup` handles creating a GCP project, enabling APIs, configuring OAuth consent, and authorizing — all in one command. If `gcloud` is available and authenticated (from Steps 1-2), it can automate the entire flow.

```bash
gws auth setup
```

Walk the user through the interactive prompts. This replaces the manual Cloud Console steps for project creation, API enablement, and OAuth consent screen configuration.

Once complete, `gws` is authenticated and ready to use.

> **Note:** Save the GCP project ID that `gws auth setup` creates or uses — you'll need it for the TypeScript OAuth credentials in the next steps.

---

## Step 5 — Create OAuth 2.0 Client Credentials (for TypeScript scripts)

The `gws` CLI has its own auth, but the `googleapis` TypeScript SDK needs separate OAuth client credentials stored in `.env`.

If `gws auth setup` already created a project, use that project. Otherwise, create one:

```bash
PROJECT_ID="growth-agents-$(date +%s | tail -c 8)"
gcloud projects create "$PROJECT_ID" --name="Growth Agents" 2>&1
gcloud config set project "$PROJECT_ID"
```

Enable the APIs needed for TypeScript scripts:

```bash
gcloud services enable gmail.googleapis.com calendar-json.googleapis.com
```

Then walk the user through creating OAuth client credentials in the Cloud Console:

1. Open: `https://console.cloud.google.com/apis/credentials/consent?project=PROJECT_ID` (substitute the actual project ID)
2. Select **"External"** for User Type → click **Create**
3. Fill in the form:
   - **App name:** `Growth Agents`
   - **User support email:** their Google email
   - **Developer contact email:** their Google email
   - Leave everything else blank
   - Click **Save and Continue**
4. On the **Scopes** page — click **Save and Continue**
5. On the **Test Users** page — click **+ Add Users**, enter their Google email address, click **Add** → then **Save and Continue**
6. On the **Summary** page — click **Back to Dashboard**

Then create the credentials:

1. Open: `https://console.cloud.google.com/apis/credentials/oauthclient?project=PROJECT_ID`
2. For **Application type** select **"Desktop app"**
3. **Name:** `Growth Agents`
4. Click **Create**
5. Click **"Download JSON"** to save the credentials file to `~/Downloads/`
6. Click **OK** to close the dialog

> **Keep the JSON file outside the repo** (leaving it in `~/Downloads/` is fine). Never commit it to git.

---

## Step 6 — Extract Credentials from the JSON File

Find and read the credentials file:

```bash
ls ~/Downloads/client_secret_*.json
```

If there are multiple files, pick the one for the project created in Step 5.

Then extract the client ID and secret:

```bash
python3 -c "
import json, sys
with open('PATH_TO_JSON') as f:
    d = json.load(f)['installed']
print('CLIENT_ID:', d['client_id'])
print('CLIENT_SECRET:', d['client_secret'])
"
```

Write everything to `.env` (create or update the Google section):

```
# Google APIs (Gmail & Calendar)
GOOGLE_PROJECT_ID=<project ID>
GOOGLE_CLIENT_ID=<extracted client_id>
GOOGLE_CLIENT_SECRET=<extracted client_secret>
GOOGLE_CREDENTIALS_PATH=<full path to the downloaded JSON file>
GOOGLE_REDIRECT_URI=http://localhost:8080/oauth2callback
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
GOOGLE_TOKEN_EXPIRY=
GOOGLE_AUTH_EMAIL=
```

No need to ask the user for any values — get everything from the JSON file and Step 5.

---

## Step 7 — Install the googleapis package

```bash
pnpm add googleapis
```

---

## Step 8 — Create the OAuth Token Exchange Script

Create the file `scripts/google-oauth-setup.ts` if it doesn't already exist:

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
    console.error('❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env first')
    process.exit(1)
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  })

  console.log('🔐 Opening browser for Google authorization...')
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
          '<h1>✅ Authorization successful!</h1><p>You can close this tab and return to the terminal.</p>',
        )
        server.close()
        resolve(code)
      }
    })

    server.on('error', reject)
    server.listen(8080, () => {
      console.log('⏳ Waiting for authorization on http://localhost:8080 ...')
    })
  })

  console.log('✅ Authorization code received. Exchanging for tokens...')

  const { tokens } = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens)

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const { data: userInfo } = await oauth2.userinfo.get()

  console.log(`✅ Authenticated as: ${userInfo.email}`)

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
  console.log('✅ Tokens saved to .env:')
  console.log('   GOOGLE_ACCESS_TOKEN  ✓')
  console.log('   GOOGLE_REFRESH_TOKEN ✓')
  console.log('   GOOGLE_TOKEN_EXPIRY  ✓')
  console.log('   GOOGLE_AUTH_EMAIL   ', userInfo.email)
  console.log('')
  console.log('🎉 OAuth setup complete! Run the smoke test:')
  console.log('   pnpm start scripts/google-smoke-test.ts')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
```

---

## Step 9 — Run the OAuth Token Exchange

```bash
pnpm start scripts/google-oauth-setup.ts
```

This opens a browser window requesting Gmail and Calendar read access. After the user clicks **Allow**, the script captures the auth code automatically via the local server, exchanges it for tokens, and writes them to `.env`. Tell the user to watch for the "✅ Authorization successful!" page in the browser tab, then return to the terminal.

Wait for the script to print "🎉 OAuth setup complete!" before continuing.

---

## Step 10 — Smoke-test gws

```bash
gws gmail users messages list --params '{"userId": "me", "maxResults": 5}'
gws calendar events list --params '{"calendarId": "primary", "timeMin": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", "maxResults": 5}'
```

**Expected:** JSON output with email message IDs and a list of upcoming calendar events.

**Troubleshooting:**
- Auth issues — re-run `gws auth login` or `gws auth setup`
- `permission denied` / `403` — an API isn't enabled. Re-run:
  ```bash
  gcloud services enable gmail.googleapis.com calendar-json.googleapis.com
  ```
- `account not added as test user` — go back to Step 5 and confirm the email is listed under Test Users

---

## Step 11 — Create the TypeScript Smoke Test Script

Create the file `scripts/google-smoke-test.ts` if it doesn't already exist:

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

  console.log(`🔑 Authenticated as: ${process.env.GOOGLE_AUTH_EMAIL}\n`)

  // --- Gmail ---
  console.log('📧 Gmail — 5 most recent emails:\n')
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
  console.log('📅 Google Calendar — next 7 days:\n')
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

---

## Step 12 — Run the TypeScript Smoke Test

```bash
pnpm start scripts/google-smoke-test.ts
```

**Expected output:** The authenticated email, followed by 5 Gmail subject lines and up to 10 upcoming calendar events.

**Troubleshooting:**
- `invalid_grant` — the OAuth flow timed out or the account isn't added as a test user. Re-run `pnpm start scripts/google-oauth-setup.ts` to get fresh tokens.
- `Access Not Configured` — an API isn't enabled. Re-run Step 5 API enablement.
- `insufficient authentication scopes` — re-run `pnpm start scripts/google-oauth-setup.ts` (the `prompt: 'consent'` flag forces re-authorization with the full scope set).

---

## Finish

Once both smoke tests pass (gws in Step 10, TypeScript in Step 12), let the user know they're all set.

> **Note:** `.env` is gitignored, so there's nothing to commit at the end of this setup — that's expected and correct. The credentials live only on this machine.

**`gws` CLI — quick reference for everyday use:**

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

**What they now have:**
- `gws` CLI (official Google Workspace CLI from github.com/googleworkspace/cli) for interactive use and shell scripting against all Google Workspace APIs
- `googleapis` npm package for TypeScript agent scripts, with tokens in `.env` that auto-refresh
- Both tools use the same GCP project — only one Cloud project to manage
- For subsequent logins: `gws auth login`
