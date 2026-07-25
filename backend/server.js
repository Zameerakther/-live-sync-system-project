import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { liveData } from './data.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || true,
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
}));
app.use(express.json());

function broadcast() {
  io.emit('live-data:updated', liveData);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/live-data', (_req, res) => {
  res.json(liveData);
});

app.post('/api/live-data', (req, res) => {
  const { title, content, type = 'info' } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'title and content are required' });
  }

  const item = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    content: String(content).trim(),
    type: String(type).trim(),
    createdAt: new Date().toISOString(),
  };

  liveData.unshift(item);
  broadcast();
  res.status(201).json(item);
});

app.delete('/api/live-data/:id', (req, res) => {
  const index = liveData.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const removed = liveData.splice(index, 1);
  broadcast();
  res.json(removed[0]);
});

io.on('connection', (socket) => {
  socket.emit('live-data:updated', liveData);

  socket.on('admin:publish', (payload) => {
    const { title, content, type = 'info' } = payload || {};
    if (!title || !content) return;

    const item = {
      id: crypto.randomUUID(),
      title: String(title).trim(),
      content: String(content).trim(),
      type: String(type).trim(),
      createdAt: new Date().toISOString(),
    };

    liveData.unshift(item);
    broadcast();
  });

  socket.on('admin:delete', (id) => {
    const index = liveData.findIndex((item) => item.id === id);
    if (index !== -1) {
      liveData.splice(index, 1);
      broadcast();
    }
  });
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Live sync server running on port ${PORT}`);
});
