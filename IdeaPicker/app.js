/* ================================================================
   IdeaPicker — Reddit Pain-Point → Startup Idea Engine
   Pure client-side: Reddit public JSON + OpenAI API (user key)
   ================================================================ */

// ── DOM refs ────────────────────────────────────────────────────
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const apiKeyInput    = $('#api-key');
const saveKeyBtn     = $('#save-key-btn');
const scanForm       = $('#scan-form');
const scanBtn        = $('#scan-btn');
const subredditInput = $('#subreddits');
const keywordsInput  = $('#keywords');
const postLimitSel   = $('#post-limit');
const timeFilterSel  = $('#time-filter');
const sortBySel      = $('#sort-by');

const progressSection = $('#progress-section');
const progressBar     = $('#progress-bar');
const progressText    = $('#progress-text');

const statsRow   = $('#stats-row');
const statPosts  = $('#stat-posts');
const statPain   = $('#stat-pain');
const statIdeas  = $('#stat-ideas');
const statRevenue = $('#stat-revenue');

const resultsSection = $('#results-section');
const resultsGrid    = $('#results-grid');
const emptyState     = $('#empty-state');

const modalBackdrop = $('#modal-backdrop');
const modalContent  = $('#modal-content');
const modalClose    = $('#modal-close');

// ── State ───────────────────────────────────────────────────────
let allIdeas = [];

// ── API Key persistence ─────────────────────────────────────────
(function initKey() {
    const saved = localStorage.getItem('ideapicker_openai_key');
    if (saved) apiKeyInput.value = saved;
})();

saveKeyBtn.addEventListener('click', () => {
    const k = apiKeyInput.value.trim();
    if (k) {
        localStorage.setItem('ideapicker_openai_key', k);
        toast('API key saved locally', 'success');
    }
});

// ── Chips (example subreddits) ──────────────────────────────────
$$('.chip').forEach(c => c.addEventListener('click', () => {
    const cur = subredditInput.value.trim();
    const sub = c.dataset.sub;
    if (!cur) { subredditInput.value = sub; }
    else if (!cur.split(/[,\s]+/).map(s=>s.trim()).includes(sub)) {
        subredditInput.value = cur + ', ' + sub;
    }
}));

// ── Main scan ───────────────────────────────────────────────────
scanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = apiKeyInput.value.trim();
    if (!key) { toast('Please enter your OpenAI API key first', 'error'); return; }

    const subs = subredditInput.value.split(/[,\s]+/).map(s => s.replace(/^r\//, '').trim()).filter(Boolean);
    if (!subs.length) { toast('Enter at least one subreddit', 'error'); return; }

    const limit    = parseInt(postLimitSel.value);
    const timeSpan = timeFilterSel.value;
    const sortBy   = sortBySel.value;
    const keywords = keywordsInput.value.split(/[,\s]+/).filter(Boolean);

    scanBtn.disabled = true;
    scanBtn.innerHTML = '<span class="spinner"></span> Scanning...';
    emptyState.classList.add('hidden');
    resultsSection.classList.add('hidden');
    statsRow.classList.add('hidden');
    progressSection.classList.remove('hidden');
    setProgress(0, 'Fetching Reddit posts...');

    try {
        // 1. Fetch posts from all subreddits
        const allPosts = [];
        for (let i = 0; i < subs.length; i++) {
            setProgress(((i) / subs.length) * 30, `Scanning r/${subs[i]}...`);
            const posts = await fetchRedditPosts(subs[i], limit, timeSpan, sortBy);
            allPosts.push(...posts);
        }
        setProgress(30, `Fetched ${allPosts.length} posts. Filtering for pain points...`);

        // 2. Filter for pain points
        const painPosts = filterPainPoints(allPosts, keywords);
        setProgress(40, `Found ${painPosts.length} potential pain-point posts. Analyzing with AI...`);

        if (painPosts.length === 0) {
            toast('No pain-point posts found. Try different subreddits or keywords.', 'error');
            resetUI();
            return;
        }

        // 3. Batch pain posts into chunks for AI analysis
        const chunkSize = 8;
        const chunks = [];
        for (let i = 0; i < painPosts.length; i += chunkSize) {
            chunks.push(painPosts.slice(i, i + chunkSize));
        }

        allIdeas = [];
        for (let i = 0; i < chunks.length; i++) {
            const pct = 40 + ((i + 1) / chunks.length) * 55;
            setProgress(pct, `AI analysis: batch ${i + 1}/${chunks.length}...`);
            const ideas = await analyzeWithAI(chunks[i], key);
            allIdeas.push(...ideas);
        }

        setProgress(100, 'Done!');

        // 4. Display results
        displayResults(allPosts.length, painPosts.length, allIdeas);

    } catch (err) {
        console.error(err);
        toast('Error: ' + err.message, 'error');
    } finally {
        resetUI();
    }
});

