const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/auth");   // ✅ Make sure this path is correct

// GRAPH DATA STRUCTURE (temporary in-memory DB)
const followersGraph = new Map();   // user → Set of followers
const followingGraph = new Map();   // user → Set of following

function init(userId) {
    if (!followersGraph.has(userId)) followersGraph.set(userId, new Set());
    if (!followingGraph.has(userId)) followingGraph.set(userId, new Set());
}

/* ------------------------------
      FOLLOW A USER
--------------------------------*/
router.post("/follow/:targetId", authenticate, (req, res) => {
    const userId = req.user.user_id;          // ✅ REAL USER FROM TOKEN
    const targetId = req.params.targetId;

    console.log("Follow request:", userId, "->", targetId); // ADD THIS LINE

    if (!userId) return res.status(400).json({ error: "Auth user missing" });
    if (userId == targetId) return res.status(400).json({ error: "You cannot follow yourself" });

    init(userId);
    init(targetId);

    followingGraph.get(userId).add(targetId);
    followersGraph.get(targetId).add(userId);

    res.json({ message: "Followed", userId, targetId });
});

/* ------------------------------
      UNFOLLOW A USER
--------------------------------*/
router.post("/unfollow/:targetId", authenticate, (req, res) => {
    const userId = req.user.user_id;          // ✅ REAL USER
    const targetId = req.params.targetId;

    console.log("Unfollow request:", userId, "->", targetId); // ADD THIS LINE

    init(userId);
    init(targetId);

    followingGraph.get(userId).delete(targetId);
    followersGraph.get(targetId).delete(userId);

    res.json({ message: "Unfollowed", userId, targetId });
});

/* ------------------------------
      GET FOLLOWERS
--------------------------------*/
router.get("/followers/:userId", authenticate, (req, res) => {
    const uid = req.params.userId;
    init(uid);

    res.json({ followers: [...followersGraph.get(uid)] });
});

/* ------------------------------
      GET FOLLOWING
--------------------------------*/
router.get("/following/:userId", authenticate, (req, res) => {
    const uid = req.params.userId;
    init(uid);

    res.json({ following: [...followingGraph.get(uid)] });
});

module.exports = router;
