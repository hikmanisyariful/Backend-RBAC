const express = require("express");
const router = express.Router();

const { getRoleTree } = require("../services/rbac.service");

router.get("/roles/:roleCode/tree", async (req, res) => {
  try {
    const { roleCode } = req.params;
    const data = await getRoleTree(roleCode);
    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: err?.message || "Internal Server Error",
    });
  }
});

module.exports = router;
