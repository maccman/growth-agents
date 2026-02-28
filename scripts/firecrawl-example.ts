import { config } from 'dotenv'
import { Firecrawl } from '@mendable/firecrawl-js'

config()

async function main() {
  const app = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  const url = process.argv[2] || 'https://example.com'
  console.log(`Scraping ${url}…\n`)
  const result = await app.scrape(url, { formats: ['markdown'] })
  console.log('Title:', result.metadata?.title)
  console.log('Description:', result.metadata?.description)
  console.log('\nMarkdown preview:')
  console.log(result.markdown?.slice(0, 500))
}

main().catch(console.error)
