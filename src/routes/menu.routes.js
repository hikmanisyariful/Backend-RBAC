"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware");
const MenuController = require("../controllers/menu.controller");

function onlyNumericId(req, res, next) {
  const id = String(req.params.id ?? "").trim();

  // kalau bukan angka -> biarkan router cari route lain
  // (atau bisa res.status(404)...)
  if (!/^\d+$/.test(id)) return next("route");

  return next();
}

// GET /menus?page=1&limit=10&searchTerm=adm&filterColumn={} &orderBy={}
router.get("/", authRequired, MenuController.list);

// POST /menus
router.post("/", authRequired, MenuController.create);

// GET /menus/lookup
router.get("/lookup", authRequired, MenuController.lookup);

// Get /menus/menu-permission
router.get("/menu-permission", authRequired, MenuController.menuPermission);

// GET /menus/:id
router.get("/:id", authRequired, onlyNumericId, MenuController.detail);

// PUT /menus/:id
router.put("/:id", authRequired, onlyNumericId, MenuController.update);

// DELETE /menus/:id
router.delete("/:id", authRequired, onlyNumericId, MenuController.remove);

module.exports = router;