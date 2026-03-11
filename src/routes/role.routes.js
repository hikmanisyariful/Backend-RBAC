"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware"); // sesuaikan nama middleware auth kamu
const RoleController = require("../controllers/role.controller");

// GET /roles?offset=0&limit=10&q=adm&status=active&order_by=name&sort=asc
router.get("/GetPaginationDataList", authRequired, RoleController.list);

// POST /roles  (add role)
router.post("/Create", authRequired, RoleController.create);

// PUT /roles/:id  (edit role)
router.get("/GetById/:id", authRequired, RoleController.detail);

// PUT /roles/:id  (edit role)
router.put("/Update/:id", authRequired, RoleController.update);

// DELETE /roles/:id
router.delete("/Delete/:id", authRequired, RoleController.remove);

module.exports = router;
