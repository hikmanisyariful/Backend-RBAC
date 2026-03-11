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
router.get("/GetPaginationDataList", authRequired, MenuController.list);

// POST /menus
router.post("/Create", authRequired, MenuController.create);

// GET /menus/lookup
router.get("/GetList", authRequired, MenuController.lookup);

// Get /menus/menu-permission
router.get(
  "/GetListMenuPermission",
  authRequired,
  MenuController.menuPermission,
);

// GET /menus/:id
router.get("/GetById/:id", authRequired, onlyNumericId, MenuController.detail);

// PUT /menus/:id
router.put("/Update/:id", authRequired, onlyNumericId, MenuController.update);

// DELETE /menus/:id
router.delete(
  "/Delete/:id",
  authRequired,
  onlyNumericId,
  MenuController.remove,
);

module.exports = router;
