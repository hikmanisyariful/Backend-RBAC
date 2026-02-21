"use strict";

const optService = require("../../services/master-data/vessel.options.service");

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
  // GET /inbound/vessels/sap-code-options
  async sapCodeOptions(req, res) {
    try {
      const record = await optService.getSapCodeOptions();
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

  // GET /warehouses/options
  async warehouseOptions(req, res) {
    try {
      const records = await optService.getWarehouseOptions();
      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
        Data: { Records: records },
      });
    } catch (err) {
      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Records: [] },
      });
    }
  },

  // GET /inbound/vessels/external-mapping-keys
  async externalMappingKeys(req, res) {
    try {
      const records = await optService.getExternalMappingKeys();
      return res.status(200).json({
        Meta: makeMetaSuccess("Success", null, 200),
        Data: { Records: records },
      });
    } catch (err) {
      return res.status(500).json({
        Meta: makeMetaError(500, err?.message || "Internal Server Error"),
        Data: { Records: [] },
      });
    }
  },
};