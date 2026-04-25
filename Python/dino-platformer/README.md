# 🧬 Genesis Lab — Cloning Facility Escape

A vanilla-JS canvas platformer set inside a derelict dino-cloning lab. No build step, no dependencies — just HTML + JS.

**Story.** A late-night cloning run goes wrong and you accidentally print an evil copy of yourself. Before fleeing into the facility, your clone scatters the **clone-machine parts** across the labs and unseals every mutant specimen still in containment. Hunt the parts, put the mutants down, and end your evil twin in the containment vault — or he walks out and takes the world. The intro, two mid-game cutscenes, and a win cutscene tell the story; you can SKIP STORY at any time.

Fight through three biome variants — **Sterile Lab**, **Bio-Dome**, and **Hazard Zone** — across 15 sectors with a boss every 5 sectors. The final boss is your **Evil Clone**.

## How to run it

The game is a static page that talks to `localStorage`, so it **must be served over HTTP** — double-clicking `index.html` (the `file://` protocol) works in most browsers but some features (like saving your skin) can behave oddly, so serve it instead.

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

Recover **⚙️ Clone Parts** and **🥚 Specimen Eggs**. Stomp **mutants** (the green-glowing creatures roaming the facility) to put them down. Reach the **✨ Containment Portal** to advance to the next sector. Boss every 5 sectors:

| Sector | Biome         | Boss            |
| ------ | ------------- | --------------- |
| 5      | Sterile Lab   | Lab Prototype   |
| 10     | Bio-Dome      | Mutant Hybrid   |
| 15     | Hazard Zone   | **Evil Clone**  |

## Clone Lab Shop

Click **🛒 CLONE SHOP** on the title screen or **🛒 GO TO SHOP** on the Game Over screen to spend Clone Parts on skins:

| Skin            | Cost      |
| --------------- | --------- |
| Classic Rex     | Free      |
| Azure Raptor    | 25 ⚙️     |
| Crimson Fang    | 50 ⚙️     |
| Golden Tyrant   | 100 ⚙️    |
| Shadow Stalker  | 150 ⚙️    |
| Prismarex       | 300 ⚙️ (rainbow) |

Clone Parts, owned skins, and the equipped skin persist across runs in `localStorage` (key: `dinoland_save_v1`). Cutscene-seen flags live under `genesislab_cutscenes_seen_v1`. Clear those keys to reset your progression / story.

## Useful URL tricks

- `index.html?level=N` — jump straight to sector `N` (1-15). Handy for testing the prototype fights on 5 / 10 / 15.

## Troubleshooting

- **"localhost can't be found" after clicking Run in VS Code** — the default Run button doesn't start an HTTP server. Use Option A or B above.
- **Game shows but buttons / localStorage don't work on `file://`** — serve it over HTTP instead (Options A–C).
