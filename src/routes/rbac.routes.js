"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware"); // sesuaikan
const RbacController = require("../controllers/rbac.controller");

/* =========================
 * Role RBAC Tree
 * ========================= */

// GET /rbac/roles/:roleCode/tree
router.get(
  "/Role/:roleId/Permission/Tree",
  authRequired,
  RbacController.getRoleTree,
);

// PUT /rbac/roles/:roleId/permissions
router.put(
  "/Role/:roleId/Permission",
  authRequired,
  RbacController.updateRolePermissions,
);

/* =========================
 * User Override (EXTRA_ONLY)
 * ========================= */

// GET /rbac/users/:userId/roles/:roleId/tree
router.get(
  "/User/:userId/Role/:roleId/Permission/Tree",
  authRequired,
  RbacController.getUserOverrideTree,
);

// PUT /rbac/users/:userId/roles/:roleId/permission-overrides
router.put(
  "/User/:userId/Role/:roleId/Permission/Overide",
  authRequired,
  RbacController.updateUserPermissionOverride,
);

// GET /rbac/users/:userId/roles/:roleCode/effective-permissions
router.get(
  "/User/:userId/Role/:roleId/Permission/Effective",
  authRequired,
  RbacController.getEffectiveUserPermissions,
);

module.exports = router;
