// ============================================================================
// USER ID GENERATOR (5-char alphanumeric)
// ============================================================================
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

async function generateUniqueUserId(pool) {
  while (true) {
    const id = generateId();
    const [rows] = await pool.query(
      'SELECT user_id FROM User WHERE user_id = ?',
      [id]
    );
    if (rows.length === 0) return id;
  }
}

// ============================================================================
// IMPORTS
// ============================================================================
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ============================================================================
// CONFIG
// ============================================================================
const domain = process.env.JIIT_DOMAIN;
const appUrl = process.env.APP_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// Check JIIT email
function isJiitMail(email) {
  return email.endsWith('@' + domain);
}

// ============================================================================
// REGISTER USER
// ============================================================================
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, dept, year } = req.body;

    // Validate domain
    if (!isJiitMail(email)) {
      return res.status(400).json({
        error: `Use your JIIT email (@${domain})`
      });
    }

    // Check existing user
    const [existing] = await pool.query(
      'SELECT user_id FROM User WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Account already exists for this email' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Generate 5-character secret Chat ID
    const newId = await generateUniqueUserId(pool);

    // INSERT user (auto-verified)
    await pool.query(
      'INSERT INTO User (user_id, name, email, password, dept, year, is_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [newId, name, email, hash, dept, year]
    );

    console.log('User registered and auto-verified:', email);

    return res.json({
      msg: 'Registration successful! You can now log in.',
      user_id: newId
    });

  } catch (e) {
    console.error('Registration error:', e);
    res.status(500).json({ error: 'Registration failed: ' + e.message });
  }
});

// ============================================================================
// LOGIN USER
// ============================================================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [u] = await pool.query(
      'SELECT * FROM User WHERE email = ?',
      [email]
    );

    if (!u.length) {
      return res.status(400).json({ error: 'No user found with this email' });
    }

    const user = u[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ error: 'Wrong password' });
    }

    // Create JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Remove password before sending to frontend
    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================================================
// VERIFY TOKEN
// ============================================================================
router.get('/verify-token', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    const [rows] = await pool.query(
      `SELECT user_id, name, email, dept, year, role, is_active, 
              is_verified, warning_count, warning_level, created_at
       FROM User WHERE user_id = ?`,
      [payload.user_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: rows[0] });

  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
