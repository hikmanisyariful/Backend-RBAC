"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware");
const MenuController = require("../controllers/menu.controller");

// GET /menus?page=1&limit=10&searchTerm=adm&filterColumn={} &orderBy={}
router.get("/", authRequired, MenuController.list);

// POST /menus
router.post("/", authRequired, MenuController.create);

// GET /menus/lookup
router.get("/lookup", authRequired, MenuController.lookup);

// GET /menus/:id
router.get("/:id", authRequired, MenuController.detail);

// PUT /menus/:id
router.put("/:id", authRequired, MenuController.update);

// DELETE /menus/:id
router.delete("/:id", authRequired, MenuController.remove);

module.exports = router;