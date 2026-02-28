When the user triggers this action, walk them through setting up [Firecrawl](https://www.firecrawl.dev/) for this project.
Run each step automatically. Speak in plain, friendly language.

## What is Firecrawl?

Firecrawl is a web data API that turns any website into clean, LLM-ready markdown or structured data. It handles proxies, rate limits, JavaScript-rendered pages, and anti-bot mechanisms so you don't have to. Key capabilities:

- **Scrape** — extract content from a single URL as markdown, HTML, JSON, screenshots, or links
- **Crawl** — scrape all pages of a website automatically
- **Search** — search the web and get full page content from results
- **Map** — discover all URLs on a site instantly
- **Extract** — get structured data from pages using AI prompts and schemas
- **Agent** — gather data from the web using natural language prompts
- **Browser** — launch cloud browser sessions for interactive scraping

## When to use the CLI vs the SDK

- **CLI (`firecrawl`)** — preferred for simple, one-off tasks: quick scrapes, searches, site maps, piping output to other tools. Use it whenever a shell one-liner will do.
- **SDK (`@mendable/firecrawl-js`)** — use in TypeScript scripts when you need programmatic control, structured extraction with Zod schemas, or integration into larger workflows.

## Steps

1. **Install the CLI and authenticate via browser** — This single command installs the CLI globally and opens the browser for Firecrawl authentication:

   ```bash
   npx -y firecrawl-cli@latest init --agent cursor --browser
   ```

   - `--agent cursor` installs the Firecrawl skill only for Cursor
   - `--browser` opens the browser for authentication automatically

   If the browser auth doesn't work, fall back to manual login:

   ```bash
   npm install -g firecrawl-cli
   firecrawl login --browser
   ```

   Or if the user already has an API key (get one at [firecrawl.dev/app/api-keys](https://www.firecrawl.dev/app/api-keys)):

   ```bash
   firecrawl login --api-key <their key>
   ```

2. **Verify the CLI** — Run:

   ```bash
   firecrawl --status
   ```

   This should show authentication status, concurrency limits, and remaining credits. If it doesn't show "Authenticated", go back and re-run the login step.

3. **Get the API key for `.env`** — The CLI stores its own credentials, but the Node SDK reads from `.env`. Read the key directly from the credentials file (the `view-config` command masks it):

   ```bash
   cat ~/Library/Application\ Support/firecrawl-cli/credentials.json
   ```

   Copy the `apiKey` value. Add it to the `.env` file in the repo root (create from `.env.example` if it doesn't exist):

   ```
   FIRECRAWL_API_KEY=<the key>
   ```

4. **Install the Node SDK** — Run:

   ```bash
   pnpm add @mendable/firecrawl-js
   ```

5. **Smoke-test** — Run the example script (not the CLI directly — the CLI can have connection issues even when the API is healthy):

   ```bash
   pnpm start scripts/firecrawl-example.ts
   ```

   - If it prints metadata and markdown, everything works.
   - If it errors with "Insufficient credits", the connection is fine — the account just needs a top-up at [firecrawl.dev/pricing](https://firecrawl.dev/pricing). Let the user know this is a billing issue, not a setup issue.
   - Any other error likely means the API key wasn't saved correctly — double-check `.env`.

### Example script (`scripts/firecrawl-example.ts`)

```typescript
import { config } from 'dotenv'
import { Firecrawl } from '@mendable/firecrawl-js'

config()

async function main() {
  const app = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY })
  const url = process.argv[2] || 'https://example.com'
  console.log(`Scraping ${url} …\n`)

  const doc = await app.scrape(url, {
    formats: ['markdown'],
  })

  console.log('--- Metadata ---')
  console.log(`Title: ${doc.metadata?.title}`)
  console.log(`Description: ${doc.metadata?.description}`)
  console.log(`Source: ${doc.metadata?.sourceURL}\n`)

  console.log('--- Markdown (first 500 chars) ---')
  console.log(doc.markdown?.slice(0, 500))
}

main().catch(console.error)
```

> **Note:** Use the named import `{ Firecrawl }` — the default import doesn't work with v4 of the SDK.

## CLI quick reference

For simple tasks, prefer the CLI over writing a script. Common commands:

```bash
# Scrape a page to clean markdown (recommended: --only-main-content)
firecrawl https://example.com --only-main-content

# Scrape and save to a file
firecrawl https://example.com -o output.md

# Get HTML instead of markdown
firecrawl https://example.com --html

# Multiple formats (returns JSON)
firecrawl https://example.com --format markdown,links --pretty

# Search the web
firecrawl search "AI startup funding 2026" --limit 5

# Search and scrape the results
firecrawl search "firecrawl tutorial" --scrape --scrape-formats markdown

# Discover all URLs on a site
firecrawl map https://example.com

# Filter discovered URLs
firecrawl map https://example.com --search "blog"

# Crawl an entire site (with progress)
firecrawl crawl https://docs.example.com --limit 50 --wait --progress

# Use the AI agent to gather data with a prompt
firecrawl agent "Find the top 5 competitors to Firecrawl" --wait

# Agent with structured output
firecrawl agent "Get company info" --urls https://example.com --schema '{"name": "string", "founded": "number"}' --wait

# Launch a cloud browser session for interactive scraping
firecrawl browser launch-session
firecrawl browser execute "open https://example.com"
firecrawl browser execute "snapshot"
firecrawl browser execute "scrape"
firecrawl browser close

# Pipe output to other tools
firecrawl https://example.com --format links | jq '.links[].url'

# Check remaining credits
firecrawl credit-usage
```

## Finish

Once the example script runs (or returns an "Insufficient credits" error confirming the connection works), let the user know they're all set. Tell them in simple English what Firecrawl can do for them, give them some examples. If they're out of credits, remind them to top up at [firecrawl.dev/pricing](https://firecrawl.dev/pricing).
