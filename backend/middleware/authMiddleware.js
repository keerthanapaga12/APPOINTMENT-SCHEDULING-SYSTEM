// backend/middleware/authMiddleware.js

const { supabase } = require("../supabase");

async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Access denied. Please log in."
            });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                message: "Authentication token is missing."
            });
        }

        // Verify the token with Supabase Auth.
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                message: "Invalid or expired authentication token."
            });
        }

        // Fetch the user's profile and role.
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("name, role")
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile lookup failed:", profileError.message);

            return res.status(500).json({
                message: "Unable to verify user permissions."
            });
        }

        req.user = {
            id: user.id,
            email: user.email,
            name: profile?.name || user.user_metadata?.name || "",
            role: profile?.role || "user"
        };

        next();
    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(500).json({
            message: "Authentication could not be completed."
        });
    }
}

module.exports = authMiddleware;