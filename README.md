# Growth Agents

AI-powered marketing ops and growth automation, running locally through [Cursor](https://cursor.com/).

This project turns Cursor into a marketing co-pilot that can research competitors, generate campaign copy, analyze funnel data, enrich leads, audit SEO, and automate the repetitive work that eats up your week. The magic is in the `.cursor/rules` folder — these rules give Cursor deep marketing domain knowledge so it can execute complex, multi-step growth tasks on your behalf.

## Requirements

This project is designed to run on macOS.

## Setup

1. Download [Cursor](https://cursor.com/) and install it
2. [Download this project](https://github.com/maccman/growth-agents/archive/refs/heads/master.zip) and unzip it
3. Open the project in Cursor
4. Run the `/setup-mac` action to install the dependencies

## What can it do?

**Content & Copy**

- Draft blog posts, email sequences, ad copy, and social media posts
- Generate copy variants for A/B testing
- Repurpose content across channels (blog → Twitter thread → LinkedIn post → newsletter)

**SEO**

- Audit a page or site for technical SEO issues (meta tags, headings, structured data)
- Research keywords and estimate search volume via APIs
- Analyze competitor content and backlink profiles
- Generate SEO-optimized content briefs

**Lead Generation & Enrichment**

- Scrape and structure prospect lists from the web
- Enrich contact/company data (firmographics, tech stack, social profiles)
- Score and segment leads based on custom criteria
- Clean and deduplicate CRM exports

**Analytics & Reporting**

- Analyze campaign performance data from CSV exports
- Build funnel conversion reports
- Calculate CAC, LTV, ROAS, and other growth metrics
- Generate PDF or Markdown reports with charts

**Email Marketing**

- Generate email templates and drip campaign sequences
- Analyze open/click/conversion data
- Segment subscriber lists
- Check email deliverability and spam score indicators

**Competitive Intelligence**

- Monitor competitor websites for changes
- Build feature comparison matrices
- Analyze competitor pricing and positioning
- Track competitor social and content strategy

**Ad Operations**

- Generate ad copy variations for Google/Meta/LinkedIn
- Analyze ad spend and ROAS from exported data
- Recommend budget allocation across channels

**Growth Modeling**

- Build retention cohort analyses
- Model growth scenarios and forecasts
- Analyze A/B test results for statistical significance
- Map and optimize conversion funnels

## Examples

Here are some things you can ask Cursor to do:

```
"Take this list of 500 leads in data/leads.csv and enrich them with company size,
industry, and LinkedIn profile URLs"

"Audit example.com for SEO issues and give me a prioritized list of fixes"

"Generate 10 subject line variants for our product launch email, optimized for open rate"

"Analyze data/ad_spend.csv and tell me which channels have the best ROAS"

"Build a 5-email onboarding drip sequence for our SaaS product"

"Research our top 5 competitors and build a feature comparison matrix"

"Take data/signups.csv and build a weekly retention cohort analysis"

"Generate a blog post outline targeting the keyword 'best CRM for startups'"
```
