const express = require("express");

const {
  createEvent,
  getEvents,
  getEventById,
} = require("../controllers/eventController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/", getEvents);

router.get("/:id", getEventById);

// Organizer route
router.post(
  "/",
  protect,
  authorize("ORGANIZER"),
  createEvent
);

module.exports = router;