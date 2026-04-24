# 🦕 DinoLand

A vanilla-JS canvas platformer. No build step, no dependencies — just HTML + JS.

## How to run it

The game is a static page that talks to `localStorage`, so it **must be served over HTTP** — double-clicking `index.html` (the `file://` protocol) works in most browsers but some features (like Save Skin) can behave oddly, so serve it instead.

### Option A — VS Code with Live Server (easiest)

1. Open this repo in VS Code.
2. Install the **Live Server** extension by *Ritwick Dey* (Ctrl+Shift+X → search `Live Server` → Install).
3. In the Explorer, right-click `Python/dino-platformer/index.html` → **Open with Live Server**.
4. A browser tab opens at something like `http://127.0.0.1:5500/Python/dino-platformer/index.html` and the game loads.

### Option B — Terminal, no extension

```bash
cd Python/dino-platformer
python3 -m http.server 8000   # or: python -m http.server 8000
```

Then open http://localhost:8000/index.html in your browser.

### Option C — Node (if you have it)

```bash
cd Python/dino-platformer
npx serve .
```

Follow the URL it prints (usually http://localhost:3000).

## Controls

- **← →** — Move
- **Space / ↑ / W** — Jump (double-jump!)
- **↓** — Stomp

Collect **🦴 Bones** and **🥚 Eggs**. Stomp enemies to defeat them. Reach the **✨ Exit Portal** to advance. Boss fight every 5 levels.

## Shop

Click **🛒 SHOP** on the title screen or **🛒 GO TO SHOP** on the Game Over screen to spend bones on skins:

| Skin            | Cost      |
| --------------- | --------- |
| Classic Rex     | Free      |
| Azure Raptor    | 25 🦴     |
| Crimson Fang    | 50 🦴     |
| Golden Tyrant   | 100 🦴    |
| Shadow Stalker  | 150 🦴    |
| Prismarex       | 300 🦴 (rainbow) |

Bones, owned skins, and the equipped skin persist across runs in `localStorage` (key: `dinoland_save_v1`). Clear that key to reset your progression.

## Useful URL tricks

- `index.html?level=N` — jump straight to level `N` (1-15). Handy for testing the boss fights on 5 / 10 / 15.

## Troubleshooting

- **"localhost can't be found" after clicking Run in VS Code** — the default Run button doesn't start an HTTP server. Use Option A or B above.
- **Game shows but buttons / localStorage don't work on `file://`** — serve it over HTTP instead (Options A–C).
