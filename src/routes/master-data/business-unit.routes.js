"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware"); 
const BusinessUnitController = require("../../controllers/master-data/business-unit.controller");


// GET /business-units?page=1&limit=10&searchTerm=bu&filterColumn=...&orderBy=...&from=...&to=...
router.get("/GetPaginationDataList", authRequired, BusinessUnitController.list);

// GET /business-unit/features
router.get("/GetFeatureList", authRequired, BusinessUnitController.features);

// POST /business-units
router.post("/Create", authRequired, BusinessUnitController.create);

// GET /business-units/:id
router.get("/GetById/:id", authRequired, BusinessUnitController.detail);

// PUT /business-units/:id
router.put("/Update/:id", authRequired, BusinessUnitController.update);

// DELETE /business-units/:id
router.delete("/Delete/:id", authRequired, BusinessUnitController.remove);



module.exports = router;


