"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware"); // sesuaikan nama middleware auth kamu
const RoleController = require("../controllers/role.controller");

// GET /roles?offset=0&limit=10&q=adm&status=active&order_by=name&sort=asc
router.get("/", authRequired, RoleController.list);

// POST /roles  (add role)
router.post("/", authRequired, RoleController.create);

// PUT /roles/:id  (edit role)
router.get("/:id", authRequired, RoleController.detail);

// PUT /roles/:id  (edit role)
router.put("/:id", authRequired, RoleController.update);

// DELETE /roles/:id
router.delete("/:id", authRequired, RoleController.remove);

module.exports = router;
