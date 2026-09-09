const mongoose = require("mongoose");
const Event = require("../models/Event");
const Booking = require("../models/Booking");

const VALID_CATEGORIES = ["Music", "Tech", "Workshop", "Sports", "Other"];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Create Event - Organizer only
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      date,
      location,
      ticketPrice,
      totalTickets,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !category ||
      !date ||
      !location ||
      ticketPrice === undefined ||
      totalTickets === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All event fields are required",
      });
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    // Validate date
    const eventDate = new Date(date);

    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid event date format",
      });
    }

    if (eventDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Event date must be in the future",
      });
    }

    // Validate ticket price
    if (isNaN(Number(ticketPrice)) || Number(ticketPrice) < 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket price must be a non-negative number",
      });
    }

    // Validate ticket capacity
    if (!Number.isInteger(Number(totalTickets)) || Number(totalTickets) < 1) {
      return res.status(400).json({
        success: false,
        message: "Total tickets must be an integer of at least 1",
      });
    }

    const event = await Event.create({
      title: title.trim(),
      description: description.trim(),
      category,
      date: eventDate,
      location: location.trim(),
      ticketPrice: Number(ticketPrice),
      totalTickets: Number(totalTickets),
      availableTickets: Number(totalTickets),
      organizer: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    console.error("Create event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error creating event",
    });
  }
};

// Get upcoming events (with filter & search)
const getEvents = async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = {
      date: { $gte: new Date() },
    };

    if (category) {
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category filter. Allowed: ${VALID_CATEGORIES.join(", ")}`,
        });
      }
      filter.category = category;
    }

    if (search) {
      const escapedSearch = escapeRegExp(String(search));

      filter.$or = [
        {
          title: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
        {
          description: {
            $regex: escapedSearch,
            $options: "i",
          },
        },
      ];
    }

    const events = await Event.find(filter)
      .populate("organizer", "name email")
      .sort({ date: 1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Get events error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching events",
    });
  }
};

// Get single event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(id).populate("organizer", "name email");

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    console.error("Get event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching event details",
    });
  }
};

// Get organizer's own created events
const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Get my events error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching organizer events",
    });
  }
};

// Update event - Organizer only (own events)
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this event",
      });
    }

    const {
      title,
      description,
      category,
      date,
      location,
      ticketPrice,
      totalTickets,
    } = req.body;

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    if (date) {
      const eventDate = new Date(date);
      if (isNaN(eventDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid event date format",
        });
      }
      if (eventDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "Event date must be in the future",
        });
      }
      event.date = eventDate;
    }

    if (title) event.title = title.trim();
    if (description) event.description = description.trim();
    if (category) event.category = category;
    if (location) event.location = location.trim();
    if (ticketPrice !== undefined) {
      if (isNaN(Number(ticketPrice)) || Number(ticketPrice) < 0) {
        return res.status(400).json({
          success: false,
          message: "Ticket price must be a non-negative number",
        });
      }
      event.ticketPrice = Number(ticketPrice);
    }

    if (totalTickets !== undefined) {
      const newTotal = Number(totalTickets);
      if (!Number.isInteger(newTotal) || newTotal < 1) {
        return res.status(400).json({
          success: false,
          message: "Total tickets must be an integer of at least 1",
        });
      }

      const ticketsBookedSoFar = event.totalTickets - event.availableTickets;
      if (newTotal < ticketsBookedSoFar) {
        return res.status(400).json({
          success: false,
          message: `Cannot reduce total tickets below already booked quantity (${ticketsBookedSoFar})`,
        });
      }

      event.availableTickets = newTotal - ticketsBookedSoFar;
      event.totalTickets = newTotal;
    }

    await event.save();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    console.error("Update event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error updating event",
    });
  }
};

// Delete event - Organizer only (own events)
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this event",
      });
    }

    // Check if there are active bookings
    const activeBookings = await Booking.countDocuments({
      event: id,
      bookingStatus: "CONFIRMED",
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete event with active confirmed bookings",
      });
    }

    await Event.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
    });
  } catch (error) {
    console.error("Delete event error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error deleting event",
    });
  }
};

// Get attendees (confirmed bookings) for the organizer's own event
const getEventAttendees = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID format",
      });
    }

    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (event.organizer.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view attendees for this event",
      });
    }

    const bookings = await Booking.find({
      event: eventId,
      bookingStatus: "CONFIRMED",
    })
      .populate("customer", "name email")
      .sort({ createdAt: 1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      attendees: bookings.map((booking) => ({
        id: booking._id,
        customer: booking.customer,
        ticketsBooked: booking.ticketsBooked,
        totalAmount: booking.totalAmount,
        bookingStatus: booking.bookingStatus,
        bookedAt: booking.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get event attendees error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error fetching event attendees",
    });
  }
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  getMyEvents,
  updateEvent,
  deleteEvent,
  getEventAttendees,
};