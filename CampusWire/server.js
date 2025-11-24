/**
 * campuswire_server.js
 * CampusWire main server (port 4000) with Data Structure integrations.
 *
 * Place this in your CampusWire project root and run:
 *   node campuswire_server.js
 *
 * IMPORTANT: keep your existing routes in ./routes/* unchanged.
 * This file exposes DS via app.locals so routes can use them:
 *   const { userCache, chatGraph, onlineUsers, editHistory, Trie } = req.app.locals;
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const reactionRoutes = require('./routes/reactionRoutes');
const themeRoutes = require('./routes/themeRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ---------- Environment validation ----------
const requiredEnvVars = [
  'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME',
  'JWT_SECRET'
];
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

// ---------- Rate limiting ----------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
});

app.use(limiter);
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------
// DATA STRUCTURES (in-memory)
// -----------------------------

// 1) HashMap-style cache for user details (Map)
const userCache = new Map(); // user_id -> { user object... }
// Utility: getUserCached(pool, userId) (example usage from routes)
async function getUserCached(pool, userId) {
  if (userCache.has(userId)) {
    return userCache.get(userId);
  }
  const [rows] = await pool.query('SELECT user_id, name, email, dept, year, role FROM User WHERE user_id = ?', [userId]);
  if (rows.length) {
    userCache.set(userId, rows[0]);
    return rows[0];
  }
  return null;
}

// 2) Set to track online users (Socket/Presence)
const onlineUsers = new Set(); // user_id set

// 3) Edit history stack per message (msgId -> array stack)
const editHistory = new Map(); // msgId -> [previousVersions...]

// 4) Message queues per chat (chatId -> array)
const messageQueues = new Map(); // used for batching / rate-limiting

// 5) A simple Trie for fast username prefix search (autocomplete)
class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEnd = false;
    this.words = new Set(); // optional: contains words (names) under this node for quick suggestions
  }
}
class Trie {
  constructor() {
    this.root = new TrieNode();
  }
  insert(word) {
    let node = this.root;
    for (const ch of word.toLowerCase()) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
      node.words.add(word);
    }
    node.isEnd = true;
  }
  searchPrefix(prefix) {
    let node = this.root;
    for (const ch of prefix.toLowerCase()) {
      node = node.children.get(ch);
      if (!node) return [];
    }
    // return up to 25 suggestions
    return Array.from(node.words).slice(0, 25);
  }
}

// 6) Graph (adjacency list) for chat connections (for suggestions)
class Graph {
  constructor() { this.adj = new Map(); }
  addNode(u) { if (!this.adj.has(u)) this.adj.set(u, new Set()); }
  addEdge(u, v) { this.addNode(u); this.addNode(v); this.adj.get(u).add(v); this.adj.get(v).add(u); }
  neighbors(u) { return this.adj.get(u) ? Array.from(this.adj.get(u)) : []; }
  // BFS up to depth n
  bfs(root, maxDepth = 2) {
    if (!this.adj.has(root)) return [];
    const visited = new Set([root]);
    const q = [{ node: root, depth: 0 }];
    const out = [];
    while (q.length) {
      const { node, depth } = q.shift();
      if (depth >= 1) out.push(node);
      if (depth === maxDepth) continue;
      for (const nb of this.adj.get(node) || []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          q.push({ node: nb, depth: depth + 1 });
        }
      }
    }
    return out;
  }
}

// Instantiate DS and expose via app.locals
app.locals.userCache = userCache;
app.locals.getUserCached = getUserCached;
app.locals.onlineUsers = onlineUsers;
app.locals.editHistory = editHistory;
app.locals.messageQueues = messageQueues;
app.locals.nameTrie = new Trie();
app.locals.chatGraph = new Graph();

// -----------------------------
// ROUTES (existing)
// -----------------------------
app.use('/auth', authRoutes);
app.use('/posts', postRoutes);
app.use('/react', reactionRoutes);
app.use('/theme', themeRoutes);
app.use('/admin', adminRoutes);

// -----------------------------
// Global error / 404
// -----------------------------
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Resource already exists' });
  }
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  res.status(500).json({ error: 'Internal server error' });
});
app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

// -----------------------------
// Helper: load username trie and graph at startup (non-blocking)
// -----------------------------
const pool = require('./db'); // existing DB pool your routes already use
(async function prewarmStructures() {
  try {
    // load names into Trie
    const [users] = await pool.query('SELECT user_id, name FROM User');
    for (const u of users) {
      if (u.name) app.locals.nameTrie.insert(u.name);
    }

    // build chat graph from participants table
    const [rows] = await pool.query('SELECT chat_id, user_id FROM participants');
    // group participants by chat
    const byChat = new Map();
    for (const r of rows) {
      if (!byChat.has(r.chat_id)) byChat.set(r.chat_id, []);
      byChat.get(r.chat_id).push(r.user_id);
    }
    for (const participants of byChat.values()) {
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          app.locals.chatGraph.addEdge(participants[i], participants[j]);
        }
      }
    }
    console.log('Prewarmed Trie and chat graph (users, participants).');
  } catch (err) {
    console.error('Prewarm error (non-fatal):', err);
  }
})();

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`CampusWire server running on port ${PORT}`));
