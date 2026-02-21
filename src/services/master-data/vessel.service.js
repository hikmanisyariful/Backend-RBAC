"use strict";

const { sequelize } = require("../../config/db");

/** =========================
 * utils (role-style)
 * ========================= */
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
function toNumOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

function pick(payload, keys) {
  for (const k of keys) {
    if (payload && payload[k] !== undefined) return payload[k];
  }
  return undefined;
}

/** =========================
 * whitelist filter/sort (match migration)
 * ========================= */
const FILTER_MAP = {
  imo: { col: `v."VS_Imo"`, type: "text" },
  name: { col: `v."VS_Name"`, type: "text" },
  type: { col: `v."VS_Type"`, type: "text" },
  category: { col: `v."VS_Category"`, type: "text" },
  active: { col: `v."VS_Active"`, type: "bool" },
};

const ORDER_BY_MAP = {
  imo: `v."VS_Imo"`,
  name: `v."VS_Name"`,
  type: `v."VS_Type"`,
  category: `v."VS_Category"`,
  active: `v."VS_Active"`,
  createdat: `v."VS_CreatedAt"`,
  updatedat: `v."VS_UpdatedAt"`,
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
      orderSql: `${ORDER_BY_MAP.createdat} DESC, v."VS_Id" ASC`,
      orderByEcho: JSON.stringify({ createdat: "DESC" }),
    };
  }

  const limited = pairs.slice(0, 4);
  const orderSql = `${limited.map((p) => `${p.col} ${p.dir}`).join(", ")}, v."VS_Id" ASC`;

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
      if (parsed === null) continue;
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
    where.push(`v."VS_CreatedAt" >= :fromDate`);
    replacements.fromDate = new Date(fromStr);
  }
  if (toStrv) {
    where.push(`v."VS_CreatedAt" <= :toDate`);
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

/** =========================
 * mappers (match FE types)
 * ========================= */
function mapVesselRow(r) {
  return {
    Id: String(r.Id),
    Imo: r.Imo,
    Name: r.Name,
    Type: r.Type,
    Category: r.Category,
    Weight: r.Weight == null ? null : Number(r.Weight),
    MaxCapacity: r.MaxCapacity == null ? null : Number(r.MaxCapacity),
    Active: !!r.Active,
    CreatedAt: r.CreatedAt,
    UpdatedAt: r.UpdatedAt,
    CreatedBy: r.CreatedBy,
    UpdatedBy: r.UpdatedBy,
  };
}

async function getSapMappings(vsId, t = null) {
  const sql = `
    SELECT
      m."VSM_BusinessUnitCode" AS "BusinessUnitCode",
      m."VSM_BusinessUnitName" AS "BusinessUnitName",
      m."VSM_SAPCode" AS "SAPCode"
    FROM "vessel_sap_code_mappings" m
    WHERE m."VS_Id" = :id
    ORDER BY m."VSM_Id" ASC
  `;
  const [rows] = await sequelize.query(sql, {
    replacements: { id: Number(vsId) },
    ...(t ? { transaction: t } : {}),
  });

  return (rows || []).map((x) => ({
    BusinessUnitCode: x.BusinessUnitCode,
    BusinessUnitName: x.BusinessUnitName,
    SAPCode: x.SAPCode,
  }));
}

async function getExternalMappings(vsId, t = null) {
  const sql = `
    SELECT
      "VEM_ExternalSystemCode" AS "ExternalSystemCode",
      "VEM_ExternalName" AS "ExternalName",
      "VEM_ExternalCode" AS "ExternalCode",
      "VEM_WarehouseCode" AS "WarehouseCode",
      "VEM_WarehouseName" AS "WarehouseName"
    FROM "vessel_external_code_mappings"
    WHERE "VS_Id" = :id
    ORDER BY "VEM_Id" ASC
  `;
  const [rows] = await sequelize.query(sql, {
    replacements: { id: Number(vsId) },
    ...(t ? { transaction: t } : {}),
  });

  return (rows || []).map((x) => ({
    ExternalSystemCode: x.ExternalSystemCode,
    ExternalName: x.ExternalName,
    ExternalCode: x.ExternalCode,
    WarehouseCode: x.WarehouseCode,
    WarehouseName: x.WarehouseName,
  }));
}

module.exports = {
  badReq,

  /** =========================
   * GET LIST /inbound/vessels
   * ========================= */
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

    if (searchTerm) {
      where.push(`(
        v."VS_Imo" ILIKE :q OR
        v."VS_Name" ILIKE :q OR
        v."VS_Type" ILIKE :q OR
        v."VS_Category" ILIKE :q
      )`);
      replacements.q = `%${searchTerm}%`;
    }

    where.push(...buildWhereFromRange(query.from, query.to, replacements));
    where.push(...buildWhereFromFilters(filterColumnRaw, replacements));

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj)) norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM "vessels" v
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    const dataSql = `
      SELECT
        v."VS_Id" AS "Id",
        v."VS_Imo" AS "Imo",
        v."VS_Name" AS "Name",
        v."VS_Type" AS "Type",
        v."VS_Category" AS "Category",
        v."VS_Weight" AS "Weight",
        v."VS_MaxCapacity" AS "MaxCapacity",
        v."VS_Active" AS "Active",
        v."VS_CreatedAt" AS "CreatedAt",
        v."VS_UpdatedAt" AS "UpdatedAt",
        v."VS_CreatedBy" AS "CreatedBy",
        v."VS_UpdatedBy" AS "UpdatedBy"
      FROM "vessels" v
      ${whereSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [rows] = await sequelize.query(dataSql, { replacements });

    return {
      records: (rows || []).map(mapVesselRow),
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
   * GET DETAIL /inbound/vessels/:id
   * ========================= */
  async getById(id, t = null) {
    const vsId = toStr(id);
    if (!vsId) throw badReq("vesselId is required");

    const sql = `
      SELECT
        v."VS_Id" AS "Id",
        v."VS_Imo" AS "Imo",
        v."VS_Name" AS "Name",
        v."VS_Type" AS "Type",
        v."VS_Category" AS "Category",
        v."VS_Weight" AS "Weight",
        v."VS_MaxCapacity" AS "MaxCapacity",
        v."VS_Active" AS "Active",
        v."VS_CreatedAt" AS "CreatedAt",
        v."VS_UpdatedAt" AS "UpdatedAt",
        v."VS_CreatedBy" AS "CreatedBy",
        v."VS_UpdatedBy" AS "UpdatedBy"
      FROM "vessels" v
      WHERE v."VS_Id" = :id
      LIMIT 1
    `;
    const [rows] = await sequelize.query(sql, {
      replacements: { id: vsId },
      ...(t ? { transaction: t } : {}),
    });

    const base = rows?.[0];
    if (!base) return null;

    const record = mapVesselRow(base);
    record.SapCodeMappings = await getSapMappings(vsId, t);
    record.ExternalCodeMappings = await getExternalMappings(vsId, t);

    return record;
  },

  /** =========================
   * POST /inbound/vessels
   * ========================= */
  async create(payload, actor = "system") {
    const imo = toStr(pick(payload, ["VesselImo", "Imo", "imo"]));
    const name = toStr(pick(payload, ["VesselName", "Name", "name"]));
    const type = toStr(pick(payload, ["VesselType", "Type", "type"]));
    const category = toStr(pick(payload, ["VesselCategory", "Category", "category"]));

    const weightRaw = pick(payload, ["VesselWeight", "Weight", "weight"]);
    const maxCapRaw = pick(payload, ["VesselMaxCapacity", "MaxCapacity", "maxCapacity"]);
    const activeRaw = pick(payload, ["VesselActive", "Active", "active"]);

    const weight = weightRaw == null ? null : toNumOrNull(weightRaw);
    if (weightRaw != null && weight === null) throw badReq("VesselWeight must be number");

    const maxCapacity = maxCapRaw == null ? null : toNumOrNull(maxCapRaw);
    if (maxCapRaw != null && maxCapacity === null) throw badReq("VesselMaxCapacity must be number");

    const activeParsed = activeRaw == null ? true : toBoolOrNull(activeRaw);
    if (activeRaw != null && activeParsed === null) throw badReq("VesselActive must be boolean");

    // required per migration
    if (!imo) throw badReq("VesselImo is required");
    if (!name) throw badReq("VesselName is required");
    if (!type) throw badReq("VesselType is required");
    if (!category) throw badReq("VesselCategory is required");

    const sapMappings = Array.isArray(payload?.SapCodeMappings) ? payload.SapCodeMappings : [];
    const extMappings = Array.isArray(payload?.ExternalCodeMappings) ? payload.ExternalCodeMappings : [];

    return await sequelize.transaction(async (t) => {
      // unique IMO
      const [dup] = await sequelize.query(
        `SELECT 1 FROM "vessels" WHERE "VS_Imo" = :imo LIMIT 1`,
        { transaction: t, replacements: { imo } }
      );
      if (dup?.[0]) throw conflict("Vessel IMO already exists");

      const insertSql = `
        INSERT INTO "vessels"
          ("VS_Imo","VS_Name","VS_Type","VS_Category","VS_Weight","VS_MaxCapacity","VS_Active",
           "VS_CreatedBy","VS_CreatedAt","VS_UpdatedBy","VS_UpdatedAt")
        VALUES
          (:imo,:name,:type,:category,:weight,:maxCapacity,:active,:actor,NOW(),:actor,NOW())
        RETURNING "VS_Id" AS "Id"
      `;
      const [insRows] = await sequelize.query(insertSql, {
        transaction: t,
        replacements: { imo, name, type, category, weight, maxCapacity, active: activeParsed, actor },
      });
      const vsId = insRows?.[0]?.Id;
      if (!vsId) throw new Error("Failed to create vessel");

      // SAP mappings (stored as-is in your table)
      for (const m of sapMappings) {
        const buCode = toStr(m?.BusinessUnitCode);
        const buName = toStr(m?.BusinessUnitName);
        const sapCode = toStr(m?.SAPCode);
        if (!buCode || !buName || !sapCode) continue;

        await sequelize.query(
          `
            INSERT INTO "vessel_sap_code_mappings"
              ("VS_Id","VSM_BusinessUnitCode","VSM_BusinessUnitName","VSM_SAPCode","VSM_CreatedAt","VSM_UpdatedAt")
            VALUES
              (:vsId,:buCode,:buName,:sapCode,NOW(),NOW())
          `,
          { transaction: t, replacements: { vsId, buCode, buName, sapCode } }
        );
      }

      // External mappings
      for (const m of extMappings) {
        const externalSystemCode = toStr(m?.ExternalSystemCode);
        const externalName = toStr(m?.ExternalName);
        const externalCode = toStr(m?.ExternalCode);
        const warehouseCode = toStr(m?.WarehouseCode);
        const warehouseName = toStr(m?.WarehouseName);

        if (!externalSystemCode || !externalName || !externalCode || !warehouseCode || !warehouseName) continue;

        await sequelize.query(
          `
            INSERT INTO "vessel_external_code_mappings"
              ("VS_Id","VEM_ExternalSystemCode","VEM_ExternalName","VEM_ExternalCode","VEM_WarehouseCode","VEM_WarehouseName","VEM_CreatedAt","VEM_UpdatedAt")
            VALUES
              (:vsId,:externalSystemCode,:externalName,:externalCode,:warehouseCode,:warehouseName,NOW(),NOW())
          `,
          {
            transaction: t,
            replacements: { vsId, externalSystemCode, externalName, externalCode, warehouseCode, warehouseName },
          }
        );
      }

      return await this.getById(vsId, t);
    });
  },

  /** =========================
   * PUT /inbound/vessels/:id
   * ========================= */
  async update(id, payload, actor = "system") {
    const vsId = toStr(id);
    if (!vsId) throw badReq("vesselId is required");

    const existing = await this.getById(vsId);
    if (!existing) throw notFound("Vessel not found");

    const imoRaw = pick(payload, ["VesselImo", "Imo", "imo"]);
    const nameRaw = pick(payload, ["VesselName", "Name", "name"]);
    const typeRaw = pick(payload, ["VesselType", "Type", "type"]);
    const catRaw = pick(payload, ["VesselCategory", "Category", "category"]);
    const weightRaw = pick(payload, ["VesselWeight", "Weight", "weight"]);
    const maxCapRaw = pick(payload, ["VesselMaxCapacity", "MaxCapacity", "maxCapacity"]);
    const activeRaw = pick(payload, ["VesselActive", "Active", "active"]);

    const imo = imoRaw === undefined ? undefined : toStr(imoRaw);
    const name = nameRaw === undefined ? undefined : toStr(nameRaw);
    const type = typeRaw === undefined ? undefined : toStr(typeRaw);
    const category = catRaw === undefined ? undefined : toStr(catRaw);

    const weight = weightRaw === undefined ? undefined : weightRaw == null ? null : toNumOrNull(weightRaw);
    if (weightRaw !== undefined && weightRaw != null && weight === null) throw badReq("VesselWeight must be number");

    const maxCapacity = maxCapRaw === undefined ? undefined : maxCapRaw == null ? null : toNumOrNull(maxCapRaw);
    if (maxCapRaw !== undefined && maxCapRaw != null && maxCapacity === null) throw badReq("VesselMaxCapacity must be number");

    const active = activeRaw === undefined ? undefined : toBoolOrNull(activeRaw);
    if (activeRaw !== undefined && active === null) throw badReq("VesselActive must be boolean");

    // mappings: replace only if field exists in payload
    const sapMappings =
      payload?.SapCodeMappings === undefined ? undefined : Array.isArray(payload.SapCodeMappings) ? payload.SapCodeMappings : [];
    const extMappings =
      payload?.ExternalCodeMappings === undefined
        ? undefined
        : Array.isArray(payload.ExternalCodeMappings)
          ? payload.ExternalCodeMappings
          : [];

    const hasAny =
      imo !== undefined ||
      name !== undefined ||
      type !== undefined ||
      category !== undefined ||
      weight !== undefined ||
      maxCapacity !== undefined ||
      active !== undefined ||
      sapMappings !== undefined ||
      extMappings !== undefined;

    if (!hasAny) throw badReq("at least one field must be provided");

    if (imo !== undefined && !imo) throw badReq("VesselImo cannot be empty");
    if (name !== undefined && !name) throw badReq("VesselName cannot be empty");
    if (type !== undefined && !type) throw badReq("VesselType cannot be empty");
    if (category !== undefined && !category) throw badReq("VesselCategory cannot be empty");

    return await sequelize.transaction(async (t) => {
      // unique IMO if changed
      if (imo !== undefined && imo !== existing.Imo) {
        const [dup] = await sequelize.query(
          `SELECT 1 FROM "vessels" WHERE "VS_Imo" = :imo AND "VS_Id" <> :id LIMIT 1`,
          { transaction: t, replacements: { imo, id: vsId } }
        );
        if (dup?.[0]) throw conflict("Vessel IMO already exists");
      }

      const sets = [];
      const replacements = { id: vsId, actor };

      if (imo !== undefined) { sets.push(`"VS_Imo" = :imo`); replacements.imo = imo; }
      if (name !== undefined) { sets.push(`"VS_Name" = :name`); replacements.name = name; }
      if (type !== undefined) { sets.push(`"VS_Type" = :type`); replacements.type = type; }
      if (category !== undefined) { sets.push(`"VS_Category" = :category`); replacements.category = category; }
      if (weight !== undefined) { sets.push(`"VS_Weight" = :weight`); replacements.weight = weight; }
      if (maxCapacity !== undefined) { sets.push(`"VS_MaxCapacity" = :maxCapacity`); replacements.maxCapacity = maxCapacity; }
      if (active !== undefined) { sets.push(`"VS_Active" = :active`); replacements.active = active; }

      sets.push(`"VS_UpdatedBy" = :actor`);
      sets.push(`"VS_UpdatedAt" = NOW()`);

      const updateSql = `
        UPDATE "vessels"
        SET ${sets.join(", ")}
        WHERE "VS_Id" = :id
        RETURNING "VS_Id" AS "Id"
      `;
      const [updRows] = await sequelize.query(updateSql, { transaction: t, replacements });
      if (!updRows?.[0]?.Id) throw notFound("Vessel not found");

      // replace SAP mappings
      if (sapMappings !== undefined) {
        await sequelize.query(`DELETE FROM "vessel_sap_code_mappings" WHERE "VS_Id" = :id`, {
          transaction: t,
          replacements: { id: Number(vsId) },
        });

        for (const m of sapMappings) {
          const buCode = toStr(m?.BusinessUnitCode);
          const buName = toStr(m?.BusinessUnitName);
          const sapCode = toStr(m?.SAPCode);
          if (!buCode || !buName || !sapCode) continue;

          await sequelize.query(
            `
              INSERT INTO "vessel_sap_code_mappings"
                ("VS_Id","VSM_BusinessUnitCode","VSM_BusinessUnitName","VSM_SAPCode","VSM_CreatedAt","VSM_UpdatedAt")
              VALUES
                (:vsId,:buCode,:buName,:sapCode,NOW(),NOW())
            `,
            { transaction: t, replacements: { vsId: Number(vsId), buCode, buName, sapCode } }
          );
        }
      }

      // replace External mappings
      if (extMappings !== undefined) {
        await sequelize.query(`DELETE FROM "vessel_external_code_mappings" WHERE "VS_Id" = :id`, {
          transaction: t,
          replacements: { id: Number(vsId) },
        });

        for (const m of extMappings) {
          const externalSystemCode = toStr(m?.ExternalSystemCode);
          const externalName = toStr(m?.ExternalName);
          const externalCode = toStr(m?.ExternalCode);
          const warehouseCode = toStr(m?.WarehouseCode);
          const warehouseName = toStr(m?.WarehouseName);

          if (!externalSystemCode || !externalName || !externalCode || !warehouseCode || !warehouseName) continue;

          await sequelize.query(
            `
              INSERT INTO "vessel_external_code_mappings"
                ("VS_Id","VEM_ExternalSystemCode","VEM_ExternalName","VEM_ExternalCode","VEM_WarehouseCode","VEM_WarehouseName","VEM_CreatedAt","VEM_UpdatedAt")
              VALUES
                (:vsId,:externalSystemCode,:externalName,:externalCode,:warehouseCode,:warehouseName,NOW(),NOW())
            `,
            {
              transaction: t,
              replacements: { vsId: Number(vsId), externalSystemCode, externalName, externalCode, warehouseCode, warehouseName },
            }
          );
        }
      }

      return await this.getById(vsId, t);
    });
  },

  /** =========================
   * DELETE /inbound/vessels/:id
   * ========================= */
  async remove(id) {
    const vsId = toStr(id);
    if (!vsId) throw badReq("vesselId is required");

    const existing = await this.getById(vsId);
    if (!existing) throw notFound("Vessel not found");

    try {
      await sequelize.query(`DELETE FROM "vessels" WHERE "VS_Id" = :id`, {
        replacements: { id: vsId },
      });
      return true;
    } catch (e) {
      if (e?.original?.code === "23503") throw conflict("Vessel cannot be deleted because it is still in use");
      throw e;
    }
  },
};