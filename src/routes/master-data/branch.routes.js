"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware");
const BranchController = require("../../controllers/master-data/branch.controller");

// GET /branches?page=1&limit=10&searchTerm=...
router.get("/", authRequired, BranchController.list);

// GET /branches/summary
router.get("/summary", authRequired, BranchController.summary);

// GET /branches/:id
router.get("/:id", authRequired, BranchController.detail);

// POST /branches
router.post("/", authRequired, BranchController.create);

// PUT /branches/:id
router.put("/:id", authRequired, BranchController.update);

// DELETE /branches/:id
router.delete("/:id", authRequired, BranchController.remove);

module.exports = router;