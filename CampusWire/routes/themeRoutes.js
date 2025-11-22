// // routes/themeRoutes.js
// const express = require('express');
// const router = express.Router();
// const pool = require('../db');

// // GET current festival theme automatically
// router.get('/current', async (req, res) => {
//   try {
//     const today = new Date().toISOString().slice(0, 10);
//     const [themes] = await pool.query(
//       `SELECT * FROM FestivalTheme
//        WHERE start_date <= ? AND end_date >= ?
//        ORDER BY start_date DESC
//        LIMIT 1`,
//       [today, today]
//     );

//     if (themes.length === 0) {
//       return res.json({
//         active: false,
//         theme: {
//           festival_name: 'Default',
//           primary_color: '#1e293b',
//           secondary_color: '#60a5fa',
//           background_image: '',
//           banner_image: ''
//         }
//       });
//     }

//     res.json({ active: true, theme: themes[0] });
//   } catch (err) {
//     console.error('Error fetching theme:', err);
//     res.status(500).json({ error: 'Server error while fetching theme' });
//   }
// });

// module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/current', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [themes] = await pool.query(
      `SELECT * FROM FestivalTheme
       WHERE start_date <= ? AND end_date >= ?
       ORDER BY start_date DESC
       LIMIT 1`,
      [today, today]
    );

    if (themes.length === 0) {
      return res.json({
        active: false,
        theme: {
          festival_name: 'Default',
          primary_color: '#1e293b',
          secondary_color: '#60a5fa',
          background_image: '',
          banner_image: ''
        }
      });
    }

    res.json({ active: true, theme: themes[0] });
  } catch (err) {
    console.error('Error fetching theme:', err);
    res.status(500).json({ error: 'Server error while fetching theme' });
  }
});

module.exports = router;