// ── Reddit Fetch ────────────────────────────────────────────────
// Tries: 1) server proxy (handles live + fallback) → 2) direct Reddit JSON
let dataSource = 'live';

async function fetchRedditPosts(sub, limit, time, sort) {
    // Attempt 1: backend proxy (handles Reddit API + demo fallback)
    try {
        const proxyUrl = `/api/reddit/${encodeURIComponent(sub)}?sort=${sort}&t=${time}&limit=${limit}`;
        const proxyResp = await fetch(proxyUrl);
        if (proxyResp.ok) {
            const proxyData = await proxyResp.json();
            if (proxyData.source === 'demo') dataSource = 'demo';
            if (proxyData.posts?.length) return proxyData.posts;
        }
    } catch { /* proxy not running, fall through */ }

    // Attempt 2: direct Reddit JSON (works from user's browser on non-blocked IPs)
    const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/search.json?q=*&restrict_sr=1&sort=${sort}&t=${time}&limit=${limit}`;
    const topUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/top.json?t=${time}&limit=${limit}`;
    const hotUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json?limit=${limit}`;

    let fetchUrl;
    if (sort === 'top') fetchUrl = topUrl;
    else if (sort === 'hot') fetchUrl = hotUrl;
    else fetchUrl = url;

    try {
        const resp = await fetch(fetchUrl, {
            headers: { 'User-Agent': 'IdeaPicker/1.0' }
        });
        if (!resp.ok) throw new Error(`Reddit returned ${resp.status} for r/${sub}`);
        const data = await resp.json();
        const children = data.data?.children || [];
        return children.map(c => ({
            title: c.data.title,
            selftext: c.data.selftext || '',
            subreddit: c.data.subreddit,
            score: c.data.score,
            num_comments: c.data.num_comments,
            url: `https://reddit.com${c.data.permalink}`,
            author: c.data.author,
            created: c.data.created_utc,
        }));
    } catch (err) {
        console.warn(`Failed to fetch r/${sub}: ${err.message}`);
        return [];
    }
}

// ── Pain-Point Filter ───────────────────────────────────────────
const DEFAULT_PAIN_WORDS = [
    'frustrated', 'frustrating', 'hate', 'hated', 'annoying', 'annoyed',
    'terrible', 'horrible', 'awful', 'worst', 'broken', 'bug', 'buggy',
    'wish', 'wished', 'need', 'needed', 'want', 'wanted', 'looking for',
    'struggle', 'struggling', 'pain', 'painful', 'problem', 'issue',
    'complaint', 'complain', 'impossible', 'difficult', 'hard to',
    'why is', 'why does', 'why can\'t', 'can\'t believe', 'fed up',
    'sick of', 'tired of', 'waste of', 'doesn\'t work', 'won\'t work',
    'anyone else', 'is it just me', 'rant', 'vent', 'help me',
    'alternative to', 'replacement for', 'better than', 'instead of',
    'expensive', 'overpriced', 'costs too much', 'not worth',
    'missing feature', 'lack of', 'no way to', 'can\'t find',
    'sucks', 'ridiculous', 'unacceptable', 'disappointing'
];

