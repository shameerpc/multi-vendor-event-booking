const mongoose = require("mongoose");
const Event = require("../models/Event");
const Booking = require("../models/Booking");

// MongoDB transactions require a replica set (all Atlas clusters are replica sets).
// Standalone mongod instances do not support them, so we fall back to the
// atomic findOneAndUpdate guard which still guarantees no overbooking.
const isTransactionUnsupported = (error) =>
  error &&
  (error.code === 20 ||
    error.code === 38 ||
    /transaction numbers are only allowed/i.test(error.message || ""));

// Book tickets (Customer only)
const bookEvent = async (req, res) => {
  let session;

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

    // Non-transactional fallback used when the deployment does not support
    // MongoDB transactions. The atomic findOneAndUpdate guard below is still
    // safe under concurrency: it only decrements when availableTickets is
    // at least the requested amount, so it can never go negative or exceed
    // totalTickets. If the booking record fails to persist, the decrement is
    // compensated (rolled back) so no tickets are lost.
    const bookAtomic = async () => {
      const event = await Event.findById(eventId);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      if (event.date <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "This event has already started or ended",
        });
      }

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
          returnDocument: "after",
        }
      );

      if (!updatedEvent) {
        return res.status(400).json({
          success: false,
          message: "Not enough tickets available for this event",
        });
      }

      const totalAmount = ticketCount * updatedEvent.ticketPrice;

      try {
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
      } catch (bookingError) {
        // Compensate the earlier decrement so tickets are not lost.
        await Event.findByIdAndUpdate(eventId, {
          $inc: { availableTickets: ticketCount },
        }).catch(() => {});
        throw bookingError;
      }
    };

    try {
      session = await mongoose.startSession();

      const result = await session.withTransaction(async () => {
        const event = await Event.findById(eventId).session(session);

        if (!event) {
          const error = new Error("Event not found");
          error.status = 404;
          error.isClient = true;
          throw error;
        }

        if (event.date <= new Date()) {
          const error = new Error("This event has already started or ended");
          error.status = 400;
          error.isClient = true;
          throw error;
        }

        // Atomic ticket guard inside the transaction: mongodb only decrements
        // when availableTickets >= ticketCount, so concurrent bookings can
        // never drive availableTickets below 0 or above totalTickets.
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
            returnDocument: "after",
            session,
          }
        );

        if (!updatedEvent) {
          const error = new Error("Not enough tickets available for this event");
          error.status = 400;
          error.isClient = true;
          throw error;
        }

        const totalAmount = ticketCount * updatedEvent.ticketPrice;

        const [booking] = await Booking.create(
          [
            {
              customer: req.user.id,
              event: updatedEvent._id,
              ticketsBooked: ticketCount,
              totalAmount,
              bookingStatus: "CONFIRMED",
            },
          ],
          { session }
        );

        return { booking, remainingTickets: updatedEvent.availableTickets };
      });

      await session.endSession();
      session = null;

      return res.status(201).json({
        success: true,
        message: "Booking confirmed successfully",
        booking: result.booking,
        remainingTickets: result.remainingTickets,
      });
    } catch (txError) {
      if (session) {
        await session.endSession().catch(() => {});
        session = null;
      }

      if (txError.isClient) {
        return res.status(txError.status).json({
          success: false,
          message: txError.message,
        });
      }

      if (isTransactionUnsupported(txError)) {
        return await bookAtomic();
      }

      throw txError;
    }
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
  let session;

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

    // Cancels the booking and restores tickets atomically. The conditional
    // update (bookingStatus: "CONFIRMED") guarantees only one concurrent
    // cancel wins, so tickets can never be restored twice.
    const cancelAndRestore = async (txSession) => {
      const cancelled = await Booking.findOneAndUpdate(
        {
          _id: bookingId,
          bookingStatus: "CONFIRMED",
        },
        {
          bookingStatus: "CANCELLED",
        },
        {
          returnDocument: "after",
          session: txSession,
        }
      );

      if (!cancelled) {
        const error = new Error("Booking is already cancelled");
        error.status = 400;
        error.isClient = true;
        throw error;
      }

      await Event.findByIdAndUpdate(
        cancelled.event,
        {
          $inc: { availableTickets: cancelled.ticketsBooked },
        },
        { session: txSession }
      );

      return cancelled;
    };

    try {
      session = await mongoose.startSession();

      const cancelled = await session.withTransaction(async () =>
        cancelAndRestore(session)
      );

      await session.endSession();
      session = null;

      return res.status(200).json({
        success: true,
        message: "Booking cancelled successfully",
        booking: cancelled,
      });
    } catch (txError) {
      if (session) {
        await session.endSession().catch(() => {});
        session = null;
      }

      if (txError.isClient) {
        return res.status(txError.status).json({
          success: false,
          message: txError.message,
        });
      }

      if (isTransactionUnsupported(txError)) {
        const cancelled = await cancelAndRestore(null);

        return res.status(200).json({
          success: true,
          message: "Booking cancelled successfully",
          booking: cancelled,
        });
      }

      throw txError;
    }
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