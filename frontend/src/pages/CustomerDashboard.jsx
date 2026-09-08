import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function CustomerDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("explore"); // "explore" or "my-bookings"
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  // Booking Modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [requestedTickets, setRequestedTickets] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/events");
      // Handle response.data.events array returned by backend
      setEvents(response.data.events || response.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/bookings/my-bookings");
      setBookings(response.data.bookings || response.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load your bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "explore") {
      fetchEvents();
    } else {
      fetchMyBookings();
    }
  }, [activeTab]);

  const handleBookTicket = async (e) => {
    e.preventDefault();
    if (!selectedEvent) return;

    try {
      setBookingLoading(true);
      setActionMessage("");

      const response = await api.post(`/events/${selectedEvent._id}/book`, {
        requestedTickets: Number(requestedTickets),
      });

      setActionMessage("🎉 Booking confirmed successfully!");
      setSelectedEvent(null);
      setRequestedTickets(1);
      fetchEvents();
    } catch (err) {
      console.error(err);
      setActionMessage(err.response?.data?.message || "Failed to book tickets");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;

    try {
      setActionMessage("");
      await api.patch(`/bookings/${bookingId}/cancel`);
      setActionMessage("Booking cancelled successfully.");
      fetchMyBookings();
    } catch (err) {
      console.error(err);
      setActionMessage(err.response?.data?.message || "Failed to cancel booking");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold text-indigo-600">EventHub</h1>
            <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => {
                  setActiveTab("explore");
                  setActionMessage("");
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === "explore"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Explore Events
              </button>
              <button
                onClick={() => {
                  setActiveTab("my-bookings");
                  setActionMessage("");
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === "my-bookings"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                My Bookings
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Welcome, <strong>{user?.name}</strong></span>
            <button
              onClick={logout}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className={`p-4 rounded-xl text-sm font-medium text-center ${
            actionMessage.includes("confirmed") || actionMessage.includes("cancelled")
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}>
            {actionMessage}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === "explore" ? (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Upcoming Events</h2>
              <p className="text-gray-500 mt-1">Discover and book tickets for upcoming events.</p>
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
                <p className="text-gray-500 font-medium">No upcoming events available right now.</p>
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
                      <div className="h-40 bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center">
                        <span className="text-6xl">🎫</span>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{event.title}</h3>
                          <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                            {event.category}
                          </span>
                        </div>

                        <p className="text-gray-500 text-sm mt-2 line-clamp-2">{event.description}</p>

                        <div className="mt-4 space-y-2 text-sm text-gray-600">
                          <p>📅 {new Date(event.date).toLocaleDateString()}</p>
                          <p>📍 {event.location}</p>
                          <p className="font-semibold text-gray-900">💰 ₹{event.ticketPrice}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0 mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
                      <span
                        className={`text-sm font-semibold ${
                          event.availableTickets > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {event.availableTickets > 0 ? `${event.availableTickets} left` : "Sold Out"}
                      </span>

                      <button
                        disabled={event.availableTickets === 0}
                        onClick={() => setSelectedEvent(event)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">My Bookings</h2>
              <p className="text-gray-500 mt-1">Manage your event registrations and tickets.</p>
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

            {!loading && !error && bookings.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                <p className="text-gray-500 font-medium">You haven't booked any events yet.</p>
              </div>
            )}

            {!loading && !error && bookings.length > 0 && (
              <div className="space-y-4">
                {bookings.map((b) => (
                  <div
                    key={b._id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-gray-900">{b.event?.title || "Event Details"}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          b.bookingStatus === "CONFIRMED"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {b.bookingStatus}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        📅 Date: {b.event?.date ? new Date(b.event.date).toLocaleDateString() : "N/A"} | 📍 {b.event?.location || "N/A"}
                      </p>
                      <p className="text-sm font-medium text-gray-700 mt-2">
                        Tickets: <strong>{b.ticketsBooked}</strong> | Total Paid: <strong>₹{b.totalAmount}</strong>
                      </p>
                    </div>

                    {b.bookingStatus === "CONFIRMED" && (
                      <button
                        onClick={() => handleCancelBooking(b._id)}
                        className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50 transition"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Booking Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <h3 className="text-xl font-bold text-gray-900">Book Tickets: {selectedEvent.title}</h3>
            
            <div className="text-sm text-gray-600 space-y-1 bg-gray-50 p-4 rounded-xl">
              <p>📍 Location: {selectedEvent.location}</p>
              <p>💰 Price per ticket: ₹{selectedEvent.ticketPrice}</p>
              <p>🎟️ Tickets available: {selectedEvent.availableTickets}</p>
            </div>

            <form onSubmit={handleBookTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Number of Tickets
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedEvent.availableTickets}
                  value={requestedTickets}
                  onChange={(e) => setRequestedTickets(e.target.value)}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="text-right text-sm font-bold text-gray-900">
                Total Price: ₹{requestedTickets * selectedEvent.ticketPrice}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-semibold transition"
                >
                  {bookingLoading ? "Confirming..." : "Confirm Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerDashboard;