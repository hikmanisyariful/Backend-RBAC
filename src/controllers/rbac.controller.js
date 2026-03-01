"use strict";

const rbacService = require("../services/rbac.service");

function makeMetaSuccess(message, pagination, code = 200) {
  return {
    CorrelationId: null,
    Message: message,
    Code: code,
    Status: true,
    Pagination: pagination ?? null,
    ExceptionMessage: null,
  };
}

function makeMetaError(code, message, exception) {
  return {
    CorrelationId: null,
    Message: message,
    Code: code,
    Status: false,
    Pagination: null,
    ExceptionMessage: exception ?? null,
  };
}

function handleError(res, err, fallbackData) {
  if (err?.isBadRequest) {
    return res.status(400).json({
      Meta: makeMetaError(400, err.message, err?.exception || err?.details || null),
      Data: fallbackData,
    });
  }

  if (err?.isNotFound) {
    return res.status(404).json({
      Meta: makeMetaError(404, err.message, err?.exception || null),
      Data: fallbackData,
    });
  }

  if (err?.isConflict) {
    return res.status(409).json({
      Meta: makeMetaError(409, err.message, err?.exception || null),
      Data: fallbackData,
    });
  }

  return res.status(500).json({
    Meta: makeMetaError(500, err?.message || "Internal Server Error"),
    Data: fallbackData,
  });
}

module.exports = {
  /** GET /rbac/roles/:roleCode/tree */
  async getRoleTree(req, res) {
    try {
      const { roleId } = req.params;
      const record = await rbacService.getRoleTree(roleId);

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** PUT /rbac/roles/:roleId/permissions */
  async updateRolePermissions(req, res) {
    try {
      const payload = {
        roleId: req.params.roleId,
        granted: req.body?.granted,
      };

      const record = await rbacService.saveRolePermissions(payload);

      return res.status(200).json({
        Meta: makeMetaSuccess("Updated", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** GET /rbac/users/:userId/roles/:roleCode/tree */
  async getUserOverrideTree(req, res) {
    try {
      const { userId, roleId } = req.params;
      const record = await rbacService.getUserOverrideTree(userId, roleId);

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** PUT /rbac/users/:userId/roles/:roleCode/permission-overrides */
  async updateUserPermissionOverride(req, res) {
    try {
      const payload = {
        userId: req.params.userId,
        roleId: req.params.roleId,
        userExtra: req.body?.userExtra,
      };

      const record = await rbacService.saveUserPermissionOverride(payload);

      return res.status(200).json({
        Meta: makeMetaSuccess("Updated", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** GET /rbac/users/:userId/roles/:roleCode/effective-permissions */
  async getEffectiveUserPermissions(req, res) {
    try {
      const { userId, roleCode } = req.params;
      const record = await rbacService.getEffectiveUserPermissions(
        userId,
        roleCode,
      );

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },
};