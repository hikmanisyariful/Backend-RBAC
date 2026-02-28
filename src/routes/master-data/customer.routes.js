"use strict";

const router = require("express").Router();
const { authRequired } = require("../../middlewares/auth.middleware");
const CustomerController = require("../../controllers/master-data/customer.controller");

// GET /customers?page=1&limit=10&searchTerm=...&filterColumn=...&orderBy=...&from=...&to=...&includeDeleted=true
router.get("/", authRequired, CustomerController.list);

module.exports = router;