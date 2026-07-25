# Live Sync System

A simple real-time monitor with an admin portal. Data published by an admin appears instantly on the live monitor screen via Socket.IO.

## Structure

- `backend/` – Express + Socket.IO API (`PORT` defaults to `4000`)
- `frontend/` – React + Vite UI (dev port `5173`)

## Quick start

### 1. Install dependencies

```bash
npm install --prefix backend
npm install --prefix frontend
```

### 2. Start the backend

```bash
npm run dev --prefix backend
```

### 3. Start the frontend

```bash
npm run dev --prefix frontend
```

Open http://localhost:5173.

## Production

Build the frontend, then the backend serves the static files automatically:

```bash
npm run build --prefix frontend
npm start --prefix backend
```

Open http://localhost:4000.

## Features

- Real-time updates using Socket.IO
- Admin portal to publish/delete entries
- Live monitor with type-based color coding (info, success, warning, error)
- REST API: `GET/POST/DELETE /api/live-data`
