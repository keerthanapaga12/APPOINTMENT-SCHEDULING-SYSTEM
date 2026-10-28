
 // backend/server.js

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Basic health-check route
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Appointment Scheduling System API is running.",
        status: "success"
    });
});

// Temporary API routes
app.get("/api", (req, res) => {
    res.status(200).json({
        message: "Appointment Scheduling System API is working.",
        routes: [
            "/api/auth",
            "/api/services",
            "/api/slots",
            "/api/appointments"
        ],
        note: "Supabase connection will be added later."
    });
});

// Handle unknown routes
app.use((req, res) => {
    res.status(404).json({
        message: "Route not found."
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        message: "An unexpected server error occurred."
    });
});

// Start server
app.listen(PORT, () => {
    console.log(
        `Appointment Scheduling System API running at http://localhost:${PORT}`
    );
});

 // Temporary endpoint for testing the frontend
app.get("/api/appointments", (req, res) => {
    res.json({
        appointments: []
    });
});

// Temporary endpoint for available slots
app.get("/api/slots", (req, res) => {
    res.json({
        slots: []
    });
});

