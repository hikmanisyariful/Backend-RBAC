"use strict";

const menuService = require("../services/menu.service");

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

module.exports = {
  /** GET /menus */
  async list(req, res) {
    try {
      const { records, pagination } = await menuService.listMenus(req.query);

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", pagination, 200),
        Data: { Records: records },
      });
    } catch (err) {
      if (err?.isBadRequest) {
        return res.status(400).json({
          Meta: makeMetaError(400, err.message, err?.exception),
          Data: { Records: [] },
        });
      }

      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Records: [] },
      });
    }
  },

  /** GET /menus/:id */
  async detail(req, res) {
    try {
      const id = req.params.id;
      const record = await menuService.getMenuById(id);

      return res.status(200).json({
        Meta: makeMetaSuccess(record ? "Success" : "Not found", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      if (err?.isBadRequest) {
        return res.status(400).json({
          Meta: makeMetaError(400, err.message, err?.exception),
          Data: { Record: null },
        });
      }

      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Record: null },
      });
    }
  },

  /** POST /menus */
  async create(req, res) {
    try {
      // contoh: ambil user dari auth middleware (sesuaikan)
      const actor = req.user?.username || req.user?.name || "system";

      const record = await menuService.createMenu(req.body, actor);

      return res.status(201).json({
        Meta: makeMetaSuccess("Created", null, 201),
        Data: { Record: record },
      });
    } catch (err) {
      if (err?.isBadRequest) {
        return res.status(400).json({
          Meta: makeMetaError(400, err.message, err?.exception),
          Data: { Record: null },
        });
      }

      if (err?.isConflict) {
        return res.status(409).json({
          Meta: makeMetaError(409, err.message),
          Data: { Record: null },
        });
      }

      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Record: null },
      });
    }
  },

  /** PUT /menus/:id */
  async update(req, res) {
    try {
      const id = req.params.id;
      const actor = req.user?.username || req.user?.name || "system";

      const record = await menuService.updateMenu(id, req.body, actor);

      return res.status(200).json({
        Meta: makeMetaSuccess("Updated", null, 200),
        Data: { Record: record },
      });
    } catch (err) {
      if (err?.isBadRequest) {
        return res.status(400).json({
          Meta: makeMetaError(400, err.message, err?.exception),
          Data: { Record: null },
        });
      }

      if (err?.isNotFound) {
        return res.status(404).json({
          Meta: makeMetaError(404, err.message),
          Data: { Record: null },
        });
      }

      if (err?.isConflict) {
        return res.status(409).json({
          Meta: makeMetaError(409, err.message),
          Data: { Record: null },
        });
      }

      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Record: null },
      });
    }
  },

  /** DELETE /menus/:id */
  async remove(req, res) {
    try {
      const id = req.params.id;
      await menuService.deleteMenu(id);

      return res.status(200).json({
        Meta: makeMetaSuccess("Deleted", null, 200),
        Data: { Record: null },
      });
    } catch (err) {
      if (err?.isBadRequest) {
        return res.status(400).json({
          Meta: makeMetaError(400, err.message, err?.exception),
          Data: { Record: null },
        });
      }

      if (err?.isNotFound) {
        return res.status(404).json({
          Meta: makeMetaError(404, err.message),
          Data: { Record: null },
        });
      }

      if (err?.isConflict) {
        return res.status(409).json({
          Meta: makeMetaError(409, err.message),
          Data: { Record: null },
        });
      }

      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Record: null },
      });
    }
  },
};