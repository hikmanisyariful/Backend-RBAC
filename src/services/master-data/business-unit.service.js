"use strict";

const { sequelize } = require("../../config/db");

/** =========================
 *  small utils (role-style)
 *  ========================= */
function toInt(v, def) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function toStr(v) {
  return String(v ?? "").trim();
}
function toBoolOrNull(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "on", "yes", "active"].includes(s)) return true;
  if (["false", "0", "off", "no", "inactive"].includes(s)) return false;
  return null;
}

function badReq(message, exception) {
  const e = new Error(message);
  e.isBadRequest = true;
  if (exception) e.exception = exception;
  return e;
}
function notFound(message) {
  const e = new Error(message);
  e.isNotFound = true;
  return e;
}
function conflict(message) {
  const e = new Error(message);
  e.isConflict = true;
  return e;
}

function parseJsonObjectOrEmpty(raw, fieldName) {
  const s = String(raw ?? "").trim();
  if (!s) return {};

  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("must be an object");
    }
    return obj;
  } catch {
    throw badReq(`${fieldName} must be a valid JSON object string`);
  }
}

/** =========================
 *  whitelist filter/sort maps
 *  ========================= */
const FILTER_MAP = {
  code: { col: `"BU_Code"`, type: "text" },
  name: { col: `"BU_Name"`, type: "text" },
  active: { col: `"BU_Active"`, type: "bool" },
};

const ORDER_BY_MAP = {
  code: `"BU_Code"`,
  name: `"BU_Name"`,
  active: `"BU_Active"`,
  createdat: `"BU_CreatedAt"`,
  updatedat: `"BU_UpdatedAt"`,
};

function parseOrderByToSql(orderByRaw) {
  const obj = parseJsonObjectOrEmpty(orderByRaw, "orderBy");
  const entries = Object.entries(obj);

  const pairs = [];
  for (const [keyRaw, dirRaw] of entries) {
    const key = String(keyRaw || "").trim().toLowerCase();
    if (!key) continue;

    const col = ORDER_BY_MAP[key];
    if (!col) continue;

    const dir = String(dirRaw ?? "ASC").toUpperCase().trim();
    const dirNorm = dir === "DESC" ? "DESC" : "ASC";
    pairs.push({ key, dir: dirNorm, col });
  }

  if (!pairs.length) {
    return {
      orderSql: `${ORDER_BY_MAP.createdat} DESC, "BU_Id" ASC`,
      orderByEcho: JSON.stringify({ createdat: "DESC" }),
    };
  }

  const limited = pairs.slice(0, 3);
  const orderSql = `${limited.map((p) => `${p.col} ${p.dir}`).join(", ")}, "BU_Id" ASC`;

  const echoObj = {};
  for (const p of limited) echoObj[p.key] = p.dir;

  return { orderSql, orderByEcho: JSON.stringify(echoObj) };
}

