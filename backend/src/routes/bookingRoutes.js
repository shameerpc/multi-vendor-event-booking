const express = require("express");

const {
  bookEvent,
  getUserBookings,
  cancelBooking,
} = require("../controllers/bookingController");

const {
  protect,
  authorize,
} = require("../middleware/authMiddleware");

const router = express.Router();

// Customer bookings list
router.get(
  "/bookings/my-bookings",
  protect,
  authorize("CUSTOMER"),
  getUserBookings
);

// Customer booking ticket
router.post(
  "/events/:id/book",
  protect,
  authorize("CUSTOMER"),
  bookEvent
);

// Customer cancel booking
router.patch(
  "/bookings/:id/cancel",
  protect,
  authorize("CUSTOMER"),
  cancelBooking
);

module.exports = router;