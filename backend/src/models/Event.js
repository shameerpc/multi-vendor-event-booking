const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      enum: ["Music", "Tech", "Workshop", "Sports", "Other"],
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    ticketPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalTickets: {
      type: Number,
      required: true,
      min: 1,
    },

    availableTickets: {
      type: Number,
      required: true,
      min: 0,
    },

    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Cross-field sanity check: never persist more available tickets than total
eventSchema.path("totalTickets").validate(function (value) {
  return this.availableTickets <= value;
}, "availableTickets cannot exceed totalTickets");

// Indexes for the queries used: upcoming list, category filters, my-events
eventSchema.index({ date: 1 });
eventSchema.index({ category: 1, date: 1 });
eventSchema.index({ organizer: 1, createdAt: -1 });

module.exports = mongoose.model("Event", eventSchema);