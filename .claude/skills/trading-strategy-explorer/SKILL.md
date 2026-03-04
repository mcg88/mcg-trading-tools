---
name: trading-strategy-explorer
description: Analyzes a Twitter/X profile to extract equity and options trading strategies and alpha ideas. Accepts a Twitter handle or profile URL, downloads the tweet archive using tweety-ns, and produces a structured markdown report of strategies found.
---

# Trading Strategy Explorer

Analyze a Twitter/X profile for equity and equity options trading strategies, alpha ideas, and market edge concepts.

## Input

The user will provide a Twitter/X handle or profile URL. Extract the bare username (strip `@`, strip URL prefix).

Examples:
- `@OptionsHawk` → `OptionsHawk`
- `https://x.com/OptionsHawk` → `OptionsHawk`
- `twitter.com/OptionsHawk` → `OptionsHawk`

## Workflow

Make a todo list with all the steps below and work through them one at a time.

### Step 1 — Locate the download script

Find the `trading_explorer.py` script. It should be at:
- `scripts/trading_explorer.py` relative to the current working directory, OR
- Search for it with Glob if not found there

If the script is missing, tell the user and stop.

### Step 2 — Check Python dependencies

Run:
```bash
python3 -c "from tweety import TwitterAsync; print('ok')"
```

If it fails, run `pip install tweety-ns` and retry. Stop if it still fails after install.

### Step 3 — Check / run the download

Determine the archive directory. The script places archives at:
`{repo_root}/{handle}-trading-archive/tweets.json`

Where `{repo_root}` is the parent directory of the `scripts/` folder.

**If the archive already exists:**
- Show the user: how many tweets are archived, when it was last updated.
- Ask if they want to update the archive (fetch newer tweets) or skip straight to analysis.

**If no archive exists:**
- Inform the user this is a fresh download and it may take a while.
- Proceed with download.

**To download / update**, run:
```bash
python3 {path_to_script} download @{handle} --session trading_explorer --wait 3
```

Run this command and tail the output. It will print progress page by page. Let it run to completion — it's designed to be long-running.

After the command finishes, confirm the archive was created/updated by checking the JSON file.

### Step 4 — Read the archive

Read `{archive_dir}/tweets.json`.

The structure is:
```json
{
  "username": "handle",
  "last_updated": "ISO timestamp",
  "total_tweets": 1234,
  "tweets": [
    {
      "id": "...",
      "date": "...",
      "text": "...",
      "is_reply": false,
      "is_retweet": false,
      "likes": 42,
      "retweet_counts": 10,
      "symbols": ["AAPL", "SPY"],
      "hashtags": ["options", "earnings"],
      "media": [{"type": "photo", "url": "..."}],
      "media_local_paths": ["media/12345_0_image.jpg"],
      "urls": [{"expanded_url": "..."}],
      "thread_context": [
        { "text": "parent tweet text...", "author_username": "someone_else" }
      ]
    }
  ]
}
```

**Important notes on reading:**
- The JSON file may be large. If it exceeds ~2000 lines, read it in chunks using the `offset` and `limit` parameters of the Read tool.
- Prioritise tweets with high engagement (likes + retweets > 10) and those that contain `symbols` (ticker mentions).
- For reply tweets, the `thread_context` array contains the parent tweet(s) — read these to understand what the user was responding to.

### Step 5 — Analyse for trading strategies (equity & options focus)

Read through the tweets carefully. **Ignore any non-equity/options content** (crypto, macro commentary with no actionable idea, personal life, etc.).

Look for the following categories:

#### A. Repeating setups / trade ideas
- Specific entry/exit criteria
- Technical levels, chart patterns, or conditions
- Catalyst-driven plays (earnings, FDA dates, macro events)

#### B. Options-specific strategies
- Defined-risk spreads (call spreads, put spreads, iron condors, etc.)
- Directional options plays (outright calls/puts, LEAPs)
- Vol plays (selling premium, straddles, strangles, vol skew observations)
- Unusual options activity mentions (UOA/dark pool flow)

#### C. Market edge observations
- Recurring observations about sector behaviour, seasonality, or correlated moves
- Comments on market structure (market maker behaviour, options pinning, gamma)
- Screening or filtering criteria the user uses to find ideas

#### D. Position sizing / risk management principles
- Position size rules mentioned
- When to cut losses or take profits
- Portfolio construction thoughts

#### E. Watchlist / focus tickers
- Tickers mentioned repeatedly — these are likely the user's focus universe
- Context around each ticker (why they watch it, what setup they look for)

### Step 6 — Analyse images

For each tweet that has `media_local_paths`, check if the files exist in the archive's `media/` directory.

Read any image files you find — they likely contain chart screenshots. Describe what the chart shows (instrument, timeframe, key levels marked, indicators) and associate that analysis back to the tweet text.

### Step 7 — Write the markdown report

Write the analysis to: `{archive_dir}/analysis.md`

Use this structure:

```markdown
# Trading Strategy Analysis: @{handle}

*Generated: {today's date}*
*Archive: {total_tweets} tweets, last updated {last_updated}*

---

## Executive Summary

2–4 sentences summarising the trader's core style and primary focus (e.g., "Primarily a short-term options flow trader focused on large-cap tech and biotech. Favours defined-risk debit spreads around catalysts with a clear bias. Repeatedly references unusual options activity as a primary signal.")

---

## Core Strategy Framework

### Setup Types
For each distinct setup identified, create a subsection:

#### {Setup Name}
- **Signal / Entry Condition:** What triggers the trade
- **Instrument:** Stock, options type, expiration preference
- **Risk Management:** Stop levels, position size, profit targets
- **Example Tweets:** Quote 1–3 representative tweets (with dates)

---

## Options Strategies Used

List each options strategy observed with:
- Strategy name
- When/why they use it (context)
- Example quotes from tweets

---

## Market Edge & Alpha Ideas

Bullet list of specific edge observations or market structure insights the user has shared. Quote directly where possible.

---

## Recurring Tickers & Focus Universe

Table of tickers mentioned 3+ times:

| Ticker | Times Mentioned | Context / Why They Watch It |
|--------|----------------|------------------------------|
| ...    | ...            | ...                          |

---

## Risk Management Principles

Bullet list of any sizing, stop, or portfolio management rules mentioned.

---

## Key Quotes

The 5–10 most insightful or actionable tweets, quoted verbatim with dates.

---

## Image Analysis

For each analysed chart image:
- Tweet date and text summary
- Chart description (instrument, timeframe, key levels/indicators marked)

---

*Note: This analysis is for research purposes only. Nothing here constitutes financial advice.*
```

### Step 8 — Confirm and summarise

Tell the user:
- Where the archive is saved
- Where the analysis markdown is saved (provide the full path)
- A brief 3–5 sentence summary of the most interesting strategies/alpha ideas found
- How many tweets were analysed and how many images were reviewed

## Notes

- **Rate limits**: tweety mirrors the Twitter web client. The download script already uses a 3-second wait between pages. Do not reduce this.
- **Authentication**: tweety saves session state to disk under the session name `trading_explorer`. If the first run fails authentication, the user will need to run `sign_in` manually once (see tweety docs).
- **Equity/options focus**: Strictly filter. Do not include crypto, macro, or personal content in the analysis even if the user tweets about it.
- **Large archives**: If the tweet archive has more than 500 tweets, process them in batches to avoid context overflow. Focus on the highest-engagement tweets and those with ticker symbols first.
