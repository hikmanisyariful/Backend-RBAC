"use strict";

const warehouseService = require("../../services/master-data/warehouse.service");

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
  /** GET /warehouses */
  async list(req, res) {
    try {
      const { records, pagination } = await warehouseService.list(req.query);

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
};