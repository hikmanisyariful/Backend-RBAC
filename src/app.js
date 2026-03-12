const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const rbacRoutes = require("./routes/rbac.routes");
const meRoutes = require("./routes/me.routes");
const roleRoutes = require("./routes/role.routes");
const businessUnitsRoutes = require("./routes/master-data/business-unit.routes");
const branchRoutes = require("./routes/master-data/branch.routes");
const vesselRoutes = require("./routes/master-data/vessel.routes");
const warehouseRoutes = require("./routes/master-data/warehouse.routes");
const customerRoutes = require("./routes/master-data/customer.routes");
const menuRoutes = require("./routes/menu.routes");
const userRoutes = require("./routes/user.routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/identity/Auth", authRoutes);
app.use("/identity/Role", roleRoutes);
app.use("/identity/RBAC", rbacRoutes);
app.use("/identity/Menu", menuRoutes);
app.use("/identity/User", userRoutes);

app.use("/organization/Businessunit", businessUnitsRoutes);
app.use("/organization/Branch", branchRoutes);
app.use("/organization/Warehouse", warehouseRoutes);

app.use("/partner/Customer", customerRoutes);

app.use("/inbound/Vessel", vesselRoutes);



app.use(meRoutes);

module.exports = { app };
