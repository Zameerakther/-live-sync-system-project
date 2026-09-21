# NEXUS AI - Autonomous Personal AI Assistant & Gaming Studio

NEXUS AI is a futuristic, sci-fi personal AI operating system featuring a voice-first HUD interface, GPU-accelerated animated AI Core, multilingual natural language engine, multi-step task execution runner, Gaming Content AI module, YouTube automation studio, and system telemetry monitor.

---

## 🌟 Key Features

1. **Futuristic Cinematic HUD**:
   - Central WebGL/Canvas hardware-accelerated **NEXUS Core** with 3 rotating particle rings, audio visualizer waveform, and state transitions (`IDLE`, `LISTENING`, `THINKING`, `SPEAKING`, `EXECUTING`, `SUCCESS`, `WARNING`, `ERROR`).
   - Glassmorphism UI panels with dynamic status readouts, sound visualizers, and task monitors.

2. **Voice Engine & Audio Interaction**:
   - Web Audio API real-time spectrum analysis.
   - Continuous wake-word listener ("Nexus", "Computer", "Assistant").
   - Speech-to-Text (STT) and Speech Synthesis (TTS) with barge-in interruption capability.

3. **Multilingual AI Architecture**:
   - Supports 12 languages: English, Arabic, Hindi, Malayalam, Tamil, Urdu, French, Spanish, German, Chinese, Japanese, Korean.
   - Full Right-To-Left (RTL) text layout support for Arabic and Urdu.

4. **Gaming & YouTube Studio**:
   - Support for GTA V, Red Dead Redemption 2, Minecraft, GTA Online.
   - **Originality Engine**: Checks generated concepts against database history to ensure 100% unique scripts, titles, and gameplay plans.
   - YouTube OAuth 2.0 gateway, channel metrics, publication queue, and approval workflow.

5. **AI Brain & Tool Registry**:
   - Provider abstraction supporting OpenAI GPT-4o, Google Gemini, Anthropic Claude, Local LLMs, and a built-in offline **Mock AI Engine**.
   - 15 registered tools: `web_search`, `file_search`, `file_reader`, `calculator`, `code_executor`, `video_generator`, `video_editor`, `image_generator`, `audio_generator`, `youtube`, `scheduler`, `system_monitor`, `browser`, `notification`, `translation`.

6. **System Telemetry & Developer Console**:
   - Real-time CPU, GPU, RAM, Network telemetry updates via WebSocket.
   - Slide-over real-time developer debugging console.

---

## 🚀 Quick Start (Development)

### 1. Install Dependencies
```bash
npm install
npm run install:all
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Launch Application
Run frontend & backend simultaneously:
```bash
npm run dev
```

- **Frontend HUD**: [http://localhost:3000](http://localhost:3000)
- **Backend Gateway**: [http://localhost:5000](http://localhost:5000)
- **WebSocket Link**: `ws://localhost:5000/ws`

---

## 🐳 Docker Deployment

To launch full production stack with PostgreSQL & Redis:
```bash
docker-compose up --build -d
```

---

## 🛡️ License & Originality Notice
Original sci-fi visual design, audio architecture, and code. No copyrighted movie audio samples or proprietary Iron Man UI assets used.
