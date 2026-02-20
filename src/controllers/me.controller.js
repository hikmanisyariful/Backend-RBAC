const { buildMyMenuResponse } = require("../services/me.service");

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
      Meta: { Code: 500, Status: false, Message: err.message || "Internal Server Error" },
      Data: { Record: null },
    });
  }
}

module.exports = { getMyMenu };
