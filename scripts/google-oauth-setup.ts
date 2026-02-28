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
