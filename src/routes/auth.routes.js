const express = require("express");
const router = express.Router();
const { login, refreshTokenSession } = require("../services/auth.service");

router.post("/login", async (req, res) => {
  try {
    const result = await login(req.body);
    return res.status(result.Meta.Code).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      Meta: { Code: 500, Status: false, Message: "Internal server error" },
      Data: null,
    });
  }
});

router.get("/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.query.refreshToken;
    const result = await refreshTokenSession(refreshToken);
    return res.status(result.status).json(result.json);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
