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

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Tech",
  date: "",
  location: "",
  ticketPrice: "",
  totalTickets: "",
};

// Convert a datetime-local value ("YYYY-MM-DDTHH:MM", interpreted as local
// time by the browser) into a full ISO string that preserves the exact
// local instant. This avoids timezone shifts mangling the stored date/time.
function localToISO(value) {
  if (!value) return "";
  const date = parseDateTime(value);
  return date && !isNaN(date.getTime()) ? date.toISOString() : "";
}

// Robust date parser that accepts common user-typed formats:
//   - "YYYY-MM-DDTHH:MM" (browser datetime-local)
//   - "DD-MM-YYYY HH:MM"  / "DD-MM-YYYYTHH:MM"  (day-first, e.g. 13-09-2026 10:00)
//   - "DD/MM/YYYY HH:MM"  / "DD/MM/YYYYTHH:MM"
//   - "YYYY-MM-DD HH:MM"  / "YYYY/MM/DD HH:MM"
// Returns a valid Date or null.
function parseDateTime(value) {
  if (!value || typeof value !== "string") return null;

  const trimmed = value.trim();
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) return date;

  const match = trimmed.match(/^(\d{1,4})[-\/.](\d{1,2})[-\/.](\d{1,4})(?:[T\s]+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;

  const [, a, b, c, hh = "0", mm = "0"] = match;
  const hour = Number(hh);
  const minute = Number(mm);
  if (hour > 23 || minute > 59) return null;

  let year, month, day;
  if (a.length === 4) {
    // YYYY-MM-DD
    year = Number(a);
    month = Number(b);
    day = Number(c);
  } else {
    // DD-MM-YYYY (day-first) — the common format for Indian users
    day = Number(a);
    month = Number(b);
    year = c.length === 4 ? Number(c) : Number(c) + 2000;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

// Convert an ISO string back into a datetime-local value in the user's local
// timezone so the picker shows the same wall-clock date/time that was saved.
function isoToLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function nowLocalMin() {
  const pad = (n) => String(n).padStart(2, "0");
  const d = new Date();
  d.setMinutes(d.getMinutes() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function OrganizerDashboard() {
  const { user, logout } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [toast, setToast] = useState({ show: false, type: "success", message: "" });

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Edit modal state
  const [editingEvent, setEditingEvent] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [submitting, setSubmitting] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type, message: "" }), 3500);
  };

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

  // Derived stats
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const totalTickets = events.reduce((sum, e) => sum + (e.totalTickets || 0), 0);
    const available = events.reduce((sum, e) => sum + (e.availableTickets || 0), 0);
    const booked = Math.max(totalTickets - available, 0);
    const soldOut = events.filter((e) => e.availableTickets === 0).length;
    return { totalEvents, booked, available, soldOut };
  }, [events]);

  const openCreateModal = () => {
    setFormData(EMPTY_FORM);
    setShowCreateModal(true);
  };

  const openEditModal = (event) => {
    setEditingEvent(event);
    setEditForm({
      title: event.title,
      description: event.description,
      category: event.category,
      date: isoToLocal(event.date),
      location: event.location,
      ticketPrice: String(event.ticketPrice),
      totalTickets: String(event.totalTickets),
    });
  };

  const handleCreateChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();

    // Validate the selected date/time before submitting
    if (!formData.date) {
      showToast("Please select a date and time for the event", "error");
      return;
    }
    const parsedDate = parseDateTime(formData.date);
    if (!parsedDate) {
      showToast(
        "Invalid date format. Use DD-MM-YYYY HH:MM (e.g. 13-09-2026 10:00) or pick from the calendar.",
        "error"
      );
      return;
    }
    if (parsedDate <= new Date()) {
      showToast("Event date and time must be in the future", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/events", {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        date: localToISO(formData.date),
        ticketPrice: Number(formData.ticketPrice),
        totalTickets: Number(formData.totalTickets),
      });
      setShowCreateModal(false);
      setFormData(EMPTY_FORM);
      showToast("Event created successfully!", "success");
      fetchMyEvents();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to create event", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editingEvent) return;

    // Validate the selected date/time before submitting
    if (!editForm.date) {
      showToast("Please select a date and time for the event", "error");
      return;
    }
    const parsedDate = parseDateTime(editForm.date);
    if (!parsedDate) {
      showToast(
        "Invalid date format. Use DD-MM-YYYY HH:MM (e.g. 13-09-2026 10:00) or pick from the calendar.",
        "error"
      );
      return;
    }
    if (parsedDate <= new Date()) {
      showToast("Event date and time must be in the future", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/events/${editingEvent._id}`, {
        ...editForm,
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        location: editForm.location.trim(),
        date: localToISO(editForm.date),
        ticketPrice: Number(editForm.ticketPrice),
        totalTickets: Number(editForm.totalTickets),
      });
      setEditingEvent(null);
      showToast("Event updated successfully!", "success");
      fetchMyEvents();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to update event", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (eventId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/events/${eventId}`);
      showToast("Event deleted successfully!", "success");
      fetchMyEvents();
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || "Failed to delete event", "error");
    }
  };

  const totalRevenue = events.reduce(
    (sum, e) => sum + (e.totalTickets - e.availableTickets) * e.ticketPrice,
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-5 inset-x-0 z-[60] flex justify-center px-4">
          <div
            className={`px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white flex items-center gap-2 animate-slide-down ${
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-gray-900 leading-tight">EventHub</h1>
              <p className="text-[11px] font-semibold text-purple-600 uppercase tracking-widest">
                Organizer Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 mr-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.[0]?.toUpperCase() || "O"}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800 leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-400 leading-tight">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition shadow-md shadow-indigo-200 flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span> Create Event
            </button>
            <button
              onClick={logout}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-gray-700 text-sm font-medium hover:bg-slate-50 transition flex items-center gap-1.5"
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Your Events</h2>
            <p className="text-gray-500 mt-1">
              Manage, track, and grow your awesome events from one place.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Events</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.totalEvents}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <span className="text-2xl">🎪</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Tickets Booked</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.booked}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <span className="text-2xl">🎟️</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-purple-100 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Revenue</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">
                  ₹{totalRevenue.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Sold Out</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1">{stats.soldOut}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center">
                <span className="text-2xl">🔥</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-24">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-5 text-center font-medium">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && events.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-indigo-200 shadow-sm">
            <div className="text-6xl mb-4">🎪</div>
            <h3 className="text-xl font-bold text-gray-900">No events yet</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              Create your first event and start selling tickets to your audience.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-sm font-bold hover:from-indigo-700 hover:to-purple-700 transition shadow-lg shadow-indigo-200"
            >
              + Create Your First Event
            </button>
          </div>
        )}

        {/* Event Grid */}
        {!loading && !error && events.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const meta = CATEGORY_META[event.category] || CATEGORY_META.Other;
              const soldOut = event.availableTickets === 0;
              const progress = event.totalTickets
                ? Math.round(((event.totalTickets - event.availableTickets) / event.totalTickets) * 100)
                : 0;
              const isPast = new Date(event.date) < new Date();

              return (
                <div
                  key={event._id}
                  className="bg-white rounded-3xl border border-slate-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group"
                >
                  {/* Banner */}
                  <div className={`relative h-40 bg-gradient-to-r ${meta.gradient} flex items-center justify-center overflow-hidden`}>
                    <span className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
                    <span className="absolute -left-4 -bottom-8 w-24 h-24 bg-white/10 rounded-full" />
                    <span className="text-7xl drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{meta.icon}</span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/25 text-white backdrop-blur-sm">
                      {event.category}
                    </span>
                    {isPast && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-900/70 text-white">
                        Past
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover:text-indigo-700 transition">
                      {event.title}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1.5 line-clamp-2 flex-1">{event.description}</p>

                    {/* Meta */}
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
                        <div className="flex items-center gap-2">
                          <span className="text-base">🎟️</span>
                          <span>
                            <strong>{event.availableTickets}</strong> / {event.totalTickets}
                          </span>
                        </div>
                        <span className="font-bold text-indigo-600">₹{event.ticketPrice.toLocaleString("en-IN")}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400 font-medium">Booked</span>
                        <span className={`font-bold ${soldOut ? "text-rose-600" : "text-indigo-600"}`}>{progress}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${soldOut ? "bg-rose-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-5 pb-5 flex gap-2">
                    <button
                      onClick={() => openEditModal(event)}
                      className="flex-1 px-3 py-2 rounded-xl border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event._id, event.title)}
                      className="flex-1 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ══════════ CREATE EVENT MODAL ══════════ */}
      {showCreateModal && (
        <Modal
          title="Create New Event"
          subtitle="Fill in the details to launch your event"
          icon="🎪"
          onClose={() => setShowCreateModal(false)}
        >
          <EventForm
            formData={formData}
            onChange={handleCreateChange}
            onSubmit={handleCreateEvent}
            submitting={submitting}
            submitLabel={submitting ? "Creating..." : "Create Event"}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* ══════════ EDIT EVENT MODAL ══════════ */}
      {editingEvent && (
        <Modal
          title="Edit Event"
          subtitle={`Updating "${editingEvent.title}"`}
          icon="✏️"
          onClose={() => setEditingEvent(null)}
        >
          <EventForm
            formData={editForm}
            onChange={handleEditChange}
            onSubmit={handleUpdateEvent}
            submitting={submitting}
            submitLabel={submitting ? "Saving..." : "Save Changes"}
            onCancel={() => setEditingEvent(null)}
          />
        </Modal>
      )}
    </div>
  );
}

/* ─────────── Shared Modal Shell ─────────── */
function Modal({ title, subtitle, icon, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4 z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scale-in">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-indigo-100 text-xs mt-0.5">{subtitle}</p>
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
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/* ─────────── Reusable Event Form ─────────── */
function EventForm({ formData, onChange, onSubmit, submitting, submitLabel, onCancel }) {
  const inputClass =
    "w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Event Title</label>
        <input
          type="text"
          name="title"
          placeholder="e.g. Tech Conference 2026"
          value={formData.title}
          onChange={onChange}
          required
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          rows="3"
          placeholder="Describe what attendees can expect..."
          value={formData.description}
          onChange={onChange}
          required
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={onChange}
            className={`${inputClass} bg-white`}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date &amp; Time</label>
          <input
            type="datetime-local"
            name="date"
            value={formData.date}
            onChange={onChange}
            min={nowLocalMin()}
            required
            className={inputClass}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Pick from the calendar or type as <span className="font-medium text-gray-500">13-09-2026 10:00</span> — must be in the future.
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass}>Location</label>
        <input
          type="text"
          name="location"
          placeholder="Venue / city"
          value={formData.location}
          onChange={onChange}
          required
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Ticket Price (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            name="ticketPrice"
            placeholder="0.00"
            value={formData.ticketPrice}
            onChange={onChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Total Tickets</label>
          <input
            type="number"
            min="1"
            name="totalTickets"
            placeholder="100"
            value={formData.totalTickets}
            onChange={onChange}
            required
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-gray-600 text-sm font-semibold hover:bg-slate-50 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition shadow-md shadow-indigo-200"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export default OrganizerDashboard;
