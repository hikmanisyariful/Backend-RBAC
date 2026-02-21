"use strict";

const { sequelize } = require("../../config/db");

async function getSapCodeOptions() {
  // GROUP + array_agg
  const sql = `
    SELECT
      g."SCG_Code" AS "code",
      COALESCE(
        ARRAY_AGG(i."SCI_SAPCode" ORDER BY i."SCI_Id") FILTER (WHERE i."SCI_SAPCode" IS NOT NULL),
        ARRAY[]::text[]
      ) AS "sapCode"
    FROM "sap_code_option_groups" g
    LEFT JOIN "sap_code_option_items" i
      ON i."SCG_Id" = g."SCG_Id"
    GROUP BY g."SCG_Id", g."SCG_Code"
    ORDER BY g."SCG_Code" ASC
  `;

  const [rows] = await sequelize.query(sql);
  const records = rows || [];

  return {
    TotalForm: records.length,
    Records: records.map((r) => ({
      code: r.code,
      sapCode: Array.isArray(r.sapCode) ? r.sapCode : [],
    })),
  };
}

async function getWarehouseOptions() {
  // format: BRANCHCODE-WAREHOUSECODE-TRANSIT
  // asumsi branches table punya: BR_Code
  const sql = `
    SELECT
      CONCAT(
        b."BR_Code", '-', w."WH_Code", '-',
        CASE WHEN w."WH_IsTransit" = TRUE THEN 'TRANSIT' ELSE 'NONTRANSIT' END
      ) AS "value"
    FROM "warehouses" w
    JOIN "branches" b ON b."BR_Id" = w."BR_Id"
    ORDER BY b."BR_Code" ASC, w."WH_Code" ASC
  `;
  const [rows] = await sequelize.query(sql);
  return (rows || []).map((x) => x.value);
}

async function getExternalMappingKeys() {
  const sql = `
    SELECT "EMK_Key" AS "key"
    FROM "external_mapping_keys"
    ORDER BY "EMK_Key" ASC
  `;
  const [rows] = await sequelize.query(sql);
  return (rows || []).map((x) => x.key);
}

module.exports = {
  getSapCodeOptions,
  getWarehouseOptions,
  getExternalMappingKeys,
};