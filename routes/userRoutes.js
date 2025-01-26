const express = require("express");
const {
  registerUser,
  authUser,
  allUsers,
} = require("../controllers/userControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Protect the route to only allow logged-in users to access all users
router.route("/").get(protect, allUsers); // Get all users with optional search query
router.route("/").post(registerUser); // Register new user
router.post("/login", authUser); // Login user

module.exports = router;
