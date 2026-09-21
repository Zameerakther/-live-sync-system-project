# NEXUS AI

A cinematic, Jarvis-*inspired* (fully original — no movie assets, logos, or quotes) personal AI
operating system and gaming-content studio. A real Express + WebSocket backend drives a React HUD
with voice, an AI core visualizer, a production pipeline that renders actual MP4s via FFmpeg, and a
YouTube queue with OAuth publish — all runnable entirely on **free/local** engines.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND  (React + TS + Vite + Tailwind, zustand store)          │
│  services/api.ts ── REST ──┐            Electron desktop wraps    │
│  services/ws.ts ── WS ─────┤            the same UI (dist-electron)│
└────────────────────────────┼──────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND  Express + ws  (port 5000, WS at /ws)                    │
│  ├── AIOrchestrator ─ per-session history, slot-filling,          │
│  │   provider: mock | ollama | openai | groq | gemini | anthropic │
│  ├── ToolRegistry ── 18 real tools (files, ffmpeg, DDG, calc, …)  │
│  ├── PermissionManager + ConfirmationManager (WS modals + REST)   │
│  ├── TaskRunnerModule ── sequential step executor, pause/resume   │
│  ├── GamingModule ── concept → script → TTS → render → thumb      │
│  └── SQLite (better-sqlite3): memories/tasks/concepts/queue/…     │
└─────────────────────────────────────────────────────────────────┘
```

## Feature matrix

| Feature | Status | Engine |
|---|---|---|
| Chat + slot-filling ("create a gaming video" → game → style) | ✅ Real | Mock (offline) or LLM |
| Language detect + switch, 12 languages, RTL | ✅ Real | `franc` + Unicode ranges |
| System metrics (CPU/RAM/disk/net/GPU) | ✅ Real | `systeminformation` |
| Web research | ✅ Real | DuckDuckGo HTML |
| File tools in approved dirs | ✅ Real | fs |
| Video/thumbnail render | ✅ Real | FFmpeg |
| Offline TTS to WAV | ⚠️ Optional binary | espeak-ng / espeak / say |
| Voice STT/TTS | ⚠️ Chrome/Edge only | Web Speech API |
| YouTube OAuth + upload + schedule | 🔑 Needs credentials | googleapis |
| Cloud LLM providers (Groq/Gemini free, OpenAI/Anthropic paid) | 🔑 Needs API key | chat-completions |

## Free-engine setup

```bash
# 1. Ollama — free local LLM (https://ollama.com)
ollama pull llama3.2

# 2. FFmpeg — video/thumbnail rendering
sudo apt install ffmpeg        # or brew install ffmpeg

# 3. espeak-ng — offline TTS for commentary audio (optional)
sudo apt install espeak-ng

# Then set: DEFAULT_AI_PROVIDER=ollama  in backend/.env
```

## Install & run

```bash
cp .env.example backend/.env   # optional — defaults are fully offline
npm install                    # workspaces: backend + frontend + desktop
npm run dev                    # backend :5000 + frontend :3000 (concurrently)

# production, single port :5000 (backend serves frontend/dist)
npm run build && npm run start
```

## Desktop app (Electron)

```bash
npm run dev:desktop            # all three (uses vite :3000 dev server)
npm run package --workspace=desktop   # electron-builder: win nsis / linux AppImage
```

Frameless window, tray icon (Show/Hide/Quit, launch-at-login), global `Ctrl+Space` → show +
toggle mic via IPC (`window.nexus.onToggleMic`), native notifications on backend events, backend
auto-spawn in production builds.

## Docker

```bash
docker compose config          # validate
docker compose up --build      # backend:5000 + nginx frontend:3000 (sqlite data at /data volume)
docker compose --profile postgres up   # optional postgres container (driver pending; SQLite used)
```

## YouTube OAuth setup

1. Google Cloud Console → create project → enable **YouTube Data API v3**.
2. Credentials → **OAuth 2.0 Client ID** (Web application).
3. Authorized redirect URI: `http://localhost:5000/api/youtube/oauth2callback`.
4. Put `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` in `backend/.env`.
5. HUD → Production tab → **Connect** → sign in with Google.

## Permissions & approved directories

File tools can only touch `NEXUS_STORAGE_DIR` (default `~/NexusAI`, e.g. `D:/NexusAI` on Windows)
plus dirs in `NEXUS_APPROVED_DIRS`. Out-of-scope paths trigger a `PERMISSION_REQUEST` modal —
Grant adds the dir permanently. Dangerous tools (code execution, publish, shell) always require
an on-screen confirmation.

## Voice commands

"Hey Nexus …" (wake word) or `Ctrl+Space` (push-to-talk), then:

- `Create a gaming video` → *GTA V* → *fast cinematic*
- `Switch to Spanish` / any of the 12 languages
- `Search the web for …`, `Translate "hello" to French`
- `Calculate 12 * 7`, `What time is it`, `Open youtube`, `Open vscode`
- `Show my tasks`, `Pause/resume/cancel task`, `Show logs`
- `System status`, `Notify me when done`

## Testing

```bash
npm test              # backend vitest suite + frontend store tests
npm run typecheck     # tsc --noEmit, both workspaces
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| No mic / STT silent | Web Speech needs **Chrome/Edge** and mic permission; serve on localhost |
| "Ollama unreachable" dev log | `ollama serve` + `ollama pull llama3.2`, or leave provider on `mock` |
| "FFmpeg not installed" tool failure | `apt install ffmpeg` (it's on PATH in Docker) |
| YouTube "not configured" | set YOUTUBE_CLIENT_ID/SECRET, see OAuth steps |
| File tool "Permission required" | approve the PERMISSION_REQUEST modal or add dir to NEXUS_APPROVED_DIRS |

## Folder layout

```
nexus-ai/
├── backend/            Express+ws API, AI providers, tools, modules, SQLite
│   ├── src/ai/         orchestrator, providers, languageDetector, contentGen
│   ├── src/core/       logger, permissions, confirmations
│   ├── src/database/   schema.sql + repository layer
│   ├── src/modules/    tasks, gaming, youtube, memory, system
│   ├── src/tools/      registry + real tool implementations
│   └── tests/          vitest suite
├── frontend/           React HUD (zustand store, services, components, canvas core)
├── desktop/            Electron wrapper (main.ts, preload.ts, tray, global hotkey)
├── shared/             types shared by front/back (type mirror)
└── docker/             Dockerfiles + nginx conf; docker-compose.yml at root
```
