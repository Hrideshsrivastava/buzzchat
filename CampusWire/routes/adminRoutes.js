// // routes/adminRoutes.js
// const express = require('express');
// const router = express.Router();
// const pool = require('../db');
// const auth = require('../middleware/auth');

// // --- middleware to ensure only admin access ---
// async function ensureAdmin(req, res, next) {
//   if (!req.user || req.user.role !== 'Admin') {
//     return res.status(403).json({ error: 'Admin access required' });
//   }
//   next();
// }

// // ========== USERS MANAGEMENT ==========

// // Get all users with warnings
// router.get('/users', auth, ensureAdmin, async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT user_id, name, email, dept, year, role, is_active, is_verified, warning_count, warning_level, created_at 
//        FROM User ORDER BY created_at DESC`
//     );
//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch users' });
//   }
// });

// // Deactivate user manually
// router.post('/user/deactivate', auth, ensureAdmin, async (req, res) => {
//   try {
//     const { user_id } = req.body;
//     await pool.query('UPDATE User SET is_active = 0 WHERE user_id = ?', [user_id]);
//     res.json({ msg: 'User deactivated' });
//   } catch (err) {
//     res.status(500).json({ error: 'Could not deactivate user' });
//   }
// });

// // Reactivate user manually
// router.post('/user/reactivate', auth, ensureAdmin, async (req, res) => {
//   try {
//     const { user_id } = req.body;
//     await pool.query('UPDATE User SET is_active = 1 WHERE user_id = ?', [user_id]);
//     res.json({ msg: 'User reactivated' });
//   } catch (err) {
//     res.status(500).json({ error: 'Could not reactivate user' });
//   }
// });

// // Manually issue a warning
// router.post('/user/warn', auth, ensureAdmin, async (req, res) => {
//   try {
//     const { user_id, reason } = req.body;
//     await pool.query('INSERT INTO Warning(user_id, reason) VALUES (?, ?)', [user_id, reason || 'Manual warning']);
//     await pool.query('UPDATE User SET warning_count = warning_count + 1 WHERE user_id = ?', [user_id]);
//     const [[user]] = await pool.query('SELECT warning_count FROM User WHERE user_id = ?', [user_id]);
//     if (user.warning_count >= process.env.WARN_THRESHOLD) {
//       await pool.query('UPDATE User SET is_active = 0 WHERE user_id = ?', [user_id]);
//     }
//     res.json({ msg: 'Warning issued' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to issue warning' });
//   }
// });

// // ========== POSTS MANAGEMENT ==========

// // Get all flagged posts
// router.get('/flagged-posts', auth, ensureAdmin, async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT P.post_id, P.content, P.created_at, P.status, U.name, U.email 
//        FROM Post P JOIN User U ON P.user_id = U.user_id 
//        WHERE P.status = 'Flagged' ORDER BY P.created_at DESC`
//     );
//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch flagged posts' });
//   }
// });

// // Delete post manually
// router.post('/post/delete', auth, ensureAdmin, async (req, res) => {
//   try {
//     const { post_id } = req.body;
//     await pool.query('DELETE FROM Post WHERE post_id = ?', [post_id]);
//     res.json({ msg: 'Post deleted' });
//   } catch (err) {
//     res.status(500).json({ error: 'Could not delete post' });
//   }
// });

// // ========== FESTIVAL THEME MANAGEMENT ==========

// // Get all themes
// router.get('/themes', auth, ensureAdmin, async (req, res) => {
//   try {
//     const [themes] = await pool.query('SELECT * FROM FestivalTheme ORDER BY start_date DESC');
//     res.json(themes);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Failed to fetch themes' });
//   }
// });

// // Add new festival theme
// router.post('/themes/add', auth, ensureAdmin, async (req, res) => {
//   try {
//     const { festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image } = req.body;
//     await pool.query(
//       'INSERT INTO FestivalTheme (festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
//       [festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image]
//     );
//     res.json({ msg: 'Theme added successfully' });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Could not add theme' });
//   }
// });

// module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

async function ensureAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

router.get('/users', auth, ensureAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, name, email, dept, year, role, is_active, is_verified, warning_count, warning_level, created_at 
       FROM User ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/user/deactivate', auth, ensureAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.query('UPDATE User SET is_active = 0 WHERE user_id = ?', [user_id]);
    res.json({ msg: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Could not deactivate user' });
  }
});

router.post('/user/reactivate', auth, ensureAdmin, async (req, res) => {
  try {
    const { user_id } = req.body;
    await pool.query('UPDATE User SET is_active = 1 WHERE user_id = ?', [user_id]);
    res.json({ msg: 'User reactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Could not reactivate user' });
  }
});

router.post('/user/warn', auth, ensureAdmin, async (req, res) => {
  try {
    const { user_id, reason } = req.body;
    await pool.query('INSERT INTO Warning(user_id, reason) VALUES (?, ?)', [user_id, reason || 'Manual warning']);
    await pool.query('UPDATE User SET warning_count = warning_count + 1 WHERE user_id = ?', [user_id]);
    const [[user]] = await pool.query('SELECT warning_count FROM User WHERE user_id = ?', [user_id]);
    if (user.warning_count >= process.env.WARN_THRESHOLD) {
      await pool.query('UPDATE User SET is_active = 0 WHERE user_id = ?', [user_id]);
    }
    res.json({ msg: 'Warning issued' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to issue warning' });
  }
});

router.get('/flagged-posts', auth, ensureAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT P.post_id, P.content, P.created_at, P.status, U.name, U.email 
       FROM Post P JOIN User U ON P.user_id = U.user_id 
       WHERE P.status = 'Flagged' ORDER BY P.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch flagged posts' });
  }
});

router.post('/post/delete', auth, ensureAdmin, async (req, res) => {
  try {
    const { post_id } = req.body;
    await pool.query('DELETE FROM Post WHERE post_id = ?', [post_id]);
    res.json({ msg: 'Post deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete post' });
  }
});

router.get('/themes', auth, ensureAdmin, async (req, res) => {
  try {
    const [themes] = await pool.query('SELECT * FROM FestivalTheme ORDER BY start_date DESC');
    res.json(themes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

router.post('/themes/add', auth, ensureAdmin, async (req, res) => {
  try {
    const { festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image } = req.body;
    await pool.query(
      'INSERT INTO FestivalTheme (festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [festival_name, start_date, end_date, primary_color, secondary_color, background_image, banner_image]
    );
    res.json({ msg: 'Theme added successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add theme' });
  }
});

module.exports = router;