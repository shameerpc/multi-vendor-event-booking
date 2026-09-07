const mongoose = require("mongoose");
const Event = require("../models/Event");
const Booking = require("../models/Booking");

// Book tickets (Customer only)
const bookEvent = async (req, res) => {
  try {
    const { requestedTickets } = req.body;
    const { id: eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const ticketCount = Number(requestedTickets);

    // Validate requested tickets
    if (
      isNaN(ticketCount) ||
      !Number.isInteger(ticketCount) ||
      ticketCount < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Requested tickets must be an integer of at least 1",
      });
    }

    // Check event exists
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Check event date
    if (event.date <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "This event has already started or ended",
      });
    }

    /*
      Atomic ticket update.
      MongoDB will only update the event if:
      availableTickets >= ticketCount
    */
    const updatedEvent = await Event.findOneAndUpdate(
      {
        _id: eventId,
        availableTickets: { $gte: ticketCount },
      },
      {
        $inc: {
          availableTickets: -ticketCount,
        },
      },
      {
        new: true,
      }
    );

    // No update means not enough tickets
    if (!updatedEvent) {
      return res.status(400).json({
        success: false,
        message: "Not enough tickets available for this event",
      });
    }

    // Calculate total
    const totalAmount = ticketCount * updatedEvent.ticketPrice;

    // Create booking
    const booking = await Booking.create({
      customer: req.user.id,
      event: updatedEvent._id,
      ticketsBooked: ticketCount,
      totalAmount,
      bookingStatus: "CONFIRMED",
    });

    return res.status(201).json({
      success: true,
      message: "Booking confirmed successfully",
      booking,
      remainingTickets: updatedEvent.availableTickets,
    });
  } catch (error) {
    console.error("Book event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error processing booking",
    });
  }
};

// Get logged-in user's bookings
const getUserBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate("event")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get user bookings error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching user bookings",
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { id: bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this booking",
      });
    }

    if (booking.bookingStatus === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Booking is already cancelled",
      });
    }

    booking.bookingStatus = "CANCELLED";
    await booking.save();

    // Restore available tickets back to the event
    await Event.findByIdAndUpdate(booking.event, {
      $inc: { availableTickets: booking.ticketsBooked },
    });

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error cancelling booking",
    });
  }
};

module.exports = {
  bookEvent,
  getUserBookings,
  cancelBooking,
};