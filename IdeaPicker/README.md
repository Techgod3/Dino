# IdeaPicker — Reddit Pain-Point to Startup Idea Engine

An AI-powered tool that scans Reddit for real user complaints and pain points, then transforms them into actionable startup ideas complete with revenue estimates.

## How It Works

1. **Scan Reddit** — Enter subreddits (e.g. `SaaS`, `startups`, `Entrepreneur`) and IdeaPicker fetches recent posts via Reddit's public JSON API.
2. **Filter Pain Points** — Posts are filtered using 50+ pain-point keywords (frustrated, hate, wish, broken, alternative to, etc.) or your own custom keywords.
3. **AI Analysis** — Pain-point posts are batched and sent to OpenAI's GPT-4o-mini to generate startup ideas with:
   - Catchy startup name & one-line pitch
   - Core pain point identified
   - Detailed solution
   - Target market & size
   - Revenue model with MRR/ARR estimates
   - Confidence score (1-10)
   - Key features, competitors, and differentiators
4. **Export** — Download results as CSV or JSON.

## Quick Start

### Option A — With backend (recommended, avoids CORS issues)

```bash
cd IdeaPicker
pip install -r requirements.txt
python server.py
```

Open http://localhost:8000 in your browser.

### Option B — Static file (no backend)

```bash
cd IdeaPicker
python3 -m http.server 8080
```

Open http://localhost:8080 — Reddit fetching will attempt direct requests (may hit CORS in some browsers).

## Configuration

- **OpenAI API Key** — Enter your key in the top bar. It's saved to `localStorage` and never sent to any server other than OpenAI directly from your browser.
- **Subreddits** — Comma-separated list of subreddits to scan.
- **Posts per sub** — 25, 50, or 100 posts per subreddit.
- **Time range** — Past 24h, week, month, year, or all time.
- **Pain-point keywords** — Optional custom keywords to filter for.
- **Sort** — Relevance, Hot, Top, or New.

## Architecture

```
IdeaPicker/
├── index.html         # Frontend UI
├── style.css          # Styles (dark theme, responsive)
├── app.js             # Client-side logic (Reddit fetch, AI analysis, rendering)
├── server.py          # FastAPI backend (Reddit proxy, static file serving)
├── requirements.txt   # Python dependencies
└── README.md          # This file
```

- **Frontend** — Pure HTML/CSS/JS, no build step, no framework dependencies.
- **Backend** — Lightweight FastAPI server that proxies Reddit API calls (avoids browser CORS restrictions) and serves the static frontend.
- **AI** — OpenAI API called directly from the browser with the user's API key (key never touches the server).

## Screenshots

The app features a dark, modern UI with:
- Hero section with gradient branding
- Search form with subreddit chips, filters, and sort options
- Progress bar during scanning
- Stats dashboard (posts scanned, pain points found, ideas generated, total revenue estimate)
- Card grid of startup ideas with confidence badges
- Detail modal with full analysis for each idea
- CSV/JSON export

## Tech Stack

- Vanilla HTML/CSS/JS (zero frontend dependencies)
- FastAPI + uvicorn + httpx (Python backend)
- OpenAI GPT-4o-mini (AI analysis)
- Reddit public JSON API (no Reddit API key needed)
