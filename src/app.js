const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const rbacRoutes = require("./routes/rbac.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/rbac", rbacRoutes);

module.exports = { app };
