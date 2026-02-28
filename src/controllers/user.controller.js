"use strict";

const userService = require("../services/user.service");

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

// optional helper biar konsisten
function handleError(res, err, emptyData) {
  if (err?.isBadRequest) {
    return res.status(400).json({
      Meta: makeMetaError(400, err.message, err?.exception),
      Data: emptyData,
    });
  }
  if (err?.isNotFound) {
    return res.status(404).json({
      Meta: makeMetaError(404, err.message, err?.exception),
      Data: emptyData,
    });
  }
  if (err?.isConflict) {
    return res.status(409).json({
      Meta: makeMetaError(409, err.message, err?.exception),
      Data: emptyData,
    });
  }
  return res.status(500).json({
    Meta: makeMetaError(500, err?.message || "Internal Server Error"),
    Data: emptyData,
  });
}

module.exports = {
  /** GET /users */
  async list(req, res) {
    try {
      const { records, pagination } = await userService.listUsers(req.query);

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", pagination, 200),
        Data: { Records: records },
      });
    } catch (err) {
      return handleError(res, err, { Records: [] });
    }
  },

  /** GET /users/:id */
  async detail(req, res) {
    try {
      const id = req.params.id;
      const record = await userService.getUserById(id);

      return res.status(200).json({
        Meta: makeMetaSuccess(record ? "Success" : "Not found", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** POST /users */
  async create(req, res) {
    try {
      // sesuaikan kalau kamu punya middleware auth
      const actorUserId = req.user?.id ?? req.user?.Id ?? req.userId ?? null;

      const record = await userService.createUser(req.body, actorUserId);

      return res.status(201).json({
        Meta: makeMetaSuccess("Created", null, 201),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** PUT/PATCH /users/:id */
  async update(req, res) {
    try {
      const id = req.params.id;
      const actorUserId = req.user?.id ?? req.user?.Id ?? req.userId ?? null;

      const record = await userService.updateUser(id, req.body, actorUserId);

      return res.status(200).json({
        Meta: makeMetaSuccess("Updated", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return handleError(res, err, { Record: null });
    }
  },

  /** DELETE /users/:id */
  async remove(req, res) {
    try {
      const id = req.params.id;

      await userService.deleteUser(id);

      return res.status(200).json({
        Meta: makeMetaSuccess("Deleted", null, 200),
        Data: { Success: true },
      });
    } catch (err) {
      return handleError(res, err, { Success: false });
    }
  },

  async summary(req, res) {
    try {
      const record = await userService.getUserSummary();

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Record: null },
      });
    }
  },
};