function buildWhereFromFilters(filterColumnRaw, replacements) {
  const filters = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
  const where = [];

  for (const [keyRaw, val] of Object.entries(filters)) {
    const key = String(keyRaw || "").trim().toLowerCase();
    if (!key) continue;

    const spec = FILTER_MAP[key];
    if (!spec) continue;

    if (val == null) continue;
    if (typeof val === "string" && !val.trim()) continue;

    if (spec.type === "text") {
      const param = `f_${key}`;
      where.push(`${spec.col} ILIKE :${param}`);
      replacements[param] = `%${String(val).trim()}%`;
      continue;
    }

    if (spec.type === "bool") {
      const parsed = toBoolOrNull(val);
      if (parsed === null) continue; // invalid => ignore (atau throw badReq kalau mau strict)
      const param = `f_${key}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = parsed;
      continue;
    }
  }

  return where;
}

function buildWhereFromRange(from, to, replacements) {
  const where = [];
  const fromStr = toStr(from);
  const toStrv = toStr(to);

  if (fromStr) {
    where.push(`"BU_CreatedAt" >= :fromDate`);
    replacements.fromDate = new Date(fromStr);
  }
  if (toStrv) {
    where.push(`"BU_CreatedAt" <= :toDate`);
    replacements.toDate = new Date(toStrv);
  }
  return where;
}

function buildPaginationMeta({ page, limit, totalRows, searchTerm, orderByEcho, filterColumnEcho }) {
  const totalPage = limit > 0 ? Math.ceil(totalRows / limit) : 0;

  return {
    page,
    limit,
    totalRecord: totalRows,
    totalPage,
    nextPage: page < totalPage,
    previousPage: page > 1,
    searchTerm: searchTerm || undefined,
    filterColumn: filterColumnEcho,
    orderBy: orderByEcho,
  };
}

function mapBU(row) {
  return {
    Id: String(row.Id),
    Code: row.Code,
    Name: row.Name,
    Active: !!row.Active,
    CreatedAt: row.CreatedAt,
    UpdatedAt: row.UpdatedAt,
    CreatedBy: row.CreatedBy,
    UpdatedBy: row.UpdatedBy,
  };
}

function mapSAP(row) {
  return {
    featureName: row.featureName,
    endpoint: row.endpoint,
  };
}

// alias keys payload biar fleksibel (kayak role service)
function pick(payload, keys) {
  for (const k of keys) {
    if (payload && payload[k] !== undefined) return payload[k];
  }
  return undefined;
}

module.exports = {
  badReq,

  /** =========================
   *  GET LIST /business-units
   *  ========================= */
  async list(query) {
    const page = clamp(toInt(query.page, 1), 1, 1_000_000_000);
    const limit = clamp(toInt(query.limit, 10), 1, 100);
    const offset = (page - 1) * limit;

    const searchTerm = toStr(query.searchTerm);
    const filterColumnRaw = query.filterColumn;
    const orderByRaw = query.orderBy;

    const { orderSql, orderByEcho } = parseOrderByToSql(orderByRaw);

    const where = [];
    const replacements = { offset, limit };

    // global search
    if (searchTerm) {
      where.push(`("BU_Code" ILIKE :q OR "BU_Name" ILIKE :q)`);
      replacements.q = `%${searchTerm}%`;
    }

    // createdAt range
    where.push(...buildWhereFromRange(query.from, query.to, replacements));

    // multi filters
    where.push(...buildWhereFromFilters(filterColumnRaw, replacements));

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj)) norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    // count
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM "business_units"
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    // data
    const dataSql = `
      SELECT
        "BU_Id" AS "Id",
        "BU_Code" AS "Code",
        "BU_Name" AS "Name",
        "BU_Active" AS "Active",
        "BU_CreatedAt" AS "CreatedAt",
        "BU_UpdatedAt" AS "UpdatedAt",
        "BU_CreatedBy" AS "CreatedBy",
        "BU_UpdatedBy" AS "UpdatedBy"
      FROM "business_units"
      ${whereSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [rows] = await sequelize.query(dataSql, { replacements });

    return {
      records: (rows || []).map(mapBU),
      pagination: buildPaginationMeta({
        page,
        limit,
        totalRows,
        searchTerm,
        orderByEcho,
        filterColumnEcho,
      }),
    };
  },

  /** =========================
   *  GET DETAIL /business-units/:id
   *  ========================= */
  async getById(id) {
    const buId = toStr(id);
    if (!buId) throw badReq("businessUnitId is required");

    const sql = `
      SELECT
        "BU_Id" AS "Id",
        "BU_Code" AS "Code",
        "BU_Name" AS "Name",
        "BU_Active" AS "Active",
        "BU_CreatedAt" AS "CreatedAt",
        "BU_UpdatedAt" AS "UpdatedAt",
        "BU_CreatedBy" AS "CreatedBy",
        "BU_UpdatedBy" AS "UpdatedBy"
      FROM "business_units"
      WHERE "BU_Id" = :id
      LIMIT 1
    `;
    const [rows] = await sequelize.query(sql, { replacements: { id: buId } });
    const record = rows?.[0] ? mapBU(rows[0]) : null;
    if (!record) return null;

    const sapSql = `
      SELECT
        "BUSA_FeatureName" AS "featureName",
        "BUSA_Endpoint" AS "endpoint"
      FROM "business_unit_sap_integrations"
      WHERE "BU_Id" = :id
      ORDER BY "BUSA_Id" ASC
    `;
    const [sapRows] = await sequelize.query(sapSql, { replacements: { id: buId } });

    return {
      ...record,
      SAPIntegrations: (sapRows || []).map(mapSAP),
    };
  },

  /** =========================
   *  GET /business-unit/features
   *  ========================= */
  async listFeatures() {
    const sql = `
      SELECT
        "BUF_Id" AS "Id",
        "BUF_Code" AS "Code",
        "BUF_Name" AS "Name"
      FROM "business_unit_features"
      ORDER BY "BUF_Code" ASC
    `;
    const [rows] = await sequelize.query(sql);
    return rows || [];
  },

  /** =========================
   *  POST /business-units
   *  ========================= */
  async create(payload, actor = "system") {
    const code = toStr(pick(payload, ["Code", "code", "BU_Code", "businessUnitCode"]));
    const name = toStr(pick(payload, ["Name", "name", "BU_Name", "businessUnitName"]));
    const activeRaw = pick(payload, ["Active", "active", "BU_Active"]);
    const sapRaw = pick(payload, ["SAPIntegrations", "sapIntegrations"]);

    const activeParsed = activeRaw == null ? true : toBoolOrNull(activeRaw);
    if (activeRaw != null && activeParsed === null) throw badReq("Active must be boolean");

    if (!code) throw badReq("Code is required");
    if (!name) throw badReq("Name is required");

    const sap = Array.isArray(sapRaw) ? sapRaw : [];

    // unique check (Code)
    const checkSql = `
      SELECT "BU_Id","BU_Code"
      FROM "business_units"
      WHERE "BU_Code" = :code
      LIMIT 1
    `;
    const [checkRows] = await sequelize.query(checkSql, { replacements: { code } });
    if (checkRows?.[0]) throw conflict("Business Unit code already exists");

    return await sequelize.transaction(async (t) => {
      const insertSql = `
        INSERT INTO "business_units"
          ("BU_Code","BU_Name","BU_Active","BU_CreatedBy","BU_CreatedAt","BU_UpdatedBy","BU_UpdatedAt")
        VALUES
          (:code,:name,:active,:actor,NOW(),:actor,NOW())
        RETURNING "BU_Id" AS "Id"
      `;
      const [insertRows] = await sequelize.query(insertSql, {
        transaction: t,
        replacements: { code, name, active: activeParsed, actor },
      });

      const buId = insertRows?.[0]?.Id;
      if (!buId) throw new Error("Failed to create Business Unit");

      // insert sap integrations (optional)
      for (const x of sap) {
        const featureName = toStr(x?.featureName ?? x?.FeatureName ?? "");
        const endpoint = toStr(x?.endpoint ?? x?.Endpoint ?? "");
        if (!featureName || !endpoint) continue;

        await sequelize.query(
          `
          INSERT INTO "business_unit_sap_integrations"
            ("BU_Id","BUSA_FeatureName","BUSA_Endpoint","BUSA_CreatedAt","BUSA_UpdatedAt")
          VALUES
            (:id,:featureName,:endpoint,NOW(),NOW())
          `,
          {
            transaction: t,
            replacements: { id: buId, featureName, endpoint },
          }
        );
      }

      return await this.getById(buId);
    });
  },

  /** =========================
   *  PUT /business-units/:id
   *  ========================= */
  async update(id, payload, actor = "system") {
    const buId = toStr(id);
    if (!buId) throw badReq("businessUnitId is required");

    const codeRaw = pick(payload, ["Code", "code", "BU_Code", "businessUnitCode"]);
    const nameRaw = pick(payload, ["Name", "name", "BU_Name", "businessUnitName"]);
    const activeRaw = pick(payload, ["Active", "active", "BU_Active"]);
    const sapRaw = pick(payload, ["SAPIntegrations", "sapIntegrations"]);

    const code = codeRaw === undefined ? undefined : toStr(codeRaw);
    const name = nameRaw === undefined ? undefined : toStr(nameRaw);
    const active = activeRaw === undefined ? undefined : toBoolOrNull(activeRaw);

    const sap = sapRaw === undefined ? undefined : Array.isArray(sapRaw) ? sapRaw : [];

    const hasAny =
      code !== undefined || name !== undefined || active !== undefined || sap !== undefined;

    if (!hasAny) throw badReq("at least one field must be provided");
    if (code !== undefined && !code) throw badReq("Code cannot be empty");
    if (name !== undefined && !name) throw badReq("Name cannot be empty");
    if (activeRaw !== undefined && active === null) throw badReq("Active must be boolean");

    const existing = await this.getById(buId);
    if (!existing) throw notFound("Business Unit not found");

    // unique check code (if change)
    if (code !== undefined && code !== existing.Code) {
      const checkSql = `
        SELECT "BU_Id","BU_Code"
        FROM "business_units"
        WHERE "BU_Code" = :code AND "BU_Id" <> :id
        LIMIT 1
      `;
      const [checkRows] = await sequelize.query(checkSql, {
        replacements: { code, id: buId },
      });
      if (checkRows?.[0]) throw conflict("Business Unit code already exists");
    }

    return await sequelize.transaction(async (t) => {
      const sets = [];
      const replacements = { id: buId, actor };

      if (code !== undefined) {
        sets.push(`"BU_Code" = :code`);
        replacements.code = code;
      }
      if (name !== undefined) {
        sets.push(`"BU_Name" = :name`);
        replacements.name = name;
      }
      if (active !== undefined) {
        sets.push(`"BU_Active" = :active`);
        replacements.active = active;
      }

      sets.push(`"BU_UpdatedBy" = :actor`);
      sets.push(`"BU_UpdatedAt" = NOW()`);

      const updateSql = `
        UPDATE "business_units"
        SET ${sets.join(", ")}
        WHERE "BU_Id" = :id
      `;
      await sequelize.query(updateSql, { transaction: t, replacements });

      // replace SAPIntegrations if provided
      if (sap !== undefined) {
        await sequelize.query(
          `DELETE FROM "business_unit_sap_integrations" WHERE "BU_Id" = :id`,
          { transaction: t, replacements: { id: buId } }
        );

        for (const x of sap) {
          const featureName = toStr(x?.featureName ?? x?.FeatureName ?? "");
          const endpoint = toStr(x?.endpoint ?? x?.Endpoint ?? "");
          if (!featureName || !endpoint) continue;

          await sequelize.query(
            `
            INSERT INTO "business_unit_sap_integrations"
              ("BU_Id","BUSA_FeatureName","BUSA_Endpoint","BUSA_CreatedAt","BUSA_UpdatedAt")
            VALUES
              (:id,:featureName,:endpoint,NOW(),NOW())
            `,
            {
              transaction: t,
              replacements: { id: buId, featureName, endpoint },
            }
          );
        }
      }

      return await this.getById(buId);
    });
  },

  /** =========================
   *  DELETE /business-units/:id
   *  ========================= */
  async remove(id) {
    const buId = toStr(id);
    if (!buId) throw badReq("businessUnitId is required");

    const existing = await this.getById(buId);
    if (!existing) throw notFound("Business Unit not found");

    try {
      await sequelize.query(`DELETE FROM "business_units" WHERE "BU_Id" = :id`, {
        replacements: { id: buId },
      });
      return true;
    } catch (e) {
      // FK violation
      if (e?.original?.code === "23503") {
        throw conflict("Business Unit cannot be deleted because it is still in use");
      }
      throw e;
    }
  },
};