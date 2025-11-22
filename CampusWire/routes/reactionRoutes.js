const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// ADD THIS: Get comments for a post
router.get('/comments/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const [comments] = await pool.query(`
      SELECT r.*, u.name as username 
      FROM Reaction r 
      JOIN User u ON r.user_id = u.user_id 
      WHERE r.post_id = ? AND r.type = 'Comment' 
      ORDER BY r.created_at ASC
    `, [postId]);
    
    res.json(comments);
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// router.post('/like', auth, async (req, res) => {
//   try {
//     const { post_id } = req.body;
//     await pool.query('INSERT IGNORE INTO Reaction(post_id, user_id, type) VALUES(?, ?, "Like")', [post_id, req.user.user_id]);
//     res.json({ msg: 'Liked' });
//   } catch (error) {
//     console.error('Like error:', error);
//     res.status(500).json({ error: 'Failed to like post' });
//   }
// });
// Get reaction counts for a post
router.get('/reactions/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const [reactions] = await pool.query(`
      SELECT reaction_type, COUNT(*) as count 
      FROM Reaction 
      WHERE post_id = ? AND type = 'Like'
      GROUP BY reaction_type
    `, [postId]);
    
    const [userReaction] = await pool.query(`
      SELECT reaction_type 
      FROM Reaction 
      WHERE post_id = ? AND user_id = ? AND type = 'Like'
    `, [postId, req.user.user_id]);
    
    res.json({
      counts: reactions,
      userReaction: userReaction[0] || null
    });
  } catch (error) {
    console.error('Failed to fetch reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// Add/update reaction
// Toggle reaction (like/unlike)
router.post('/react', auth, async (req, res) => {
  try {
    const { post_id, reaction_type } = req.body;
    
    // Check if user already reacted to this post
    const [existing] = await pool.query(
      'SELECT * FROM Reaction WHERE post_id = ? AND user_id = ? AND type = "Like"',
      [post_id, req.user.user_id]
    );
    
    if (existing.length > 0) {
      // User already reacted - check if same reaction type
      if (existing[0].reaction_type === reaction_type) {
        // Same reaction - UNLIKE (remove reaction)
        await pool.query(
          'DELETE FROM Reaction WHERE post_id = ? AND user_id = ? AND type = "Like"',
          [post_id, req.user.user_id]
        );
        res.json({ msg: 'Unliked', action: 'removed' });
      } else {
        // Different reaction - UPDATE reaction type
        await pool.query(
          'UPDATE Reaction SET reaction_type = ? WHERE post_id = ? AND user_id = ? AND type = "Like"',
          [reaction_type, post_id, req.user.user_id]
        );
        res.json({ msg: 'Reaction updated', action: 'updated' });
      }
    } else {
      // No existing reaction - ADD new reaction
      await pool.query(
        'INSERT INTO Reaction (post_id, user_id, type, reaction_type) VALUES (?, ?, "Like", ?)',
        [post_id, req.user.user_id, reaction_type]
      );
      res.json({ msg: 'Liked', action: 'added' });
    }
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});
router.post('/comment', auth, async (req, res) => {
  try {
    const { post_id, comment } = req.body;
    await pool.query('INSERT INTO Reaction(post_id, user_id, type, comment_text) VALUES(?, ?, "Comment", ?)', [post_id, req.user.user_id, comment]);
    res.json({ msg: 'Commented' });
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});
// Get who liked a post
router.get('/likes/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const [likes] = await pool.query(`
      SELECT u.name, u.user_id, r.reaction_type, r.created_at 
      FROM Reaction r 
      JOIN User u ON r.user_id = u.user_id 
      WHERE r.post_id = ? AND r.type = 'Like'
      ORDER BY r.created_at DESC
    `, [postId]);
    
    res.json(likes);
  } catch (error) {
    console.error('Failed to fetch likes:', error);
    res.status(500).json({ error: 'Failed to fetch likes' });
  }
});

// Get comment count for posts
router.get('/comments-count/:postId', auth, async (req, res) => {
  try {
    const { postId } = req.params;
    
    const [result] = await pool.query(`
      SELECT COUNT(*) as comment_count 
      FROM Reaction 
      WHERE post_id = ? AND type = 'Comment'
    `, [postId]);
    
    res.json({ comment_count: result[0].comment_count });
  } catch (error) {
    console.error('Failed to fetch comment count:', error);
    res.status(500).json({ error: 'Failed to fetch comment count' });
  }
});
// REMOVE THIS: Delete the share route completely
// router.post('/share', auth, async (req, res) => {
//   try {
//     const { post_id } = req.body;
//     await pool.query('INSERT INTO Reaction(post_id, user_id, type) VALUES(?, ?, "Share")', [post_id, req.user.user_id]);
//     await pool.query('UPDATE Post SET share_count = share_count + 1 WHERE post_id = ?', [post_id]);
//     res.json({ msg: 'Shared' });
//   } catch (error) {
//     console.error('Share error:', error);
//     res.status(500).json({ error: 'Failed to share post' });
//   }
// });

module.exports = router;