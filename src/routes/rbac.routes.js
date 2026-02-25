"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware"); // sesuaikan
const RbacController = require("../controllers/rbac.controller");

/* =========================
 * Role RBAC Tree
 * ========================= */

// GET /rbac/roles/:roleCode/tree
router.get("/roles/:roleCode/tree", authRequired, RbacController.getRoleTree);

// PUT /rbac/roles/:roleCode/permissions
router.put(
  "/roles/:roleCode/permissions",
  authRequired,
  RbacController.updateRolePermissions,
);

/* =========================
 * User Override (EXTRA_ONLY)
 * ========================= */

// GET /rbac/users/:userId/roles/:roleCode/tree
router.get(
  "/users/:userId/roles/:roleCode/tree",
  authRequired,
  RbacController.getUserOverrideTree,
);

// PUT /rbac/users/:userId/roles/:roleCode/permission-overrides
router.put(
  "/users/:userId/roles/:roleCode/permission-overrides",
  authRequired,
  RbacController.updateUserPermissionOverride,
);

// GET /rbac/users/:userId/roles/:roleCode/effective-permissions
router.get(
  "/users/:userId/roles/:roleCode/effective-permissions",
  authRequired,
  RbacController.getEffectiveUserPermissions,
);

module.exports = router;
