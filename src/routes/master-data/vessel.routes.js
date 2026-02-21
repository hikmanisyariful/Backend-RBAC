"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware");
const VesselController = require("../../controllers/master-data/vessel.controller");
const VesselOptionsController = require("../../controllers/master-data/vessel.options.controller");


// GET /inbound/vessels
router.get("/", authRequired, VesselController.list);

// ✅ NEW options endpoints
router.get("/sap-code-options", authRequired, VesselOptionsController.sapCodeOptions);
router.get("/external-mapping-keys", authRequired, VesselOptionsController.externalMappingKeys);
router.get("/warehouse-options", authRequired, VesselOptionsController.warehouseOptions);

// GET /inbound/vessels/:id
router.get("/:id", authRequired, VesselController.detail);

// POST /inbound/vessels
router.post("/", authRequired, VesselController.create);

// PUT /inbound/vessels/:id
router.put("/:id", authRequired, VesselController.update);

// DELETE /inbound/vessels/:id
router.delete("/:id", authRequired, VesselController.remove);




module.exports = router;