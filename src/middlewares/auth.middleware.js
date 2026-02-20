const jwt = require("jsonwebtoken");

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      Meta: { Code: 401, Status: false, Message: "Unauthorized" },
      Data: { Record: null },
    });
  }

  try {
    // NOTE: sesuaikan env / secret kamu
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // payload minimal: { userId, roleId } atau { sub }
    req.auth = {
      accessToken: token,
      userId: payload.userId || payload.sub,
      roleId: payload.roleId, // optional
    };

    if (!req.auth.userId) throw new Error("Missing userId in token");
    next();
  } catch (err) {
    return res.status(401).json({
      Meta: { Code: 401, Status: false, Message: "Invalid token" },
      Data: { Record: null },
    });
  }
}

module.exports = { authRequired };
