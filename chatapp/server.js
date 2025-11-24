
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Socket.io
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST'] }
});

// MySQL pool (same DB)
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'campuswire_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// -----------------------------
// Data Structures (Chat-specific)
// -----------------------------

// 1) In-memory cache for user names (small LRU-like behavior)
const userCache = new Map(); // user_id -> { name, cachedAt }
async function getUserName(userId) {
  if (userCache.has(userId) && (Date.now() - userCache.get(userId).cachedAt) < 1000 * 60 * 60) {
    return userCache.get(userId).name;
  }
  const [rows] = await dbPool.execute('SELECT name FROM User WHERE user_id = ?', [userId]);
  const name = rows[0]?.name || 'Unknown';
  userCache.set(userId, { name, cachedAt: Date.now() });
  return name;
}

// 2) Message queues per chat (for batching/buffering)
const messageQueues = new Map(); // chatId -> [msg, msg, ...]
function pushToQueue(chatId, msg) {
  if (!messageQueues.has(chatId)) messageQueues.set(chatId, []);
  messageQueues.get(chatId).push(msg);
  // example: if queue size > 50, flush to DB (simple batching)
  if (messageQueues.get(chatId).length >= 50) flushQueue(chatId);
}
async function flushQueue(chatId) {
  const q = messageQueues.get(chatId) || [];
  if (!q.length) return;
  const toInsert = q.splice(0, q.length);
  // Bulk insert is possible but for simplicity just insert one by one (could be optimized)
  for (const m of toInsert) {
    try {
      await dbPool.execute('INSERT INTO texts (data, chat_id, user_id, time) VALUES (?, ?, ?, ?)', [m.data, chatId, m.user_id, new Date(m.time)]);
    } catch (err) {
      console.error('Flush insert error:', err);
    }
  }
}

// 3) Online users set
const onlineUsers = new Set();

// 4) Edit history stack (messageId -> [versions...])
const editHistory = new Map();

// -----------------------------
// UTIL: Unique 5-char ID
// -----------------------------
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
async function generateUniqueUserId() {
  while (true) {
    const id = generateId();
    const [rows] = await dbPool.execute('SELECT user_id FROM User WHERE user_id = ?', [id]);
    if (rows.length === 0) return id;
  }
}

