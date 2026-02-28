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
