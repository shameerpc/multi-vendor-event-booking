import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

const CATEGORIES = ["Music", "Tech", "Workshop", "Sports", "Other"];

const CATEGORY_META = {
  Music: { icon: "🎵", gradient: "from-rose-500 to-pink-600", soft: "bg-rose-50 text-rose-700 border-rose-200" },
  Tech: { icon: "💻", gradient: "from-indigo-500 to-blue-600", soft: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  Workshop: { icon: "🛠️", gradient: "from-amber-500 to-orange-600", soft: "bg-amber-50 text-amber-700 border-amber-200" },
  Sports: { icon: "🏆", gradient: "from-emerald-500 to-green-600", soft: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Other: { icon: "🎭", gradient: "from-purple-500 to-fuchsia-600", soft: "bg-purple-50 text-purple-700 border-purple-200" },
};

function CustomerDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState("explore");
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [toast, setToast] = useState({ show: false, type: "success", message: "" });

  // Explore filters
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Booking modal state
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [requestedTickets, setRequestedTickets] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Cancel confirmation modal state
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Event detail modal state
  const [detailEventId, setDetailEventId] = useState(null);
  const [detailEvent, setDetailEvent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const openDetails = async (event) => {
    setDetailEventId(event._id);
    setDetailEvent(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const response = await api.get(`/events/${event._id}`);
      setDetailEvent(response.data.event || response.data || null);
    } catch (err) {
      console.error(err);
      setDetailError(err.response?.data?.message || "Failed to load event details");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailEventId(null);
    setDetailEvent(null);
    setDetailError("");
  };

  const bookFromDetails = () => {
    if (!detailEvent) return;
    setSelectedEvent(detailEvent);
    setRequestedTickets(1);
    closeDetails();
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type, message: "" }), 3500);
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/events");
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-tab
      fetchEvents();
    } else {
      fetchMyBookings();
    }
  }, [activeTab]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesCategory =
        activeCategory === "All" || event.category === activeCategory;
      const matchesSearch =
        !term ||
        event.title.toLowerCase().includes(term) ||
        event.description.toLowerCase().includes(term) ||
        event.location.toLowerCase().includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [events, search, activeCategory]);

  const confirmBooking = async () => {
    if (!selectedEvent) return;
    const qty = Number(requestedTickets);
    if (!qty || qty < 1 || qty > selectedEvent.availableTickets) {
      showToast("Please enter a valid number of tickets", "error");
      return;
    }

    setBookingLoading(true);
    try {
      await api.post(`/events/${selectedEvent._id}/book`, {
        requestedTickets: qty,
      });
      showToast("Booking confirmed successfully!", "success");
      setSelectedEvent(null);
      setRequestedTickets(1);
      fetchEvents();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to book tickets", "error");
    } finally {
      setBookingLoading(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancellingBooking) return;
    setCancelLoading(true);
    try {
      await api.patch(`/bookings/${cancellingBooking._id}/cancel`);
      showToast("Booking cancelled successfully!", "success");
      setCancellingBooking(null);
      fetchMyBookings();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to cancel booking", "error");
      setCancellingBooking(null);
    } finally {
      setCancelLoading(false);
    }
  };

  const stats = useMemo(() => {
    const confirmed = bookings.filter((b) => b.bookingStatus === "CONFIRMED");
    const tickets = confirmed.reduce((sum, b) => sum + (b.ticketsBooked || 0), 0);
    const spent = confirmed.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    );
    const upcoming = confirmed.filter(
      (b) => b.event?.date && new Date(b.event.date) >= new Date()
    ).length;
    return { totalBookings: confirmed.length, tickets, spent, upcoming };
  }, [bookings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40">
      {/* Toast */}
      {toast.show && (
        <div className="fixed top-5 inset-x-0 z-[70] flex justify-center px-4 pointer-events-none">
          <div
            className={`pointer-events-auto px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white flex items-center gap-2 animate-slide-down ${
              toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            <span>{toast.type === "success" ? "✓" : "✕"}</span>
            {toast.message}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-indigo-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 leading-tight">EventHub</h1>
              <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-widest">
                Customer Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 order-3 w-full sm:w-auto sm:order-none">
            {/* Tab switcher */}
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm w-full sm:w-auto">
              <button
                onClick={() => {
                  setActiveTab("explore");
                  setError("");
                }}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === "explore"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Explore Events
              </button>
              <button
                onClick={() => {
                  setActiveTab("my-bookings");
                  setError("");
                }}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                  activeTab === "my-bookings"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                My Bookings
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 ml-auto">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.[0]?.toUpperCase() || "C"}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-400 leading-tight">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-gray-700 text-sm font-medium hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "explore" ? (
          <>
            {/* Header + search */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-extrabold text-gray-900">
                  Discover Events <span className="inline-block animate-bounce-slow">✨</span>
                </h2>
                <p className="text-gray-500 mt-1">Find your next memorable experience and book instantly.</p>
              </div>
              <div className="relative lg:w-80">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search events, venues..."
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm shadow-sm"
                />
              </div>
            </div>

            {/* Category filter chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {["All", ...CATEGORIES].map((cat) => {
                const active = activeCategory === cat;
                const m = cat !== "All" ? CATEGORY_META[cat] : null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 border-transparent text-white shadow-md scale-[1.02]"
                        : "bg-white border-slate-200 text-gray-600 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    {m && <span>{m.icon}</span>}
                    {cat}
                  </button>
                );
              })}
            </div>

            {loading && (
              <div className="flex justify-center py-24">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            )}

            {!loading && error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-5 text-center font-medium">
                {error}
              </div>
            )}

            {!loading && !error && filteredEvents.length === 0 && (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-indigo-200 shadow-sm">
                <div className="text-6xl mb-4">{search || activeCategory !== "All" ? "🔍" : "🎪"}</div>
                <h3 className="text-xl font-bold text-gray-900">
                  {search || activeCategory !== "All" ? "No matching events" : "No events yet"}
                </h3>
                <p className="text-gray-500 mt-2 max-w-sm mx-auto text-sm">
                  {search || activeCategory !== "All"
                    ? "Try a different search term or category."
                    : "Check back soon — new events are being added."}
                </p>
              </div>
            )}

            {!loading && !error && filteredEvents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => {
                  const meta = CATEGORY_META[event.category] || CATEGORY_META.Other;
                  const soldOut = event.availableTickets === 0;
                  const progress = event.totalTickets
                    ? Math.round(((event.totalTickets - event.availableTickets) / event.totalTickets) * 100)
                    : 0;

                  return (
                    <div
                      key={event._id}
                      className="bg-white rounded-3xl border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group"
                    >
                      {/* Banner */}
                      <div className={`relative h-40 bg-gradient-to-r ${meta.gradient} flex items-center justify-center overflow-hidden`}>
                        <span className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
                        <span className="absolute -left-4 -bottom-8 w-24 h-24 bg-white/10 rounded-full" />
                        <span className="text-7xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                          {meta.icon}
                        </span>
                        <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold ${meta.soft} backdrop-blur-sm bg-white/80`}>
                          {event.category}
                        </span>
                        {soldOut && (
                          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-900/70 text-white">
                            Sold Out
                          </span>
                        )}
                      </div>

                      {/* Body */}
                      <div className="p-5 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-700 transition">
                            {event.title}
                          </h3>
                        </div>
                        <p className="text-gray-500 text-sm mt-1.5 line-clamp-2 flex-1">{event.description}</p>

                        <div className="mt-4 space-y-2 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <span className="text-base">📅</span>
                            <span>
                              {new Date(event.date).toLocaleDateString(undefined, {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              <span className="text-gray-400"> · </span>
                              {new Date(event.date).toLocaleTimeString(undefined, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base">📍</span>
                            <span className="line-clamp-1">{event.location}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-indigo-600">
                              ₹{event.ticketPrice.toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs text-gray-400">per ticket</span>
                          </div>
                        </div>

                        {/* Availability bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-400 font-medium">
                              {soldOut ? "Fully booked" : `${event.availableTickets} tickets left`}
                            </span>
                            <span className={`font-bold ${soldOut ? "text-rose-600" : "text-emerald-600"}`}>
                              {progress}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                soldOut ? "bg-rose-500" : "bg-gradient-to-r from-emerald-500 to-green-500"
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="px-5 pb-5 flex gap-2">
                        <button
                          onClick={() => openDetails(event)}
                          className="flex-1 px-3 py-2.5 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold transition flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Details
                        </button>
                        <button
                          disabled={soldOut}
                          onClick={() => {
                            setSelectedEvent(event);
                            setRequestedTickets(1);
                          }}
                          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                            soldOut
                              ? "bg-slate-100 text-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-200"
                          }`}
                        >
                          {soldOut ? (
                            "Sold Out"
                          ) : (
                            <>
                              Book Now
                              <span className="text-base leading-none">→</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-3xl font-extrabold text-gray-900">My Bookings 🎟️</h2>
              <p className="text-gray-500 mt-1">Manage your event registrations and tickets.</p>
            </div>

            {/* Booking stats */}
            {!loading && !error && bookings.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Active Bookings</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.totalBookings}</p>
                </div>
                <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Tickets Booked</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.tickets}</p>
                </div>
                <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Total Spent</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-1">
                    ₹{stats.spent.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
                  <p className="text-sm font-medium text-gray-500">Upcoming</p>
                  <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.upcoming}</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-center py-24">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            )}

            {!loading && error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-5 text-center font-medium">
                {error}
              </div>
            )}

            {!loading && !error && bookings.length === 0 && (
              <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-indigo-200 shadow-sm">
                <div className="text-6xl mb-4">🎟️</div>
                <h3 className="text-xl font-bold text-gray-900">No bookings yet</h3>
                <p className="text-gray-500 mt-2 max-w-sm mx-auto text-sm">
                  Explore events and grab your tickets now!
                </p>
                <button
                  onClick={() => setActiveTab("explore")}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-purple-700 transition shadow-lg shadow-indigo-200"
                >
                  Explore Events
                </button>
              </div>
            )}

            {!loading && !error && bookings.length > 0 && (
              <div className="space-y-4">
                {bookings.map((b) => {
                  const cancelled = b.bookingStatus === "CANCELLED";
                  const eMeta = b.event?.category ? CATEGORY_META[b.event.category] : null;
                  return (
                    <div
                      key={b._id}
                      className={`bg-white rounded-2xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition ${
                        cancelled ? "border-slate-200 opacity-70" : "border-slate-100"
                      }`}
                    >
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div
                          className={`w-14 h-14 shrink-0 rounded-2xl ${
                            eMeta
                              ? `bg-gradient-to-br ${eMeta.gradient}`
                              : "bg-gradient-to-br from-indigo-500 to-purple-500"
                          } flex items-center justify-center text-3xl shadow`}
                        >
                          {eMeta?.icon || "🎫"}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
                              {b.event?.title || "Event Details"}
                            </h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                cancelled
                                  ? "bg-slate-100 text-slate-600"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {b.bookingStatus === "CONFIRMED" ? "CONFIRMED" : "CANCELLED"}
                            </span>
                          </div>

                          <div className="text-sm text-gray-500 mt-1.5 space-y-0.5">
                            <p>
                              📅 {b.event?.date ? new Date(b.event.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "N/A"}{" "}
                              · 📍 {b.event?.location || "N/A"}
                            </p>
                          </div>

                          <div className="text-sm mt-2 flex items-center gap-4 flex-wrap">
                            <span className="text-gray-600">
                              🎟️ <strong>{b.ticketsBooked}</strong> ticket{b.ticketsBooked > 1 ? "s" : ""}
                            </span>
                            <span className="text-gray-600">
                              💰 Paid: <strong>₹{b.totalAmount.toLocaleString("en-IN")}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {!cancelled && (
                        <button
                          onClick={() => setCancellingBooking(b)}
                          className="shrink-0 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold transition flex items-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Cancel Booking
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* ═══ BOOKING MODAL ═══ */}
      {selectedEvent && (
        <BookingModal
          event={selectedEvent}
          requestedTickets={requestedTickets}
          setRequestedTickets={setRequestedTickets}
          loading={bookingLoading}
          onConfirm={confirmBooking}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* ═══ CANCEL CONFIRMATION MODAL ═══ */}
      {cancellingBooking && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4 z-50 py-8">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Cancel Booking?</h3>
              <p className="text-gray-500 text-sm mt-2">
                Your{" "}
                <span className="font-semibold text-gray-700">
                  {cancellingBooking.ticketsBooked} ticket{cancellingBooking.ticketsBooked > 1 ? "s" : ""}
                </span>{" "}
                for{" "}
                <span className="font-semibold text-gray-700">
                  "{cancellingBooking.event?.title}"
                </span>{" "}
                will be cancelled. Tickets will be released back.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setCancellingBooking(null)}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-gray-600 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={confirmCancel}
                disabled={cancelLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold transition shadow-md shadow-rose-200 flex items-center justify-center gap-2"
              >
                {cancelLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EVENT DETAIL MODAL ═══ */}
      {detailEventId && (
        <EventDetailModal
          event={detailEvent}
          loading={detailLoading}
          error={detailError}
          onBook={bookFromDetails}
          onClose={closeDetails}
        />
      )}
    </div>
  );
}

/* ═══ Event Detail Modal ═══ */
function EventDetailModal({ event, loading, error, onBook, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4 z-50 py-6 sm:py-10">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[92vh] animate-scale-in">
        {loading ? (
          <>
            <div className="shrink-0 rounded-t-3xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Event Details</h3>
                  <p className="text-indigo-100 text-xs mt-0.5">Loading the latest information...</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-scroll overflow-y-auto p-6">
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            </div>
          </>
        ) : error ? (
          <>
            <div className="shrink-0 rounded-t-3xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <h3 className="text-lg font-bold text-white">Event Details</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-scroll overflow-y-auto p-6">
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-5 text-center font-medium">
                {error}
              </div>
            </div>
          </>
        ) : (
          <EventDetailContent event={event} onBook={onBook} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/* Content shown once the fresh event data has loaded */
function EventDetailContent({ event, onBook, onClose }) {
  const meta = CATEGORY_META[event.category] || CATEGORY_META.Other;
  const soldOut = event.availableTickets === 0;
  const progress = event.totalTickets
    ? Math.round(((event.totalTickets - event.availableTickets) / event.totalTickets) * 100)
    : 0;

  return (
    <>
      {/* Header banner */}
      <div className={`shrink-0 relative rounded-t-3xl bg-gradient-to-r ${meta.gradient} px-6 py-5 overflow-hidden`}>
        <span className="absolute -right-6 -top-8 w-24 h-24 bg-white/10 rounded-full" />
        <span className="absolute -left-4 -bottom-6 w-20 h-20 bg-white/10 rounded-full" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider mb-1">
              {meta.icon} {event.category}
            </p>
            <h3 className="text-xl font-extrabold text-white leading-tight">{event.title}</h3>
            <p className="text-xs text-white/80 mt-1">by {event.organizer?.name || "Organizer"}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="modal-scroll overflow-y-auto p-6 space-y-5">
        <div>
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-1.5">About this event</h4>
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{event.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase">Date & Time</p>
            <p className="font-semibold text-gray-800 mt-0.5">
              {new Date(event.date).toLocaleDateString(undefined, {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="text-gray-500">
              {new Date(event.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase">Location</p>
            <p className="font-semibold text-gray-800 mt-0.5 line-clamp-2">{event.location}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase">Ticket Price</p>
            <p className="font-bold text-indigo-600 mt-0.5">
              ₹{event.ticketPrice.toLocaleString("en-IN")}
              <span className="text-xs font-medium text-gray-400"> / ticket</span>
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase">Availability</p>
            <p className={`font-bold mt-0.5 ${soldOut ? "text-rose-600" : "text-emerald-600"}`}>
              {soldOut ? "Sold out" : `${event.availableTickets} of ${event.totalTickets} left`}
            </p>
          </div>
        </div>

        {/* Availability bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400 font-medium">{soldOut ? "Fully booked" : "Tickets booked"}</span>
            <span className={`font-bold ${soldOut ? "text-rose-600" : "text-emerald-600"}`}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                soldOut ? "bg-rose-500" : "bg-gradient-to-r from-emerald-500 to-green-500"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-gray-600 text-sm font-semibold hover:bg-slate-50 transition"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onBook}
          disabled={soldOut}
          className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
            soldOut
              ? "bg-slate-100 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-200"
          }`}
        >
          {soldOut ? (
            "Sold Out"
          ) : (
            <>
              Book Now
              <span className="text-base leading-none">→</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

/* ═══ Booking Modal ═══ */
function BookingModal({ event, requestedTickets, setRequestedTickets, loading, onConfirm, onClose }) {
  const meta = CATEGORY_META[event.category] || CATEGORY_META.Other;
  const qty = Math.min(Math.max(Number(requestedTickets) || 1, 1), event.availableTickets);
  const total = qty * event.ticketPrice;
  const soldOut = event.availableTickets === 0;

  const changeQty = (delta) => {
    const next = (Number(requestedTickets) || 1) + delta;
    setRequestedTickets(Math.min(Math.max(next, 1), event.availableTickets));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4 z-50 py-8">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
        {/* Header banner */}
        <div className={`shrink-0 relative rounded-t-3xl bg-gradient-to-r ${meta.gradient} px-6 py-5 overflow-hidden`}>
          <span className="absolute -right-6 -top-8 w-24 h-24 bg-white/10 rounded-full" />
          <span className="absolute -left-4 -bottom-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-white/80 uppercase tracking-wider mb-1">
                Confirm Your Booking
              </p>
              <h3 className="text-xl font-extrabold text-white line-clamp-2">{event.title}</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 shrink-0 rounded-full bg-white/20 text-white hover:bg-white/30 flex items-center justify-center transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto modal-scroll p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase">Date & Time</p>
              <p className="font-semibold text-gray-800 mt-0.5">
                {new Date(event.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <p className="text-gray-500">
                {new Date(event.date).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase">Location</p>
              <p className="font-semibold text-gray-800 mt-0.5 line-clamp-1">{event.location}</p>
              <p className={`text-xs font-bold mt-1 ${soldOut ? "text-rose-600" : "text-emerald-600"}`}>
                {soldOut ? "Sold out" : `${event.availableTickets} left`}
              </p>
            </div>
          </div>

          {/* Quantity stepper */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Tickets</label>
            <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => changeQty(-1)}
                disabled={qty <= 1}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-40 disabled:pointer-events-none transition font-bold text-lg"
              >
                −
              </button>
              <div className="flex flex-col items-center">
                <span className="text-xl font-extrabold text-gray-900 leading-none">{qty}</span>
                <span className="text-[11px] text-gray-400">₹{event.ticketPrice.toLocaleString("en-IN")} each</span>
              </div>
              <button
                type="button"
                onClick={() => changeQty(1)}
                disabled={qty >= event.availableTickets}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 disabled:opacity-40 disabled:pointer-events-none transition font-bold text-lg"
              >
                +
              </button>
            </div>
            <input
              type="range"
              min="1"
              max={event.availableTickets}
              value={qty}
              onChange={(e) => setRequestedTickets(Number(e.target.value))}
              className="w-full mt-3 accent-indigo-600"
            />
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-4 text-white flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-100 font-semibold uppercase tracking-wide">Total Price</p>
              <p className="text-2xl font-extrabold">₹{total.toLocaleString("en-IN")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-indigo-100">Tickets</p>
              <p className="text-lg font-bold">{qty}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-gray-600 text-sm font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || soldOut}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white text-sm font-bold transition shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Confirming...
              </>
            ) : (
              "Confirm Booking"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CustomerDashboard;