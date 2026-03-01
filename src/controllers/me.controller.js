const {
  buildMyMenuResponse,
  getUserProfile,
} = require("../services/me.service");
const { fail } = require("../utils/response");

async function getMyMenu(req, res) {
  try {
    const { userId, roleId } = req.auth;
    const result = await buildMyMenuResponse({ userId, roleId });

    return res.status(200).json({
      Meta: { Code: 200, Status: true, Message: "OK" },
      Data: { Record: result },
    });
  } catch (err) {
    console.error("GET /me/menu error:", err);
    return res.status(500).json({
      Meta: {
        Code: 500,
        Status: false,
        Message: err.message || "Internal Server Error",
      },
      Data: { Record: null },
    });
  }
}

async function getProfile(req, res) {
  try {
    const userId = req.auth?.userId; // dari middleware requireAuth
    const result = await getUserProfile(userId);
    return res.status(result.Meta.Code).json(result);
  } catch (err) {
    const r = fail("Internal server error", 500, { error: err?.message });
    return res.status(r.Meta.Code).json(r);
  }
}

module.exports = { getMyMenu, getProfile };
