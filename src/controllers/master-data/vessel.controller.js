"use strict";

const vesselService = require("../../services/master-data/vessel.service");

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
  /** GET /inbound/vessels */
  async list(req, res) {
    try {
      const { records, pagination } = await vesselService.list(req.query);

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

  /** GET /inbound/vessels/:id */
  async detail(req, res) {
    try {
      const record = await vesselService.getById(req.params.id);

      if (!record) {
        return res.status(404).json({
          Meta: makeMetaError(404, "Not found"),
          Data: { Record: null },
        });
      }

      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
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
      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Record: null },
      });
    }
  },

  /** POST /inbound/vessels */
  async create(req, res) {
    try {
      const actor = req?.auth?.userId ? String(req.auth.userId) : "system";
      const record = await vesselService.create(req.body, actor);

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

  /** PUT /inbound/vessels/:id */
  async update(req, res) {
    try {
      const actor = req?.auth?.userId ? String(req.auth.userId) : "system";
      const record = await vesselService.update(req.params.id, req.body, actor);

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

  /** DELETE /inbound/vessels/:id */
  async remove(req, res) {
    try {
      await vesselService.remove(req.params.id);

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