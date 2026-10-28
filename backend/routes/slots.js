// backend/routes/slots.js

const express = require("express");
const router = express.Router();
const { supabase } = require("../supabase");
const authMiddleware = require("../middleware/authMiddleware");

// GET: Get available appointment slots
router.get("/", async (req, res) => {
    try {
        const { service, date } = req.query;

        if (!service || !date) {
            return res.status(400).json({
                message: "Service and date are required."
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Invalid date format. Use YYYY-MM-DD."
            });
        }

        const { data: slots, error } = await supabase
            .from("availability")
            .select("id, service_name, available_date, start_time, end_time")
            .eq("service_name", service)
            .eq("available_date", date)
            .eq("is_available", true)
            .order("start_time", { ascending: true });

        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        return res.status(200).json({ slots });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to retrieve available slots."
        });
    }
});

// POST: Add appointment availability (staff only)
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { service, date, startTime, endTime } = req.body;

        if (req.user.role !== "staff") {
            return res.status(403).json({
                message: "Only staff members can add availability."
            });
        }

        if (!service || !date || !startTime || !endTime) {
            return res.status(400).json({
                message: "Service, date, start time, and end time are required."
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Invalid date format. Use YYYY-MM-DD."
            });
        }

        if (date < new Date().toLocaleDateString("en-CA")) {
            return res.status(400).json({
                message: "Availability cannot be added for a past date."
            });
        }

        if (
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
        ) {
            return res.status(400).json({
                message: "Invalid time format. Use HH:MM."
            });
        }

        if (startTime >= endTime) {
            return res.status(400).json({
                message: "End time must be later than start time."
            });
        }

        const { data: slot, error } = await supabase
            .from("availability")
            .insert({
                service_name: service,
                available_date: date,
                start_time: startTime,
                end_time: endTime,
                is_available: true
            })
            .select()
            .single();

        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        return res.status(201).json({
            message: "Availability added successfully.",
            slot
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to add availability."
        });
    }
});

module.exports = router;