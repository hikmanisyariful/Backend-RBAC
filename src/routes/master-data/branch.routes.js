"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware");
const BranchController = require("../../controllers/master-data/branch.controller");

// GET /branches?page=1&limit=10&searchTerm=...
router.get("/GetPaginationDataList", authRequired, BranchController.list);

// GET /branches/summary
router.get("/GetSummary", authRequired, BranchController.summary);

// POST /branches
router.post("/Create", authRequired, BranchController.create);


// GET /branches/:id
router.get("/GetById/:id", authRequired, BranchController.detail);


// PUT /branches/:id
router.put("/Update/:id", authRequired, BranchController.update);

// DELETE /branches/:id
router.delete("/Delete/:id", authRequired, BranchController.remove);

module.exports = router;