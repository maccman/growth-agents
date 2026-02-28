When the user triggers this command, walk them through setting up the [Perplexity API](https://docs.perplexity.ai/) for this project. Run each step automatically. Speak in plain, friendly language.

## What is the Perplexity API?

Perplexity's API gives you access to their Sonar models — AI that answers questions with live web search built in. Unlike standard LLMs, every response is grounded in real-time web results with citations. It's great for research tasks, lead enrichment, competitive intelligence, and anything that benefits from up-to-date information.

## Steps

### 1. Get the API key

Ask the user:

> "Do you already have a Perplexity API key? If not, you can grab one at [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) — you'll need to sign up and add a payment method. Once you have it, paste it here."

Wait for them to paste the key before continuing.

### 2. Add the key to `.env`

Add the key to the `.env` file in the repo root:

```
PERPLEXITY_API_KEY=<their key>
```

Also add the placeholder to `.env.example` if it's not already there, under the `# Web scraping` section:

```
PERPLEXITY_API_KEY=
```

### 3. Install the SDK

This project uses the Vercel AI SDK, so install the Perplexity provider:

```bash
pnpm add @ai-sdk/perplexity
```

### 4. Smoke-test

Run a quick test to confirm the key works:

```bash
pnpm start scripts/perplexity-example.ts
```

Create the script if it doesn't exist:

```typescript
import { config } from 'dotenv'
import { createPerplexity } from '@ai-sdk/perplexity'
import { generateText } from 'ai'

config()

async function main() {
  const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY })

  const { text, sources } = await generateText({
    model: perplexity('sonar'),
    prompt: 'What is the current valuation of SpaceX? Answer in one sentence.',
  })

  console.log('Answer:', text)
  console.log('\nSources:')
  sources?.forEach((s, i) => console.log(`  [${i + 1}] ${s.url}`))
}

main().catch(console.error)
```

- If it prints an answer with sources, everything is working.
- If it throws an auth error, the API key is wrong — double-check `.env`.
- If it throws a billing error, the account needs a payment method added at [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api).

### 5. Clean up

Delete the example script after confirming it works:

```bash
rm scripts/perplexity-example.ts
```

## Available models

| Model | Best for |
|-------|----------|
| `sonar` | Fast, cheap, real-time web search |
| `sonar-pro` | Deeper research, more sources, higher cost |
| `sonar-reasoning` | Step-by-step reasoning with citations |
| `sonar-reasoning-pro` | Best quality, slowest, most expensive |

## Usage in scripts

### `generateText` — plain answer with citations

```typescript
import { createPerplexity } from '@ai-sdk/perplexity'
import { generateText } from 'ai'

const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY })

const { text, sources } = await generateText({
  model: perplexity('sonar-pro'),
  prompt: 'Who are the top 5 competitors to Notion in 2026?',
})
```

### `generateObject` — structured data with live web search

Use this when you need typed, structured output (e.g. lead enrichment, competitor research):

```typescript
import { createPerplexity } from '@ai-sdk/perplexity'
import { generateObject } from 'ai'
import { z } from 'zod'

const perplexity = createPerplexity({ apiKey: process.env.PERPLEXITY_API_KEY })

const { object, sources } = await generateObject({
  model: perplexity('sonar-pro'),
  prompt: 'Research the company Notion (notion.so). Return structured data.',
  schema: z.object({
    name: z.string(),
    founded: z.number(),
    headquarters: z.string(),
    estimatedEmployees: z.number(),
    latestFundingRound: z.string(),
    topCompetitors: z.array(z.string()),
    recentNews: z.array(z.object({
      headline: z.string(),
      date: z.string(),
    })).max(3),
  }),
})

console.log(object)
console.log('\nSources:', sources?.map(s => s.url))
```

## Finish

Once the smoke test passes, let the user know they're set up. Remind them that Perplexity's key strength is **real-time, cited answers** — unlike standard LLMs it won't hallucinate outdated facts.
