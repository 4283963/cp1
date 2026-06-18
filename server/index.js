const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const WAREHOUSE_W = 50;
const WAREHOUSE_H = 30;
const FORKLIFTS = [
  { id: 'F-001', x: 5, y: 5, prevX: 5, prevY: 5 },
  { id: 'F-002', x: 25, y: 15, prevX: 25, prevY: 15 },
  { id: 'F-003', x: 40, y: 10, prevX: 40, prevY: 10 },
];

function updatePositions() {
  FORKLIFTS.forEach((f) => {
    f.prevX = f.x;
    f.prevY = f.y;
    f.x = Math.max(0, Math.min(WAREHOUSE_W, f.x + (Math.random() - 0.5) * 6));
    f.y = Math.max(0, Math.min(WAREHOUSE_H, f.y + (Math.random() - 0.5) * 6));
  });
}

function calcSpeed(f) {
  const dx = f.x - f.prevX;
  const dy = f.y - f.prevY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.round(dist * 2 * 10) / 10;
}

function broadcast() {
  updatePositions();
  const payload = FORKLIFTS.map((f) => ({
    id: f.id,
    x: Math.round(f.x * 100) / 100,
    y: Math.round(f.y * 100) / 100,
    speed: calcSpeed(f),
  }));
  const msg = JSON.stringify(payload);
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  });
}

setInterval(broadcast, 500);

wss.on('connection', (ws) => {
  const snapshot = FORKLIFTS.map((f) => ({
    id: f.id,
    x: Math.round(f.x * 100) / 100,
    y: Math.round(f.y * 100) / 100,
    speed: 0,
  }));
  ws.send(JSON.stringify(snapshot));
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
