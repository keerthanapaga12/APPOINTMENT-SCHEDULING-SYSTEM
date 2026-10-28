/* ==========================================
   APPOINTMENT SCHEDULING SYSTEM
   Frontend JavaScript: script.js
========================================== */

const API_URL = "http://localhost:5000/api";

let authToken = null;
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});

function initializeApp() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const bookingForm = document.getElementById("bookingForm");
    const slotForm = document.getElementById("slotForm");
    const serviceSelect = document.getElementById("serviceSelect");
    const dateInput = document.getElementById("dateInput");
    const refreshBtn = document.getElementById("refreshBtn");
    const logoutBtn = document.getElementById("logoutBtn");

    // Set the earliest booking date to today.
    if (dateInput) {
        dateInput.min = getLocalDate();
    }

    // Authentication forms.
    loginForm?.addEventListener("submit", handleLogin);
    registerForm?.addEventListener("submit", handleRegister);

    // Appointment booking.
    bookingForm?.addEventListener("submit", handleBooking);
    serviceSelect?.addEventListener("change", loadAvailableSlots);
    dateInput?.addEventListener("change", loadAvailableSlots);

    // Staff availability form.
    slotForm?.addEventListener("submit", handleAddSlot);

    // Appointment list.
    refreshBtn?.addEventListener("click", loadAppointments);

    // Logout.
    logoutBtn?.addEventListener("click", handleLogout);

    // Quick-book buttons in the services section.
    document.querySelectorAll(".service-book").forEach(button => {
        button.addEventListener("click", () => {
            const serviceName = button.dataset.serviceName;
            if (serviceSelect && serviceName) {
                serviceSelect.value = serviceName;
                document.getElementById("booking")?.scrollIntoView({
                    behavior: "smooth"
                });
                loadAvailableSlots();
            }
        });
    });

    updateAuthUI();
    loadAppointments();
}

/* ==========================================
   HELPER FUNCTIONS
========================================== */

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

async function apiRequest(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? data.message || data.error
                : data;

        throw new Error(message || `Request failed (${response.status})`);
    }

    return data;
}

function showNotice(message, type = "success") {
    const notice = document.getElementById("notice");

    if (!notice) {
        console.log(message);
        return;
    }

    notice.textContent = message;
    notice.className = `notice ${type}`;
    notice.classList.remove("hidden");

    window.clearTimeout(showNotice.timeoutId);

    showNotice.timeoutId = window.setTimeout(() => {
        notice.classList.add("hidden");
    }, 4000);
}

function setLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
        button.dataset.originalText = button.textContent;
        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;
        button.disabled = false;
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function formatDate(dateString) {
    if (!dateString) return "Not specified";

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function normalizeError(error) {
    return error instanceof Error
        ? error.message
        : "Something went wrong. Please try again.";
}

/* ==========================================
   AUTHENTICATION
========================================== */

async function handleRegister(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const name = document.getElementById("registerName")?.value.trim();
    const email = document.getElementById("registerEmail")?.value.trim();
    const password = document.getElementById("registerPassword")?.value;

    if (!name || !email || !password) {
        showNotice("Please fill in all registration fields.", "error");
        return;
    }

    if (password.length < 6) {
        showNotice("Password must contain at least 6 characters.", "error");
        return;
    }

    setLoading(submitButton, true, "Creating account...");

    try {
        const result = await apiRequest("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password })
        });

        if (result.token) {
            authToken = result.token;
            currentUser = result.user || { name, email };
        }

        form.reset();
        updateAuthUI();
        showNotice(
            result.message || "Registration completed successfully."
        );

        await loadAppointments();
    } catch (error) {
        showNotice(normalizeError(error), "error");
    } finally {
        setLoading(submitButton, false);
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const email = document.getElementById("loginEmail")?.value.trim();
    const password = document.getElementById("loginPassword")?.value;

    if (!email || !password) {
        showNotice("Please enter your email and password.", "error");
        return;
    }

    setLoading(submitButton, true, "Logging in...");

    try {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        if (!result.token) {
            throw new Error("The server did not return an authentication token.");
        }

        authToken = result.token;
        currentUser = result.user || { email };

        form.reset();
        updateAuthUI();

        showNotice(`Welcome${currentUser.name ? `, ${currentUser.name}` : ""}!`);
        await loadAvailableSlots();
        await loadAppointments();
    } catch (error) {
        showNotice(normalizeError(error), "error");
    } finally {
        setLoading(submitButton, false);
    }
}

function handleLogout() {
    authToken = null;
    currentUser = null;

    updateAuthUI();

    const list = document.getElementById("appointmentsList");
    if (list) {
        list.innerHTML =
            '<p class="empty">Please log in to view your appointments.</p>';
    }

    showNotice("You have been logged out.");
}

function updateAuthUI() {
    const logoutBtn = document.getElementById("logoutBtn");
    const staffPanel = document.getElementById("staffPanel");

    if (logoutBtn) {
        logoutBtn.classList.toggle("hidden", !authToken);
    }

    // The backend must enforce staff permissions independently.
    if (staffPanel) {
        staffPanel.classList.toggle(
            "hidden",
            !authToken || currentUser?.role !== "staff"
        );
    }
}

/* ==========================================
   AVAILABLE APPOINTMENT SLOTS
========================================== */

async function loadAvailableSlots() {
    const serviceSelect = document.getElementById("serviceSelect");
    const dateInput = document.getElementById("dateInput");
    const slotSelect = document.getElementById("slotSelect");
    const slotHelp = document.getElementById("slotHelp");

    if (!serviceSelect || !dateInput || !slotSelect) return;

    const service = serviceSelect.value;
    const date = dateInput.value;

    slotSelect.innerHTML = '<option value="">Select a time slot</option>';

    if (slotHelp) {
        slotHelp.textContent = "";
    }

    if (!service || !date) {
        if (slotHelp) {
            slotHelp.textContent = "Choose a service and date first.";
        }
        return;
    }

    try {
        const params = new URLSearchParams({ service, date });
        const result = await apiRequest(`/slots?${params.toString()}`);

        const slots = Array.isArray(result)
            ? result
            : result.slots || [];

        if (slots.length === 0) {
            if (slotHelp) {
                slotHelp.textContent =
                    "No available slots found for this date.";
            }
            return;
        }

        slots.forEach(slot => {
            const option = document.createElement("option");

            const slotId = slot.id ?? slot.slotId;
            const startTime = slot.startTime ?? slot.start_time ?? slot.time;
            const endTime = slot.endTime ?? slot.end_time;

            option.value = slotId ?? startTime;

            option.textContent = endTime
                ? `${startTime} - ${endTime}`
                : startTime;

            if (slotId !== undefined) {
                option.dataset.slotId = slotId;
            }

            slotSelect.appendChild(option);
        });

        if (slotHelp) {
            slotHelp.textContent = "Select one of the available time slots.";
        }
    } catch (error) {
        if (slotHelp) {
            slotHelp.textContent = "Unable to load available slots.";
        }

        showNotice(normalizeError(error), "error");
    }
}

/* ==========================================
   BOOK AN APPOINTMENT
========================================== */

async function handleBooking(event) {
    event.preventDefault();

    if (!authToken) {
        showNotice("Please log in before booking an appointment.", "error");
        document.getElementById("loginForm")?.scrollIntoView({
            behavior: "smooth"
        });
        return;
    }

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const service = document.getElementById("serviceSelect")?.value;
    const date = document.getElementById("dateInput")?.value;
    const slotSelect = document.getElementById("slotSelect");
    const selectedOption = slotSelect?.selectedOptions[0];

    if (!service || !date || !slotSelect?.value) {
        showNotice("Please select a service, date, and time slot.", "error");
        return;
    }

    if (date < getLocalDate()) {
        showNotice("Please choose today or a future date.", "error");
        return;
    }

    const slotId = selectedOption?.dataset.slotId || slotSelect.value;
    const time = selectedOption?.textContent || slotSelect.value;

    setLoading(submitButton, true, "Booking...");

    try {
        await apiRequest("/appointments", {
            method: "POST",
            body: JSON.stringify({
                service,
                date,
                slotId,
                time
            })
        });

        form.reset();

        const dateInput = document.getElementById("dateInput");
        if (dateInput) {
            dateInput.min = getLocalDate();
        }

        showNotice("Appointment booked successfully!");

        await loadAvailableSlots();
        await loadAppointments();
    } catch (error) {
        showNotice(normalizeError(error), "error");
    } finally {
        setLoading(submitButton, false);
    }
}

/* ==========================================
   VIEW APPOINTMENTS
========================================== */

async function loadAppointments() {
    const list = document.getElementById("appointmentsList");

    if (!list) return;

    if (!authToken) {
        list.innerHTML =
            '<p class="empty">Please log in to view your appointments.</p>';
        return;
    }

    list.innerHTML = '<p class="empty">Loading appointments...</p>';

    try {
        const result = await apiRequest("/appointments");

        const appointments = Array.isArray(result)
            ? result
            : result.appointments || [];

        if (appointments.length === 0) {
            list.innerHTML =
                '<p class="empty">You have no appointments yet.</p>';
            return;
        }

        list.innerHTML = appointments.map(appointment => {
            const id = appointment.id;
            const service = appointment.service_name
                || appointment.service
                || "Appointment";

            const date = appointment.appointment_date
                || appointment.date;

            const time = appointment.time
                || appointment.start_time
                || "";

            const status = String(
                appointment.status || "pending"
            ).toLowerCase();

            const statusClass = status === "confirmed"
                ? "pill-success"
                : status === "cancelled"
                    ? "pill-cancelled"
                    : "";

            const cancelButton = status !== "cancelled"
                ? `
                    <button
                        class="button button-danger button-small"
                        data-cancel-id="${escapeHTML(id)}"
                        type="button">
                        Cancel
                    </button>
                `
                : "";

            return `
                <article class="appointment-card">
                    <div>
                        <h3>${escapeHTML(service)}</h3>
                        <p><strong>Date:</strong> ${escapeHTML(formatDate(date))}</p>
                        <p><strong>Time:</strong> ${escapeHTML(time || "Not specified")}</p>
                        <p>
                            <strong>Status:</strong>
                            <span class="pill ${statusClass}">
                                ${escapeHTML(status)}
                            </span>
                        </p>
                    </div>
                    <div class="appointment-actions">
                        ${cancelButton}
                    </div>
                </article>
            `;
        }).join("");

        list.querySelectorAll("[data-cancel-id]").forEach(button => {
            button.addEventListener("click", () => {
                cancelAppointment(button.dataset.cancelId, button);
            });
        });
    } catch (error) {
        list.innerHTML =
            '<p class="empty">Could not load appointments. Please try again.</p>';

        showNotice(normalizeError(error), "error");
    }
}

/* ==========================================
   CANCEL AN APPOINTMENT
========================================== */

async function cancelAppointment(id, button) {
    if (!id) {
        showNotice("Appointment ID is missing.", "error");
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    setLoading(button, true, "Cancelling...");

    try {
        await apiRequest(`/appointments/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "cancelled" })
        });

        showNotice("Appointment cancelled successfully.");
        await loadAppointments();
    } catch (error) {
        showNotice(normalizeError(error), "error");
        setLoading(button, false);
    }
}

/* ==========================================
   STAFF: ADD AVAILABILITY
========================================== */

async function handleAddSlot(event) {
    event.preventDefault();

    if (!authToken || currentUser?.role !== "staff") {
        showNotice("Only authorized staff can add availability.", "error");
        return;
    }

    const form = event.currentTarget;
    const submitButton = form.querySelector('button[type="submit"]');

    const service = document.getElementById("staffServiceSelect")?.value;
    const date = document.getElementById("staffDate")?.value;
    const startTime = document.getElementById("startTime")?.value;
    const endTime = document.getElementById("endTime")?.value;

    if (!service || !date || !startTime || !endTime) {
        showNotice("Please fill in all availability fields.", "error");
        return;
    }

    if (date < getLocalDate()) {
        showNotice("Availability must be today or in the future.", "error");
        return;
    }

    if (startTime >= endTime) {
        showNotice("End time must be later than start time.", "error");
        return;
    }

    setLoading(submitButton, true, "Saving...");

    try {
        await apiRequest("/slots", {
            method: "POST",
            body: JSON.stringify({
                service,
                date,
                startTime,
                endTime
            })
        });

        form.reset();
        showNotice("Availability added successfully.");
        await loadAvailableSlots();
    } catch (error) {
        showNotice(normalizeError(error), "error");
    } finally {
        setLoading(submitButton, false);
    }
}