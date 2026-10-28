// backend/routes/auth.js

const express = require("express");
const router = express.Router();
const { supabase } = require("../supabase");

// POST: Register a new user
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email, and password are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters."
            });
        }

        const { data, error } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: {
                    name: name.trim()
                }
            }
        });

        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        if (!data.user) {
            return res.status(400).json({
                message: "Registration failed. Please try again."
            });
        }

        return res.status(201).json({
            message: data.session
                ? "Registration successful."
                : "Registration successful. Please check your email to verify your account.",
            token: data.session?.access_token || null,
            user: {
                id: data.user.id,
                name: data.user.user_metadata?.name || name.trim(),
                email: data.user.email,
                role: "user"
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Unable to register. Please try again."
        });
    }
});

// POST: Log in an existing user
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        });

        if (error) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        if (!data.session || !data.user) {
            return res.status(401).json({
                message: "Login failed. Please verify your email if required."
            });
        }

        // Fetch the user's profile and role from the profiles table.
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", data.user.id)
            .maybeSingle();

        if (profileError) {
            return res.status(500).json({
                message: "Unable to load your user profile."
            });
        }

        return res.status(200).json({
            message: "Login successful.",
            token: data.session.access_token,
            user: {
                id: data.user.id,
                name: profile?.name || data.user.user_metadata?.name || "",
                email: data.user.email,
                role: profile?.role || "user"
            }
        });
    } catch (error) {
        return res.status(500).json({
            message: "Unable to log in. Please try again."
        });
    }
});

module.exports = router;