function filterPainPoints(posts, userKeywords) {
    const words = userKeywords.length ? userKeywords : DEFAULT_PAIN_WORDS;
    const pattern = new RegExp(words.join('|'), 'i');
    return posts.filter(p => {
        const text = (p.title + ' ' + p.selftext).toLowerCase();
        return pattern.test(text);
    }).sort((a, b) => (b.score + b.num_comments) - (a.score + a.num_comments));
}

// ── AI Analysis (OpenAI) ────────────────────────────────────────
async function analyzeWithAI(posts, apiKey) {
    const postsText = posts.map((p, i) =>
        `[${i+1}] r/${p.subreddit} (score:${p.score}, comments:${p.num_comments})\nTitle: ${p.title}\nBody: ${(p.selftext || '').slice(0, 400)}\nURL: ${p.url}`
    ).join('\n\n');

    const systemPrompt = `You are IdeaPicker, an expert startup analyst. You analyze Reddit posts to identify real user pain points and transform them into viable startup ideas.

For each distinct pain point you identify from the posts, generate a startup idea with:
1. A catchy startup name
2. One-line pitch
3. The core pain point (from the Reddit posts)
4. Detailed solution description
5. Target market & size estimate
6. Revenue model (subscription tiers, pricing)
7. Monthly Revenue Estimate (MRR) — be realistic, give a range
8. Annual Revenue Potential (ARR)
9. Confidence score (1-10) based on engagement, specificity, market size
10. Key features (3-5 bullet points)
11. Competitors / existing solutions
12. Why this is better

Respond ONLY with valid JSON — an array of objects with these keys:
{
  "name": "string",
  "pitch": "string",
  "painPoint": "string",
  "solution": "string",
  "targetMarket": "string",
  "marketSize": "string",
  "revenueModel": "string",
  "mrrEstimate": "string",
  "arrEstimate": "string",
  "confidence": number,
  "features": ["string"],
  "competitors": "string",
  "differentiator": "string",
  "sourceSubreddit": "string",
  "sourceUrl": "string"
}

Group similar complaints into single ideas. Be creative but realistic. Return 2-5 ideas.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.8,
            max_tokens: 4000,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze these Reddit posts and generate startup ideas:\n\n${postsText}` },
            ],
        }),
    });

    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI API returned ${resp.status}`);
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // Extract JSON from possible markdown code fences
    const jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    try {
        const ideas = JSON.parse(jsonStr);
        return Array.isArray(ideas) ? ideas : [ideas];
    } catch {
        console.warn('Failed to parse AI response:', content);
        return [];
    }
}

// ── Display Results ─────────────────────────────────────────────
function displayResults(totalPosts, painCount, ideas) {
    // Stats
    statPosts.textContent = totalPosts;
    statPain.textContent = painCount;
    statIdeas.textContent = ideas.length;

    const totalRevenue = ideas.reduce((sum, idea) => {
        const match = (idea.arrEstimate || '').match(/[\d,.]+/g);
        if (match) {
            const nums = match.map(n => parseFloat(n.replace(/,/g, '')));
            return sum + Math.max(...nums);
        }
        return sum;
    }, 0);
    statRevenue.textContent = '$' + formatNum(totalRevenue);

    statsRow.classList.remove('hidden');
    resultsSection.classList.remove('hidden');

    // Cards
    resultsGrid.innerHTML = '';
    ideas.forEach((idea, idx) => {
        const card = document.createElement('div');
        card.className = 'idea-card';
        card.innerHTML = `
            <span class="card-badge">${idea.confidence || '?'}/10</span>
            <h3>${esc(idea.name || 'Untitled Idea')}</h3>
            <p class="pain-point">${esc(idea.painPoint || '')}</p>
            <p style="font-size:.9rem;color:var(--text)">${esc(idea.pitch || '')}</p>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <span class="subreddit-tag">r/${esc(idea.sourceSubreddit || '?')}</span>
            </div>
            <div class="revenue-row">
                <span class="revenue-tag">${esc(idea.mrrEstimate || 'N/A')} MRR</span>
                <span class="confidence-tag">ARR: ${esc(idea.arrEstimate || 'N/A')}</span>
            </div>
        `;
        card.addEventListener('click', () => openModal(idea));
        resultsGrid.appendChild(card);
    });
}

// ── Modal ────────────────────────────────────────────────────────
function openModal(idea) {
    modalContent.innerHTML = `
        <h2>${esc(idea.name)}</h2>
        <p style="color:var(--accent2);font-size:1.05rem;margin-bottom:20px">${esc(idea.pitch)}</p>

        <div class="modal-section">
            <h4>Pain Point</h4>
            <p style="border-left:3px solid var(--danger);padding-left:12px">${esc(idea.painPoint)}</p>
        </div>

        <div class="modal-section">
            <h4>Solution</h4>
            <p>${esc(idea.solution)}</p>
        </div>

        <div class="modal-section">
            <h4>Key Features</h4>
            <ul>${(idea.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>

        <div class="modal-section">
            <h4>Revenue Estimates</h4>
            <div class="modal-revenue-grid">
                <div class="modal-revenue-card">
                    <span class="val">${esc(idea.mrrEstimate || 'N/A')}</span>
                    <span class="lbl">Monthly Recurring Revenue</span>
                </div>
                <div class="modal-revenue-card">
                    <span class="val">${esc(idea.arrEstimate || 'N/A')}</span>
                    <span class="lbl">Annual Revenue Potential</span>
                </div>
            </div>
        </div>

        <div class="modal-section">
            <h4>Target Market</h4>
            <p>${esc(idea.targetMarket)}</p>
            <p style="color:var(--muted);font-size:.88rem;margin-top:4px">Market Size: ${esc(idea.marketSize)}</p>
        </div>

        <div class="modal-section">
            <h4>Revenue Model</h4>
            <p>${esc(idea.revenueModel)}</p>
        </div>

        <div class="modal-section">
            <h4>Competitors</h4>
            <p>${esc(idea.competitors)}</p>
        </div>

        <div class="modal-section">
            <h4>Why This Is Better</h4>
            <p>${esc(idea.differentiator)}</p>
        </div>

        <div class="modal-section">
            <h4>Source</h4>
            <a href="${esc(idea.sourceUrl)}" target="_blank" rel="noopener" class="reddit-link">
                View original Reddit post &rarr;
            </a>
        </div>

        <div style="text-align:center;margin-top:16px">
            <span style="font-size:.78rem;color:var(--muted)">Confidence: ${idea.confidence || '?'}/10</span>
        </div>
    `;
    modalBackdrop.classList.remove('hidden');
}

modalClose.addEventListener('click', () => modalBackdrop.classList.add('hidden'));
modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.classList.add('hidden');
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modalBackdrop.classList.add('hidden');
});

// ── Export ───────────────────────────────────────────────────────
$('#export-csv').addEventListener('click', () => {
    if (!allIdeas.length) return;
    const headers = ['Name','Pitch','Pain Point','Solution','Target Market','Market Size','Revenue Model','MRR Estimate','ARR Estimate','Confidence','Competitors','Differentiator','Source Subreddit','Source URL'];
    const rows = allIdeas.map(i => [
        i.name, i.pitch, i.painPoint, i.solution, i.targetMarket, i.marketSize,
        i.revenueModel, i.mrrEstimate, i.arrEstimate, i.confidence,
        i.competitors, i.differentiator, i.sourceSubreddit, i.sourceUrl
    ]);
    let csv = headers.join(',') + '\n';
    rows.forEach(r => {
        csv += r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    downloadFile('ideapicker_ideas.csv', csv, 'text/csv');
});

$('#export-json').addEventListener('click', () => {
    if (!allIdeas.length) return;
    downloadFile('ideapicker_ideas.json', JSON.stringify(allIdeas, null, 2), 'application/json');
});

// ── Helpers ──────────────────────────────────────────────────────
function setProgress(pct, text) {
    progressBar.style.width = pct + '%';
    progressText.textContent = text;
}

function resetUI() {
    scanBtn.disabled = false;
    scanBtn.innerHTML = '<span class="btn-icon">🔍</span> Scan Reddit';
    setTimeout(() => progressSection.classList.add('hidden'), 1500);
}

function toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
}

function formatNum(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K';
    return n.toFixed(0);
}

function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
