import { useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function CustomerDashboard() {
  const { user, logout } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/events");

      setEvents(response.data);
    } catch (error) {
      console.error(error);

      setError(
        error.response?.data?.message || "Failed to load events"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-indigo-600">
              EventHub
            </h1>
            <p className="text-sm text-gray-500">
              Welcome, {user?.name}
            </p>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">
            Upcoming Events
          </h2>

          <p className="text-gray-500 mt-2">
            Discover and book your next event.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500">
              No upcoming events available.
            </p>
          </div>
        )}

        {/* Events */}
        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event._id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition"
              >
                <div className="h-40 bg-indigo-100 flex items-center justify-center">
                  <span className="text-5xl">🎫</span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      {event.title}
                    </h3>

                    <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {event.category}
                    </span>
                  </div>

                  <p className="text-gray-500 text-sm mt-2 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="mt-4 space-y-2 text-sm text-gray-600">
                    <p>📅 {new Date(event.date).toLocaleDateString()}</p>
                    <p>📍 {event.location}</p>
                    <p>💰 ₹{event.ticketPrice}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${
                        event.availableTickets > 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {event.availableTickets > 0
                        ? `${event.availableTickets} tickets left`
                        : "Sold Out"}
                    </span>

                    <button
                      disabled={event.availableTickets === 0}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default CustomerDashboard;