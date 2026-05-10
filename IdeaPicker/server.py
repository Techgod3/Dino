"""
IdeaPicker — Backend server
Serves the static frontend and proxies Reddit API calls.
Multiple fetch strategies:
  1. Playwright CDP (real browser, bypasses most blocks)
  2. httpx direct (works from non-datacenter IPs)
  3. Demo data fallback (always works, for testing)

Run:  python server.py
Then open http://localhost:8000
"""

import asyncio
import json
import os
import random
import sys
import time
from pathlib import Path

try:
    import uvicorn
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
    from fastapi.staticfiles import StaticFiles
    import httpx
except ImportError:
    print("Missing dependencies. Install with:\n  pip install fastapi uvicorn httpx")
    sys.exit(1)

try:
    from playwright.async_api import async_playwright
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="IdeaPicker", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CDP_URL = os.environ.get("CDP_URL", "http://localhost:29229")

# ── Playwright-based Reddit fetcher ─────────────────────────────


async def fetch_reddit_via_browser(subreddit: str, sort: str, t: str, limit: int):
    """Use Playwright CDP to fetch Reddit JSON through a real browser context."""
    if sort in ("hot", "new", "top"):
        url = f"https://www.reddit.com/r/{subreddit}/{sort}.json?t={t}&limit={limit}&raw_json=1"
    else:
        url = f"https://www.reddit.com/r/{subreddit}/search.json?q=*&restrict_sr=1&sort={sort}&t={t}&limit={limit}&raw_json=1"

    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp(CDP_URL)
        context = browser.contexts[0] if browser.contexts else await browser.new_context()
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
            text = await page.inner_text("body")
            if "blocked" in text.lower() or "log in" in text.lower():
                raise RuntimeError("Reddit blocked the request")
            data = json.loads(text)
        finally:
            await page.close()

    return _parse_reddit_listing(data, subreddit)


# ── httpx-based fetcher ─────────────────────────────────────────

REDDIT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json",
}


async def fetch_reddit_via_httpx(subreddit: str, sort: str, t: str, limit: int):
    if sort in ("hot", "new", "top"):
        url = f"https://www.reddit.com/r/{subreddit}/{sort}.json"
        params = {"t": t, "limit": limit, "raw_json": 1}
    else:
        url = f"https://www.reddit.com/r/{subreddit}/search.json"
        params = {"q": "*", "restrict_sr": 1, "sort": sort,
                  "t": t, "limit": limit, "raw_json": 1}

    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        resp = await client.get(url, params=params, headers=REDDIT_HEADERS)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "json" not in content_type:
            raise RuntimeError("Reddit returned HTML instead of JSON (blocked)")

    return _parse_reddit_listing(resp.json(), subreddit)


def _parse_reddit_listing(data: dict, subreddit: str):
    children = data.get("data", {}).get("children", [])
    posts = []
    for child in children:
        d = child.get("data", {})
        posts.append({
            "title": d.get("title", ""),
            "selftext": d.get("selftext", ""),
            "subreddit": d.get("subreddit", subreddit),
            "score": d.get("score", 0),
            "num_comments": d.get("num_comments", 0),
            "url": f"https://reddit.com{d.get('permalink', '')}",
            "author": d.get("author", ""),
            "created": d.get("created_utc", 0),
        })
    return posts


# ── Demo data (realistic Reddit-style posts for testing) ────────

DEMO_POSTS = {
    "SaaS": [
        {"title": "I'm so frustrated with Salesforce's pricing — $300/user/month is insane for what we get", "selftext": "We're a 15-person startup and Salesforce is eating 25% of our budget. The UI is clunky, integrations break constantly, and support takes days to respond. We've looked at HubSpot but it's missing key features. Is there a CRM that actually works for small teams without costing a fortune?", "score": 847, "num_comments": 234},
        {"title": "Why is every project management tool either too simple or too complex?", "selftext": "Trello is too basic once you scale past 5 people. Jira is a nightmare of configuration. Monday.com costs too much. Notion is great for docs but terrible for actual project tracking. I just want something in the middle that handles sprints, has good reporting, and doesn't require a PhD to set up.", "score": 623, "num_comments": 187},
        {"title": "Customer onboarding is killing our churn rate — anyone solved this?", "selftext": "We lose 40% of new signups within the first week because our onboarding flow is confusing. We've tried Intercom tours, Appcues, and building our own — nothing sticks. Users don't read docs, they skip tutorials, and then they churn because they never saw the value. I wish there was a tool that could actually learn our product and guide users intelligently.", "score": 512, "num_comments": 156},
        {"title": "Struggling to find a good analytics tool that doesn't require a data engineer", "selftext": "Mixpanel is expensive and complex. Amplitude is similar. Google Analytics is useless for SaaS metrics. PostHog self-hosted crashes. All I want is a dashboard that shows MRR, churn, LTV, and cohort analysis without needing SQL or a data team. Why is this so hard in 2025?", "score": 445, "num_comments": 143},
        {"title": "Our billing system is a Frankenstein monster and I hate it", "selftext": "We're using Stripe + Chargebee + custom webhooks + a spreadsheet. Proration is broken, dunning emails go to spam, and usage-based billing is a nightmare. Enterprise customers want invoices, self-serve wants cards, and everyone wants annual discounts. I've spent more time on billing than on our actual product.", "score": 398, "num_comments": 112},
        {"title": "Email deliverability is the bane of my existence", "selftext": "We send transactional + marketing emails through SendGrid and our deliverability has tanked to 60%. Gmail clips our emails, Outlook blocks our domain, and we can't figure out DMARC/DKIM properly. Switched to Postmark for transactional but now we're paying for two services. Anyone found a single solution that just works?", "score": 367, "num_comments": 98},
        {"title": "I need a tool that monitors competitor pricing changes automatically", "selftext": "I manually check 12 competitor websites every week to track their pricing changes. It takes hours and I still miss things. There are web scraping tools but they break when sites change their layout. I just want alerts when a competitor changes their pricing page.", "score": 289, "num_comments": 76},
        {"title": "Tired of paying $500/month for a feature flag service", "selftext": "LaunchDarkly is amazing but the pricing is brutal for a bootstrapped startup. We have 50K MAU and they want $500/month. Open source alternatives like Unleash require DevOps to maintain. I just want simple boolean flags with percentage rollouts and A/B testing without selling a kidney.", "score": 256, "num_comments": 89},
    ],
    "startups": [
        {"title": "Why is hiring developers so impossibly expensive right now?", "selftext": "Senior React devs want $200K+. We're pre-seed with $500K. After rent, tools, and legal, we can barely afford one developer. Outsourcing has been a disaster — 3 agencies, all delivered garbage. Upwork is hit or miss. There has to be a better way to find affordable, quality dev talent for early-stage startups.", "score": 934, "num_comments": 312},
        {"title": "I spent 6 months building something nobody wants — how do I validate ideas faster?", "selftext": "Built a beautiful task management app. Zero traction after launch. I should have talked to customers first but I didn't know how to find them or what to ask. Landing page tests gave false positives. Surveys were useless. I need a systematic way to validate startup ideas before writing a single line of code.", "score": 756, "num_comments": 245},
        {"title": "Legal costs are destroying early-stage startups", "selftext": "Incorporation: $2K. Terms of service: $3K. Privacy policy: $1.5K. Employment contracts: $2K. SAFE notes: $1K. That's $10K just in legal before you've made a dollar. Template sites are scary because one mistake can sink you. There should be an AI lawyer for startups.", "score": 612, "num_comments": 198},
        {"title": "Finding co-founders is harder than dating", "selftext": "YC co-founder matching is a lottery. LinkedIn DMs are awkward. Twitter is just noise. I've been looking for a technical co-founder for 8 months. Every matching service feels like a dating app with the same problems — people ghost, misrepresent skills, or have incompatible visions.", "score": 534, "num_comments": 167},
        {"title": "Investor updates are eating my weekends", "selftext": "I have 14 angels and 2 institutional investors. Each wants different metrics in different formats. I spend every Sunday compiling numbers, writing narratives, and sending personalized emails. There should be a tool that auto-generates investor updates from our existing tools (Stripe, Mixpanel, QuickBooks).", "score": 423, "num_comments": 134},
        {"title": "Can't find a single tool that handles both US and EU payroll for a 10-person remote team", "selftext": "Gusto only does US. Remote.com charges $599/month per contractor. Deel is similar. We're a small remote team across 5 countries and payroll is costing us more in admin time and tools than the actual salaries. Someone needs to build an affordable global payroll for teams under 20.", "score": 378, "num_comments": 112},
    ],
    "Entrepreneur": [
        {"title": "I hate how complicated setting up payment processing is for international customers", "selftext": "Stripe doesn't support my country for receiving payments. PayPal freezes accounts. Wise is great for transfers but not for recurring billing. If you're a solo entrepreneur outside the US/UK, accepting payments from global customers is an absolute nightmare. I've spent 3 weeks just trying to get paid.", "score": 678, "num_comments": 203},
        {"title": "Social media management tools are all the same overpriced garbage", "selftext": "Buffer, Hootsuite, Sprout Social — they all do the same thing and charge $50-300/month. All I need is to schedule posts across 4 platforms and see basic analytics. I don't need AI content generation, team collaboration, or enterprise features. Where's the $10/month scheduler?", "score": 534, "num_comments": 178},
        {"title": "Accounting software for solo entrepreneurs is either too basic or too complex", "selftext": "Wave is free but limited. QuickBooks is confusing and expensive. FreshBooks is okay but pricy for what it does. I need something that handles invoicing, expense tracking, tax estimates, and connects to my bank — without the enterprise bloat. And please make it work on mobile.", "score": 489, "num_comments": 156},
        {"title": "I can't find a good way to collect and display customer testimonials", "selftext": "I ask happy customers for testimonials manually. Some respond in text, some in video, most never respond. Then I manually copy them to my website. There should be a tool that automates the ask, collects video/text, and gives me an embeddable widget. Bonus if it integrates with review sites.", "score": 345, "num_comments": 98},
        {"title": "Wish there was a simple way to create a membership site without WordPress", "selftext": "I want to sell access to exclusive content — articles, videos, downloads. WordPress + MemberPress is a security nightmare. Teachable charges 10% on the free plan. Kajabi is $149/month. Patreon takes 12%. I just want a clean, modern membership site with Stripe payments and content gating for under $30/month.", "score": 312, "num_comments": 89},
    ],
    "smallbusiness": [
        {"title": "Why is every POS system designed to nickel-and-dime small businesses?", "selftext": "Square takes 2.6% + $0.10. Toast charges monthly fees AND transaction fees. Clover locks you into their hardware. Every POS system seems designed to extract maximum revenue from small businesses who can't afford enterprise solutions. $300/month for a cash register replacement is insane.", "score": 567, "num_comments": 189},
        {"title": "Google reviews are make-or-break and there's no good way to manage them", "selftext": "We have 4 locations. Monitoring reviews across all of them is a full-time job. Responding quickly matters but I'm running a business, not sitting on Google all day. Reputation management tools cost $200+/month. I need something affordable that alerts me, suggests responses, and helps me get more positive reviews.", "score": 445, "num_comments": 134},
        {"title": "Inventory management for a small retail shop shouldn't cost $300/month", "selftext": "I run a boutique with 500 SKUs. Shopify's inventory is basic. Lightspeed charges $200+/month. All I need is barcode scanning, low stock alerts, and sync with my online store. Why does every solution assume I'm running a warehouse?", "score": 389, "num_comments": 112},
        {"title": "Scheduling appointments is still a nightmare in 2025", "selftext": "Calendly is great for 1-on-1 meetings but useless for a service business with multiple staff. Acuity is confusing. Vagaro charges per employee. I run a salon with 6 stylists and I just want a booking page where clients pick a service, a stylist, and a time slot. Why is this $100+/month?", "score": 356, "num_comments": 98},
    ],
    "webdev": [
        {"title": "I'm so tired of configuring webpack/vite/rollup for every new project", "selftext": "Every new project starts with 2 days of build tool configuration. Hot reload breaks, TypeScript config conflicts, CSS modules don't work, environment variables leak. Then you add testing and it all breaks again. I wish there was a zero-config build tool that actually worked for real-world apps, not just demos.", "score": 723, "num_comments": 234},
        {"title": "Why is deploying a simple web app still so complicated?", "selftext": "Heroku is dead. AWS is a PhD program. Railway keeps changing pricing. Render is slow. Fly.io has weird networking issues. I just want to push code and have it live. Docker + Kubernetes for a CRUD app is insane. Solo devs need a 'just deploy it' button.", "score": 612, "num_comments": 198},
        {"title": "Client feedback tools are terrible — I need something better than screenshots in email", "selftext": "Clients send me screenshots with arrows drawn in Paint, or worse, they describe issues over the phone. 'The button thing on the page with the stuff.' I've tried Markup.io and BugHerd but they're expensive and clients won't install browser extensions. I need a simple link they can click, annotate, and submit.", "score": 456, "num_comments": 145},
    ],
    "freelance": [
        {"title": "I spend more time writing proposals than doing actual work", "selftext": "Every potential client wants a custom proposal. I spend 3-5 hours per proposal and close maybe 20%. That's 15+ hours/week writing proposals for 1 client. There should be an AI that knows my portfolio, understands the client's needs, and generates a professional proposal I can review and send in 10 minutes.", "score": 534, "num_comments": 167},
        {"title": "Scope creep is eating my profits alive", "selftext": "Every project starts with a clear scope and ends up 3x the work. Clients ask for 'small changes' that take hours. I've tried strict contracts but enforcing them kills the relationship. I need a tool that tracks scope changes, automatically documents them, and makes it easy to discuss additional charges.", "score": 467, "num_comments": 145},
        {"title": "Late payments from clients are destroying my cash flow", "selftext": "50% of my invoices are paid late. Net-30 turns into Net-60. Chasing payments is humiliating and time-consuming. PayPal and Stripe don't help with collections. I wish there was a service that guaranteed payment on time and handled the awkward follow-ups.", "score": 398, "num_comments": 123},
    ],
    "RemoteWork": [
        {"title": "Why are all virtual office tools so bad at async communication?", "selftext": "Slack is real-time or nothing. Teams is worse. Discord is for gamers. Email is too slow. I work across 5 time zones with my team and there's no good tool for async discussions that isn't just a wall of text. We need something between Slack and a forum — threaded, searchable, with status updates.", "score": 567, "num_comments": 187},
        {"title": "Time tracking for remote teams feels like surveillance", "selftext": "My company wants us to use Hubstaff which takes screenshots every 10 minutes. It's demeaning. But I understand they need accountability. There should be a tool that tracks output/deliverables instead of screen time. Show what was accomplished, not what websites were visited.", "score": 489, "num_comments": 156},
    ],
    "digitalnomad": [
        {"title": "Finding reliable coworking spaces while traveling is pure luck", "selftext": "Google Maps reviews are useless for coworking. One place says 'great WiFi' and it's 5 Mbps. Another says 'quiet' and there's construction next door. I need a Yelp specifically for coworking spaces with verified WiFi speeds, noise levels, and real photos from digital nomads, not stock images.", "score": 445, "num_comments": 134},
        {"title": "Tax compliance as a digital nomad is impossibly complex", "selftext": "I've lived in 4 countries this year. Each has different tax treaties, residency rules, and filing requirements. No accountant understands nomad taxes. Online tax software assumes you live in one place. I'm terrified I'm going to get audited because there's literally no good way to handle this.", "score": 389, "num_comments": 112},
    ],
}


def get_demo_posts(subreddit: str, limit: int):
    """Return realistic demo posts for the given subreddit."""
    # Match known subreddits or return a mix
    sub_lower = subreddit.lower()
    for key, posts in DEMO_POSTS.items():
        if key.lower() == sub_lower:
            result = posts[:limit]
            for p in result:
                p.setdefault("subreddit", key)
                p.setdefault("url", f"https://reddit.com/r/{key}/comments/demo/{p['title'][:30].replace(' ', '_')}")
                p.setdefault("author", f"user_{random.randint(1000, 9999)}")
                p.setdefault("created", time.time() - random.randint(3600, 604800))
            return result

    # Unknown subreddit: return a mix from all
    all_posts = []
    for key, posts in DEMO_POSTS.items():
        for p in posts:
            p_copy = dict(p)
            p_copy.setdefault("subreddit", key)
            p_copy.setdefault("url", f"https://reddit.com/r/{key}/comments/demo/{p['title'][:30].replace(' ', '_')}")
            p_copy.setdefault("author", f"user_{random.randint(1000, 9999)}")
            p_copy.setdefault("created", time.time() - random.randint(3600, 604800))
            all_posts.append(p_copy)
    random.shuffle(all_posts)
    return all_posts[:limit]


# ── Routes ──────────────────────────────────────────────────────


