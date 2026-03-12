"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware");
const VesselController = require("../../controllers/master-data/vessel.controller");
const VesselOptionsController = require("../../controllers/master-data/vessel.options.controller");


// GET /inbound/vessels
router.get("/GetPaginationDataList", authRequired, VesselController.list);

// ✅ NEW options endpoints
router.get(
  "/GetSapCodeOptionList",
  authRequired,
  VesselOptionsController.sapCodeOptions,
);
router.get(
  "/GetExternalMappingKeyList",
  authRequired,
  VesselOptionsController.externalMappingKeys,
);
router.get(
  "/GetWarehouseOptionList",
  authRequired,
  VesselOptionsController.warehouseOptions,
);

// POST /inbound/vessels
router.post("/Create", authRequired, VesselController.create);

// GET /inbound/vessels/:id
router.get("/GetById/:id", authRequired, VesselController.detail);

// PUT /inbound/vessels/:id
router.put("/Update/:id", authRequired, VesselController.update);

// DELETE /inbound/vessels/:id
router.delete("/Delete/:id", authRequired, VesselController.remove);




module.exports = router;