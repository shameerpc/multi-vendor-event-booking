const Event = require("../models/Event");

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

    // Validate date
    const eventDate = new Date(date);

    if (isNaN(eventDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid event date",
      });
    }

    if (eventDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Event date must be in the future",
      });
    }

    // Validate ticket price
    if (Number(ticketPrice) < 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket price cannot be negative",
      });
    }

    // Validate ticket capacity
    if (!Number.isInteger(Number(totalTickets)) || Number(totalTickets) < 1) {
      return res.status(400).json({
        success: false,
        message: "Total tickets must be at least 1",
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

      // Initially all tickets are available
      availableTickets: Number(totalTickets),

      // Organizer comes from JWT
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
      message: "Server error",
    });
  }
};


// Get upcoming events
const getEvents = async (req, res) => {
  try {
    const { category, search } = req.query;

    const filter = {
      date: { $gte: new Date() },
    };

    // Category filter
    if (category) {
      filter.category = category;
    }

    // Search title/description
    if (search) {
      filter.$or = [
        {
          title: {
            $regex: search,
            $options: "i",
          },
        },
        {
          description: {
            $regex: search,
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
      message: "Server error",
    });
  }
};


// Get single event
const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("organizer", "name email");

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
      message: "Server error",
    });
  }
};


module.exports = {
  createEvent,
  getEvents,
  getEventById,
};