@app.get("/")
async def index():
    return FileResponse(ROOT / "index.html")


@app.get("/api/reddit/{subreddit}")
async def proxy_reddit(
    subreddit: str,
    sort: str = Query("hot", pattern="^(hot|new|top|relevance)$"),
    t: str = Query("week", pattern="^(hour|day|week|month|year|all)$"),
    limit: int = Query(50, ge=1, le=100),
    demo: bool = Query(False),
):
    """Fetch Reddit posts. Tries live APIs first, falls back to demo data."""
    if demo:
        posts = get_demo_posts(subreddit, limit)
        return {"posts": posts, "count": len(posts), "source": "demo"}

    # Strategy 1: Playwright (bypasses most IP blocks)
    if HAS_PLAYWRIGHT:
        try:
            posts = await fetch_reddit_via_browser(subreddit, sort, t, limit)
            if posts:
                return {"posts": posts, "count": len(posts), "source": "browser"}
        except Exception as exc:
            print(f"[Playwright] Failed for r/{subreddit}: {exc}")

    # Strategy 2: httpx direct (works from residential/office IPs)
    try:
        posts = await fetch_reddit_via_httpx(subreddit, sort, t, limit)
        if posts:
            return {"posts": posts, "count": len(posts), "source": "api"}
    except Exception as exc:
        print(f"[httpx] Failed for r/{subreddit}: {exc}")

    # Strategy 3: Demo data fallback
    posts = get_demo_posts(subreddit, limit)
    return {"posts": posts, "count": len(posts), "source": "demo"}


# Serve static files (CSS, JS, etc.)
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="static")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"\n  IdeaPicker running at http://localhost:{port}\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
