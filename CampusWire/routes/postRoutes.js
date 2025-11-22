// // routes/postRoutes.js
// const express = require('express');
// const router = express.Router();
// const pool = require('../db');
// const multer = require('multer');
// const path = require('path');
// const { containsBadWord } = require('../utils/profanity');
// const auth = require('../middleware/auth');

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, path.join(__dirname, '../uploads'));
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

// const fileFilter = (req, file, cb) => {
//     if (file.mimetype.startsWith('image/')) {
//         cb(null, true);
//     } else {
//         cb(new Error('Only image files are allowed'), false);
//     }
// };

// const upload = multer({
//     storage: storage,
//     fileFilter: fileFilter,
//     limits: {
//         fileSize: 5 * 1024 * 1024 // 5MB limit
//     }
// });

// // Create post
// router.post('/', auth, upload.single('image'), async (req, res) => {
//     try {
//         const { content, emotion } = req.body;
//         const user = req.user;
//         let imagePath = req.file ? `/uploads/${req.file.filename}` : null;

//         // Validate input
//         if (!content || content.trim().length === 0) {
//             return res.status(400).json({ error: 'Post content is required' });
//         }

//         if (content.length > 1000) {
//             return res.status(400).json({ error: 'Post content too long (max 1000 characters)' });
//         }

//         // Profanity check
//         if (containsBadWord(content)) {
//             await pool.query('INSERT INTO Warning(user_id, reason) VALUES(?, ?)', [user.user_id, 'Indecent language in post']);
//             await pool.query('UPDATE User SET warning_count = warning_count + 1 WHERE user_id = ?', [user.user_id]);
            
//             const [[u]] = await pool.query('SELECT warning_count FROM User WHERE user_id = ?', [user.user_id]);
//             if (u.warning_count >= process.env.WARN_THRESHOLD) {
//                 await pool.query('UPDATE User SET is_active = 0 WHERE user_id = ?', [user.user_id]);
//                 return res.status(403).json({ 
//                     error: 'Account deactivated due to excessive warnings. Please contact administrator.' 
//                 });
//             }
            
//             return res.status(400).json({ 
//                 error: 'Post contains inappropriate language. Warning has been issued.' 
//             });
//         }

//         const [result] = await pool.query(
//             'INSERT INTO Post(user_id, content, image_path, emotion) VALUES(?, ?, ?, ?)',
//             [user.user_id, content.trim(), imagePath, emotion || 'Neutral']
//         );
        
//         res.json({ 
//             msg: 'Post created successfully', 
//             post_id: result.insertId 
//         });
        
//     } catch (error) {
//         console.error('Post creation error:', error);
        
//         if (error.code === 'ER_DATA_TOO_LONG') {
//             return res.status(400).json({ error: 'Post content too long' });
//         }
        
//         res.status(500).json({ error: 'Failed to create post' });
//     }
// });

// // Get all posts
// router.get('/', auth, async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             `SELECT P.*, U.name, U.dept, U.year 
//              FROM Post P 
//              JOIN User U ON P.user_id = U.user_id 
//              WHERE P.status = 'Active' 
//              ORDER BY P.created_at DESC`
//         );
        
//         res.json(rows);
//     } catch (error) {
//         console.error('Error fetching posts:', error);
//         res.status(500).json({ error: 'Failed to fetch posts' });
//     }
// });

// // Get single post
// router.get('/:id', auth, async (req, res) => {
//     try {
//         const [rows] = await pool.query(
//             `SELECT P.*, U.name, U.dept, U.year 
//              FROM Post P 
//              JOIN User U ON P.user_id = U.user_id 
//              WHERE P.post_id = ? AND P.status = 'Active'`,
//             [req.params.id]
//         );
        
//         if (rows.length === 0) {
//             return res.status(404).json({ error: 'Post not found' });
//         }
        
//         res.json(rows[0]);
//     } catch (error) {
//         console.error('Error fetching post:', error);
//         res.status(500).json({ error: 'Failed to fetch post' });
//     }
// });

// module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');

// Simple profanity check function (temporary)
function containsBadWord(text = '') {
  const profane = ['idiot', 'stupid', 'fuck', 'shit', 'bitch', 'asshole'];
  const t = text.toLowerCase();
  return profane.some(w => t.includes(w));
}

const upload = multer({ dest: path.join(__dirname, '../uploads') });

router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { content, emotion } = req.body;
    const user = req.user;
    let imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (containsBadWord(content)) {
      await pool.query('INSERT INTO Warning(user_id, reason) VALUES(?, ?)', [user.user_id, 'Indecent language']);
      await pool.query('UPDATE User SET warning_count = warning_count + 1 WHERE user_id = ?', [user.user_id]);
      
      const [[u]] = await pool.query('SELECT warning_count FROM User WHERE user_id = ?', [user.user_id]);
      if (u.warning_count >= process.env.WARN_THRESHOLD) {
        await pool.query('UPDATE User SET is_active = 0 WHERE user_id = ?', [user.user_id]);
      }
      
      return res.status(400).json({ error: 'Post contains indecent words. Warning added.' });
    }

    const [r] = await pool.query(
      'INSERT INTO Post(user_id, content, image_path, emotion) VALUES(?, ?, ?, ?)',
      [user.user_id, content, imagePath, emotion || 'Neutral']
    );
    
    res.json({ msg: 'Posted', post_id: r.insertId });
  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT P.*, U.name FROM Post P JOIN User U ON P.user_id = U.user_id
       WHERE P.status = 'Active' ORDER BY P.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

module.exports = router;