// -----------------------------
// API: login/register (simple)
// -----------------------------
app.post('/api/login', async (req, res) => {
  const { userId, password, name } = req.body;
  try {
    if (userId) {
      const [rows] = await dbPool.execute('SELECT * FROM User WHERE user_id = ? AND password = ?', [userId, password]);
      if (rows.length > 0) return res.json({ success: true, user: rows[0] });
      return res.status(401).json({ success: false, message: 'Invalid ID or password.' });
    }
    // register
    const newId = await generateUniqueUserId();
    await dbPool.execute('INSERT INTO User (user_id, name, password) VALUES (?, ?, ?)', [newId, name || 'New User', password]);
    return res.json({ success: true, user: { user_id: newId, name: name || 'New User' }});
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// -----------------------------
// API: fetch chats for a user
// -----------------------------
app.get('/api/user/:userId/chats', async (req, res) => {
  const { userId } = req.params;
  try {
    const [chats] = await dbPool.execute(`
      SELECT c.chat_id,
        CASE
          WHEN c.group_name IS NOT NULL THEN c.group_name
          ELSE (
            SELECT u.name
            FROM participants p2
            JOIN User u ON p2.user_id = u.user_id
            WHERE p2.chat_id = c.chat_id AND p2.user_id != ?
            LIMIT 1
          )
        END AS chat_name
      FROM chats c
      JOIN participants p ON c.chat_id = p.chat_id
      WHERE p.user_id = ?
    `, [userId, userId]);

    for (const chat of chats) {
      const [messages] = await dbPool.execute(`
        SELECT t.id, t.data, t.time, t.user_id
        FROM texts t
        WHERE t.chat_id = ?
        ORDER BY t.time ASC
      `, [chat.chat_id]);

      // attach names fetched via cache
      const withNames = [];
      for (const m of messages) {
        const name = await getUserName(m.user_id);
        withNames.push({ ...m, name, user_id: String(m.user_id) });
      }
      chat.messages = withNames;

      const [participants] = await dbPool.execute(`
        SELECT u.user_id, u.name
        FROM participants p
        JOIN User u ON p.user_id = u.user_id
        WHERE p.chat_id = ?
      `, [chat.chat_id]);

      chat.participants = participants;
    }

    res.json(chats);
  } catch (err) {
    console.error('Fetch chats error:', err);
    res.status(500).json({ error: 'Failed to load chats' });
  }
});

// -----------------------------
// API: create chat using stored proc
// -----------------------------
app.post('/api/createChat', async (req, res) => {
  const { userA, userB } = req.body;
  if (!userA || !userB) return res.status(400).json({ error: 'Both user IDs required' });
  try {
    const [result] = await dbPool.query('CALL CreateOrGetChat(?, ?)', [userA, userB]);
    const chatId = result[0][0].chat_id;
    const [chatInfo] = await dbPool.execute('SELECT * FROM chats WHERE chat_id = ?', [chatId]);
    res.json({ success: true, chat: chatInfo[0] });
  } catch (err) {
    console.error('CreateChat error:', err);
    res.status(500).json({ error: 'Failed to create/get chat' });
  }
});

// -----------------------------
// API: add members, delete/edit via procedures
// -----------------------------
app.post('/api/addMembersToChat', async (req, res) => {
  const { chatId, memberNames, groupName } = req.body;
  if (!chatId || !Array.isArray(memberNames)) return res.status(400).json({ success: false, error: 'Invalid data' });
  try {
    for (const entry of memberNames) {
      const trimmed = entry.trim();
      let userId = null;
      if (/^[A-Za-z0-9]{5}$/.test(trimmed)) {
        const [rows] = await dbPool.execute('SELECT user_id FROM User WHERE user_id = ?', [trimmed]);
        if (rows.length) userId = rows[0].user_id;
      }
      if (!userId) {
        const [rows] = await dbPool.execute('SELECT user_id FROM User WHERE name = ?', [trimmed]);
        if (rows.length) userId = rows[0].user_id;
      }
      if (!userId) return res.status(404).json({ success: false, error: `User not found: "${trimmed}"` });
      await dbPool.execute('INSERT IGNORE INTO participants (chat_id, user_id) VALUES (?, ?)', [chatId, userId]);
    }
    if (groupName && groupName.trim() !== '') {
      await dbPool.execute('UPDATE chats SET group_name = ?, chat_name = ? WHERE chat_id = ?', [groupName, groupName, chatId]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('AddMembers error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    await dbPool.query('CALL DeleteMessage(?, ?)', [id, userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DeleteMessage error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});
app.put('/api/messages/:id', async (req, res) => {
  const { id } = req.params;
  const { userId, newText } = req.body;
  try {
    await dbPool.query('CALL EditMessage(?, ?, ?)', [id, userId, newText]);
    // push prev version to editHistory for undo
    if (!editHistory.has(id)) editHistory.set(id, []);
    editHistory.get(id).push({ changedAt: Date.now(), text: newText });
    res.json({ success: true });
  } catch (err) {
    console.error('EditMessage error:', err);
    res.status(500).json({ success: false, error: 'Failed to edit message' });
  }
});

// -----------------------------
// Socket.IO handlers (with DS usage)
// -----------------------------
io.on('connection', socket => {
  console.log(`Connected → ${socket.id}`);

  // custom 'login' event (if front-end sends)
  socket.on('login', async (userId) => {
    if (!userId) return;
    socket.userId = userId;
    onlineUsers.add(userId);
    console.log('User online:', userId);
  });

  socket.on('joinRoom', chatId => {
    socket.join(chatId);
  });

  socket.on('deleteMessage', data => {
    io.to(data.chatId).emit('messageDeleted', data.msgId);
  });

  socket.on('editMessage', data => {
    io.to(data.chatId).emit('messageEdited', data);
  });

  socket.on('sendMessage', async msg => {
    try {
      const { data, chatId, userId, time } = msg;
      // push to in-memory queue
      pushToQueue(chatId, { data, chatId, user_id: userId, time });

      // for immediate experience, insert to DB and emit (small optimization)
      const [insert] = await dbPool.execute('INSERT INTO texts (data, chat_id, user_id, time) VALUES (?, ?, ?, ?)', [data, chatId, userId, new Date(time)]);
      const messageId = insert.insertId;
      const name = await getUserName(userId);

      const fullMessage = {
        id: messageId,
        data,
        chatId,
        user_id: userId,
        name,
        time
      };

      io.to(chatId).emit('newMessage', fullMessage);
    } catch (err) {
      console.error('Message save error:', err);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
    }
    console.log(`Disconnected → ${socket.id}`);
  });
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Chat server running on port ${PORT}`));
