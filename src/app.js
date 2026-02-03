const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const rbacRoutes = require("./routes/rbac.routes");
app.use("/rbac", rbacRoutes);

module.exports = { app };
