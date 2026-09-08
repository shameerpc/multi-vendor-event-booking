import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["Music", "Tech", "Workshop", "Sports", "Other"];

function OrganizerDashboard() {
  const { user, logout } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  // Modal / Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Tech",
    date: "",
    location: "",
    ticketPrice: "",
    totalTickets: "",
  });

  const fetchMyEvents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/events/organizer/my-events");
      setEvents(response.data.events || response.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load organizer events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEvents();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setActionMessage("");

    // Simple frontend validation before sending
    if (new Date(formData.date) <= new Date()) {
      setActionMessage("Event date must be in the future");
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/events", {
        ...formData,
        ticketPrice: Number(formData.ticketPrice),
        totalTickets: Number(formData.totalTickets),
      });

      setActionMessage("🎉 Event created successfully!");
      setShowCreateModal(false);
      setFormData({
        title: "",
        description: "",
        category: "Tech",
        date: "",
        location: "",
        ticketPrice: "",
        totalTickets: "",
      });
      fetchMyEvents();
    } catch (err) {
      console.error(err);
      setActionMessage(err.response?.data?.message || "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;

    try {
      setActionMessage("");
      await api.delete(`/events/${eventId}`);
      setActionMessage("Event deleted successfully.");
      fetchMyEvents();
    } catch (err) {
      console.error(err);
      setActionMessage(err.response?.data?.message || "Failed to delete event");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">EventHub</h1>
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
              Organizer Panel • Welcome, {user?.name}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                setShowCreateModal(true);
                setActionMessage("");
              }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition"
            >
              + Create Event
            </button>

            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Notification Banner */}
      {actionMessage && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div
            className={`p-4 rounded-xl text-sm font-medium text-center ${
              actionMessage.includes("successfully")
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {actionMessage}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your Managed Events</h2>
            <p className="text-gray-500 mt-1">View, track, and manage all your organized events.</p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {error}
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <p className="text-gray-500 font-medium">You haven't created any events yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
            >
              Create Your First Event
            </button>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event._id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition flex flex-col justify-between"
              >
                <div>
                  <div className="h-40 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center">
                    <span className="text-6xl">🎭</span>
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{event.title}</h3>
                      <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
                        {event.category}
                      </span>
                    </div>

                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{event.description}</p>

                    <div className="mt-4 space-y-1.5 text-sm text-gray-600">
                      <p>📅 {new Date(event.date).toLocaleDateString()}</p>
                      <p>📍 {event.location}</p>
                      <p>💰 Price: ₹{event.ticketPrice}</p>
                      <p>🎟️ Tickets: <strong>{event.availableTickets}</strong> / {event.totalTickets} available</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 mt-auto flex items-center justify-end border-t border-gray-100 pt-4">
                  <button
                    onClick={() => handleDeleteEvent(event._id)}
                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition"
                  >
                    Delete Event
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xl font-bold text-gray-900">Create New Event</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  placeholder="Event title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  rows="3"
                  placeholder="Event description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  name="location"
                  placeholder="Venue location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Ticket Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="ticketPrice"
                    placeholder="0.00"
                    value={formData.ticketPrice}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total Tickets</label>
                  <input
                    type="number"
                    min="1"
                    name="totalTickets"
                    placeholder="100"
                    value={formData.totalTickets}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {submitting ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrganizerDashboard;