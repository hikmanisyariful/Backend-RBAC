"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware");
const WarehouseController = require("../../controllers/master-data/warehouse.controller");

// GET /warehouses?page=1&limit=10&searchTerm=...&filterColumn=...&orderBy=...&from=...&to=...&includeDeleted=true
router.get("/GetPaginationDataList", authRequired, WarehouseController.list);

module.exports = router;