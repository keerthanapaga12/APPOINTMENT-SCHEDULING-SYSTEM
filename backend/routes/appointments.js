// backend/routes/appointments.js

const express = require("express");
const router = express.Router();
const { supabase } = require("../supabase");
const authMiddleware = require("../middleware/authMiddleware");

// GET: View appointments for the logged-in user
router.get("/", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabase
            .from("appointments")
            .select("*")
            .eq("user_id", userId)
            .order("appointment_date", { ascending: true });

        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        return res.status(200).json({
            appointments: data
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to retrieve appointments."
        });
    }
});

// POST: Book a new appointment
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { service, date, slotId, time } = req.body;
        const userId = req.user.id;

        if (!service || !date || !slotId) {
            return res.status(400).json({
                message: "Service, date, and time slot are required."
            });
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                message: "Invalid appointment date."
            });
        }

        if (date < new Date().toLocaleDateString("en-CA")) {
            return res.status(400).json({
                message: "Appointment date cannot be in the past."
            });
        }

        // Confirm that the selected slot exists and is available.
        const { data: slot, error: slotError } = await supabase
            .from("availability")
            .select("*")
            .eq("id", slotId)
            .eq("service_name", service)
            .eq("available_date", date)
            .eq("is_available", true)
            .maybeSingle();

        if (slotError) {
            return res.status(400).json({
                message: slotError.message
            });
        }

        if (!slot) {
            return res.status(409).json({
                message: "This time slot is no longer available."
            });
        }

        // Insert the appointment.
        const { data: appointment, error: insertError } = await supabase
            .from("appointments")
            .insert({
                user_id: userId,
                service_name: service,
                appointment_date: date,
                time: time || slot.start_time,
                availability_id: slotId,
                status: "pending"
            })
            .select()
            .single();

        if (insertError) {
            return res.status(400).json({
                message: insertError.message
            });
        }

        // Mark the slot as unavailable after booking.
        const { error: updateError } = await supabase
            .from("availability")
            .update({ is_available: false })
            .eq("id", slotId)
            .eq("is_available", true);

        if (updateError) {
            // Avoid leaving an appointment behind if the slot update fails.
            await supabase
                .from("appointments")
                .delete()
                .eq("id", appointment.id)
                .eq("user_id", userId);

            return res.status(500).json({
                message: "Could not reserve this time slot. Please try again."
            });
        }

        return res.status(201).json({
            message: "Appointment booked successfully.",
            appointment
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to book appointment."
        });
    }
});

// PATCH: Cancel an appointment belonging to the logged-in user
router.patch("/:id", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const userId = req.user.id;

        if (status !== "cancelled") {
            return res.status(400).json({
                message: "Only cancellation is supported."
            });
        }

        const { data: appointment, error: fetchError } = await supabase
            .from("appointments")
            .select("id, status, availability_id")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();

        if (fetchError) {
            return res.status(400).json({
                message: fetchError.message
            });
        }

        if (!appointment) {
            return res.status(404).json({
                message: "Appointment not found."
            });
        }

        if (appointment.status === "cancelled") {
            return res.status(400).json({
                message: "This appointment is already cancelled."
            });
        }

        const { data: updatedAppointment, error: updateError } = await supabase
            .from("appointments")
            .update({ status: "cancelled" })
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();

        if (updateError) {
            return res.status(400).json({
                message: updateError.message
            });
        }

        // Release the slot so another user can book it.
        if (appointment.availability_id) {
            const { error: slotError } = await supabase
                .from("availability")
                .update({ is_available: true })
                .eq("id", appointment.availability_id);

            if (slotError) {
                console.error("Could not release slot:", slotError.message);
            }
        }

        return res.status(200).json({
            message: "Appointment cancelled successfully.",
            appointment: updatedAppointment
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to cancel appointment."
        });
    }
});

module.exports = router;