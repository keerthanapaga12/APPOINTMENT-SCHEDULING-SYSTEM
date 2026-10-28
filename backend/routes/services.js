// backend/routes/services.js

const express = require("express");
const router = express.Router();
const { supabase } = require("../supabase");

// GET: Retrieve all available services
router.get("/", async (req, res) => {
    try {
        const { data: services, error } = await supabase
            .from("services")
            .select("*")
            .eq("is_active", true)
            .order("name", { ascending: true });

        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        return res.status(200).json({
            services: services || []
        });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to retrieve services."
        });
    }
});

// GET: Retrieve a single service by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const { data: service, error } = await supabase
            .from("services")
            .select("*")
            .eq("id", id)
            .eq("is_active", true)
            .maybeSingle();

        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        if (!service) {
            return res.status(404).json({
                message: "Service not found."
            });
        }

        return res.status(200).json({ service });
    } catch (error) {
        return res.status(500).json({
            message: "Failed to retrieve service."
        });
    }
});

module.exports = router;