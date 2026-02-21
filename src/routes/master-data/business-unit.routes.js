"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware"); 
const BusinessUnitController = require("../../controllers/master-data/business-unit.controller");


// GET /business-units?page=1&limit=10&searchTerm=bu&filterColumn=...&orderBy=...&from=...&to=...
router.get("/", authRequired, BusinessUnitController.list);

// GET /business-unit/features
router.get("/features", authRequired, BusinessUnitController.features);

// GET /business-units/:id
router.get("/:id", authRequired, BusinessUnitController.detail);

// POST /business-units
router.post("/", authRequired, BusinessUnitController.create);

// PUT /business-units/:id
router.put("/:id", authRequired, BusinessUnitController.update);

// DELETE /business-units/:id
router.delete("/:id", authRequired, BusinessUnitController.remove);



module.exports = router;


