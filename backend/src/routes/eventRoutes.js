const express = require("express");

const {
  createEvent,
  getEvents,
  getEventById,
  getMyEvents,
  updateEvent,
  deleteEvent,
  getEventAttendees,
} = require("../controllers/eventController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.get("/", getEvents);
router.get("/:id", getEventById);

// Organizer routes
router.get(
  "/organizer/my-events",
  protect,
  authorize("ORGANIZER"),
  getMyEvents
);

router.get(
  "/organizer/attendees/:eventId",
  protect,
  authorize("ORGANIZER"),
  getEventAttendees
);

router.post(
  "/",
  protect,
  authorize("ORGANIZER"),
  createEvent
);

router.put(
  "/:id",
  protect,
  authorize("ORGANIZER"),
  updateEvent
);

router.delete(
  "/:id",
  protect,
  authorize("ORGANIZER"),
  deleteEvent
);

module.exports = router;