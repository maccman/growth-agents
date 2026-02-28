# Setup Gmail & Google Calendar

When the user triggers this command, walk them through setting up Gmail and Google Calendar API access using OAuth 2.0. Run each automated step immediately — don't wait to be asked. Speak in plain, friendly language. Pause for user input only when explicitly noted.

## Overview

This sets up a Google Cloud project with OAuth 2.0 credentials so agents can read Gmail and Google Calendar on behalf of the user. It installs two things:

1. **`googleapis` npm package** — for use inside TypeScript agent scripts
2. **`gogcli`** ([github.com/steipete/gogcli](https://github.com/steipete/gogcli)) — a powerful command-line tool (`gog`) for Gmail, Calendar, Drive, Sheets, Tasks, Contacts, and more, with JSON output for scripting

Both share the same OAuth credentials, so the user only goes through the browser consent flow once. At the end, tokens are saved to `.env` and smoke tests confirm everything works.

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

## Step 3 — Create a Google Cloud Project

Generate a unique project ID and create the project:

```bash
PROJECT_ID="growth-agents-$(date +%s | tail -c 8)"
gcloud projects create "$PROJECT_ID" --name="Growth Agents" 2>&1
gcloud config set project "$PROJECT_ID"
echo "Project ID: $PROJECT_ID"
```

Save the project ID — you'll use it to build console URLs and to identify the credentials file later.

> **Ignore the "environment tag" warning** — Google prints a suggestion to tag the project with a production/dev label. It's harmless and doesn't affect anything.

> **If you get a quota error ("project limit reached")**, the user needs to delete an unused project at [console.cloud.google.com/cloud-resource-manager](https://console.cloud.google.com/cloud-resource-manager) first.

Also capture the **project number** — it appears in the output as a long integer (e.g. `943332063572`). You'll use it to identify the correct credentials JSON file in Step 7.

---

## Step 4 — Enable Gmail and Calendar APIs

Enable both in one command:

```bash
gcloud services enable gmail.googleapis.com calendar-json.googleapis.com
```

This takes a few seconds and completes silently on success.

---

## Step 5 — Set Up OAuth Consent Screen (in browser)

This step requires the Cloud Console UI. Tell the user:

> "Now I need you to do a few quick clicks in the Google Cloud Console. I'll guide you through each one — it takes about 2 minutes."

Walk them through these steps one at a time, waiting for confirmation after each:

1. Open: `https://console.cloud.google.com/apis/credentials/consent?project=PROJECT_ID` (substitute the actual project ID)
2. Select **"External"** for User Type → click **Create**
3. Fill in the form:
   - **App name:** `Growth Agents`
   - **User support email:** their Google email
   - **Developer contact email:** their Google email
   - Leave everything else blank
   - Click **Save and Continue**
4. On the **Scopes** page — click **Save and Continue** (no scopes to add here; the app will request them at runtime)
5. On the **Test Users** page — click **+ Add Users**, enter their Google email address, click **Add** → then **Save and Continue**
6. On the **Summary** page — click **Back to Dashboard**

Tell the user to confirm when they're back at the dashboard.

---

## Step 6 — Create OAuth 2.0 Client Credentials (in browser)

> "One more set of clicks to create the credentials."

Walk them through:

1. Open: `https://console.cloud.google.com/apis/credentials/oauthclient?project=PROJECT_ID` (substitute the actual project ID)
2. For **Application type** select **"Desktop app"** (not Web application — Desktop app is needed for `gogcli` and also works for local scripts)
3. **Name:** `Growth Agents`
4. Click **Create**
5. In the dialog that appears, click **"Download JSON"** to save the credentials file to `~/Downloads/`. It will be named something like `client_secret_PROJECTNUMBER-XXXX.apps.googleusercontent.com.json`
6. Click **OK** to close the dialog

> **Keep the JSON file outside the repo** (leaving it in `~/Downloads/` is fine). Never commit it to git.

Tell the user to confirm when they've downloaded the file.

---

## Step 7 — Extract Credentials from the JSON File

You don't need the user to copy/paste anything. Find and read the credentials file directly:

```bash
ls ~/Downloads/client_secret_*.json
```

If there are multiple files, pick the one that contains the **project number** captured in Step 3 (e.g. a file containing `943332063572` in its name is the one we just created).

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

Now write everything to `.env` (create or update the Google section):

```
# Google APIs (Gmail & Calendar)
GOOGLE_PROJECT_ID=<project ID from Step 3>
GOOGLE_CLIENT_ID=<extracted client_id>
GOOGLE_CLIENT_SECRET=<extracted client_secret>
GOOGLE_CREDENTIALS_PATH=<full path to the downloaded JSON file>
GOOGLE_REDIRECT_URI=http://localhost:8080/oauth2callback
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
GOOGLE_TOKEN_EXPIRY=
GOOGLE_AUTH_EMAIL=
```

No need to ask the user for any values — get everything from the JSON file and Step 3.

---

## Step 8 — Install the googleapis package

```bash
pnpm add googleapis
```

---

## Step 9 — Create the OAuth Token Exchange Script

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

## Step 10 — Run the OAuth Token Exchange

```bash
pnpm start scripts/google-oauth-setup.ts
```

This opens a browser window requesting Gmail and Calendar read access. After the user clicks **Allow**, the script captures the auth code automatically via the local server, exchanges it for tokens, and writes them to `.env`. Tell the user to watch for the "✅ Authorization successful!" page in the browser tab, then return to the terminal.

Wait for the script to print "🎉 OAuth setup complete!" before continuing.

---

## Step 11 — Install gogcli

[`gogcli`](https://github.com/steipete/gogcli) is a fast, script-friendly CLI (`gog`) that covers Gmail, Calendar, Drive, Sheets, Tasks, Contacts, Chat, and more. It uses JSON-first output, making it great for piping into agents.

```bash
brew install steipete/tap/gogcli
```

Verify it installed:

```bash
gog --version
```

---

## Step 12 — Connect gogcli to the OAuth credentials

Use the credentials JSON path from `GOOGLE_CREDENTIALS_PATH` in `.env`:

```bash
gog auth credentials "$GOOGLE_CREDENTIALS_PATH"
```

Or use the full path directly (read it from `.env` if the variable isn't exported). This stores the credentials in gogcli's own secure config directory — not the repo.

---

## Step 13 — Authorize gogcli

```bash
gog auth add <their-email>
```

Use the email from `GOOGLE_AUTH_EMAIL` in `.env`.

This opens the browser for a second OAuth consent. **gogcli requests broad scopes upfront** (Gmail, Calendar, Drive, Sheets, Tasks, Contacts, etc.) — the user may ask "is this safe?". Reassure them:

> "Yes — gogcli is open source and the token is stored only in your macOS Keychain. Nothing is sent to any server other than Google's own APIs. It requests broad scopes upfront so you don't need to re-authorize for each service later. Since this is your own account on your own Mac, it's fine."

After the user clicks **Allow** in the browser, gogcli will print a confirmation showing the authorized email and services. Wait for it to complete.

Then immediately set the account as the default in the current shell session:

```bash
export GOG_ACCOUNT=<their-email>
```

And persist it to their shell profile:

```bash
echo 'export GOG_ACCOUNT=<their-email>' >> ~/.zshrc
```

---

## Step 14 — Smoke-test gogcli

```bash
gog gmail search 'newer_than:1d' --max 5
gog calendar events primary --today
```

**Expected:** A table of email threads and a list of today's calendar events.

**Troubleshooting:**
- `no credentials found` — re-run `gog auth credentials <path>`
- `token has been expired or revoked` — re-run `gog auth add <email>`
- `permission denied` / `403` — an API isn't enabled. Re-run:
  ```bash
  gcloud services enable gmail.googleapis.com calendar-json.googleapis.com
  ```
- `account not added as test user` — go back to Step 5 and confirm the email is listed under Test Users

---

## Step 15 — Create the TypeScript Smoke Test Script

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

## Step 16 — Run the TypeScript Smoke Test

```bash
pnpm start scripts/google-smoke-test.ts
```

**Expected output:** The authenticated email, followed by 5 Gmail subject lines and up to 10 upcoming calendar events.

**Troubleshooting:**
- `invalid_grant` — the OAuth flow timed out or the account isn't added as a test user. Re-run `pnpm start scripts/google-oauth-setup.ts` to get fresh tokens.
- `Access Not Configured` — an API isn't enabled. Re-run Step 4.
- `insufficient authentication scopes` — re-run `pnpm start scripts/google-oauth-setup.ts` (the `prompt: 'consent'` flag forces re-authorization with the full scope set).

---

## Finish

Once both smoke tests pass (gogcli in Step 14, TypeScript in Step 16), let the user know they're all set.

> **Note:** `.env` is gitignored, so there's nothing to commit at the end of this setup — that's expected and correct. The credentials live only on this machine.

**`gog` CLI — quick reference for everyday use:**

```bash
# Gmail
gog gmail search 'from:boss@example.com newer_than:7d'
gog gmail search 'is:unread' --max 20 --json | jq '.threads[].snippet'
gog gmail thread get <threadId>

# Calendar
gog calendar events primary --today
gog calendar events primary --week
gog calendar search "standup" --days 30

# Drive
gog drive search "Q4 report"
gog drive download <fileId> --out ./file.pdf

# Tasks
gog tasks lists
gog tasks list <tasklistId>
```

**What they now have:**
- `gog` CLI for interactive use and shell scripting against all Google Workspace APIs, with token stored securely in macOS Keychain
- `googleapis` npm package for TypeScript agent scripts, with tokens in `.env` that auto-refresh
- Both tools share the same OAuth app — only one Cloud project to manage
- To expand access later (e.g. send email, edit calendar): `gog auth add <email> --services gmail,calendar --force-consent`
