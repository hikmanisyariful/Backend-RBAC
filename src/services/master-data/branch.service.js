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

/** =========================
 * whitelist filter/sort maps
 * ========================= */
// NOTE: list grouped by BU, jadi kita dukung filter BU dan branch
const FILTER_MAP = {
  // branch
  code: { col: `b."BR_Code"`, type: "text" },
  name: { col: `b."BR_Name"`, type: "text" },
  active: { col: `b."BR_Active"`, type: "bool" },
  docprefix: { col: `b."BR_DocPrefix"`, type: "text" },
  iderp: { col: `b."BR_IdERP"`, type: "number" },

  // business unit
  businessunitcode: { col: `bu."BU_Code"`, type: "text" },
  businessunitname: { col: `bu."BU_Name"`, type: "text" },
};

const ORDER_BY_MAP = {
  // group context
  businessunitname: `bu."BU_Name"`,
  businessunitcode: `bu."BU_Code"`,

  // branch
  code: `b."BR_Code"`,
  name: `b."BR_Name"`,
  active: `b."BR_Active"`,
  createdat: `b."BR_CreatedAt"`,
  updatedat: `b."BR_UpdatedAt"`,
};

function parseOrderByToSql(orderByRaw) {
  const obj = parseJsonObjectOrEmpty(orderByRaw, "orderBy");
  const entries = Object.entries(obj);

  const pairs = [];
  for (const [keyRaw, dirRaw] of entries) {
    const key = String(keyRaw || "")
      .trim()
      .toLowerCase();
    if (!key) continue;

    const col = ORDER_BY_MAP[key];
    if (!col) continue;

    const dir = String(dirRaw ?? "ASC")
      .toUpperCase()
      .trim();
    const dirNorm = dir === "DESC" ? "DESC" : "ASC";
    pairs.push({ key, dir: dirNorm, col });
  }

  if (!pairs.length) {
    return {
      orderSql: `bu."BU_Name" ASC, b."BR_Code" ASC, b."BR_Id" ASC`,
      orderByEcho: JSON.stringify({ businessunitname: "ASC", code: "ASC" }),
    };
  }

  const limited = pairs.slice(0, 4);
  const orderSql = `${limited.map((p) => `${p.col} ${p.dir}`).join(", ")}, b."BR_Id" ASC`;

  const echoObj = {};
  for (const p of limited) echoObj[p.key] = p.dir;

  return { orderSql, orderByEcho: JSON.stringify(echoObj) };
}

function buildWhereFromFilters(filterColumnRaw, replacements) {
  const filters = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
  const where = [];

  for (const [keyRaw, val] of Object.entries(filters)) {
    const key = String(keyRaw || "")
      .trim()
      .toLowerCase();
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

    if (spec.type === "number") {
      const parsed = toNumOrNull(val);
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
    where.push(`b."BR_CreatedAt" >= :fromDate`);
    replacements.fromDate = new Date(fromStr);
  }
  if (toStrv) {
    where.push(`b."BR_CreatedAt" <= :toDate`);
    replacements.toDate = new Date(toStrv);
  }
  return where;
}

function buildPaginationMeta({
  page,
  limit,
  totalRows,
  searchTerm,
  orderByEcho,
  filterColumnEcho,
}) {
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

function mapBranchRow(r) {
  return {
    Id: String(r.Id),
    Code: r.Code,
    Name: r.Name,
    Active: !!r.Active,
    CreatedAt: r.CreatedAt,
    UpdatedAt: r.UpdatedAt,
    CreatedBy: r.CreatedBy,
    UpdatedBy: r.UpdatedBy,

    // extra fields (aman kalau FE ignore)
    BusinessUnitId: String(r.BusinessUnitId),
    BusinessUnitName: r.BusinessUnitName,
    BusinessUnitCode: r.BusinessUnitCode,
    IdERP: r.IdERP,
    DocPrefix: r.DocPrefix,
  };
}

// group by BusinessUnit
function groupByBusinessUnit(rows) {
  const m = new Map();
  for (const r of rows) {
    const buId = String(r.BusinessUnitId);
    if (!m.has(buId)) {
      m.set(buId, {
        BusinessUnitId: buId,
        BusinessUnitName: r.BusinessUnitName,
        Branches: [],
      });
    }
    m.get(buId).Branches.push({
      Id: r.Id,
      Code: r.Code,
      Name: r.Name,
      Active: r.Active,
      CreatedAt: r.CreatedAt,
      UpdatedAt: r.UpdatedAt,
      CreatedBy: r.CreatedBy,
      UpdatedBy: r.UpdatedBy,
    });
  }
  return Array.from(m.values());
}

// payload pick (alias-friendly)
function pick(payload, keys) {
  for (const k of keys) {
    if (payload && payload[k] !== undefined) return payload[k];
  }
  return undefined;
}

async function resolveBusinessUnitIdByCodeOrName(payload, t) {
  const buCodeRaw = pick(payload, [
    "BusinessUnitCode",
    "businessUnitCode",
    "BU_Code",
  ]);
  const buNameRaw = pick(payload, [
    "BusinessUnitName",
    "businessUnitName",
    "BU_Name",
  ]);
  const buIdRaw = pick(payload, ["BusinessUnitId", "businessUnitId", "BU_Id"]);

  const buId = toStr(buIdRaw);
  const buCode = toStr(buCodeRaw);
  const buName = toStr(buNameRaw);

  if (buId) {
    const [rows] = await sequelize.query(
      `SELECT "BU_Id" AS "Id" FROM "business_units" WHERE "BU_Id" = :id LIMIT 1`,
      { transaction: t, replacements: { id: buId } },
    );
    if (!rows?.[0]) throw badReq("BusinessUnitId not found");
    return Number(rows[0].Id);
  }

  if (buCode) {
    const [rows] = await sequelize.query(
      `SELECT "BU_Id" AS "Id" FROM "business_units" WHERE "BU_Code" = :code LIMIT 1`,
      { transaction: t, replacements: { code: buCode } },
    );
    if (!rows?.[0]) throw badReq("BusinessUnitCode not found");
    return Number(rows[0].Id);
  }

  if (buName) {
    const [rows] = await sequelize.query(
      `SELECT "BU_Id" AS "Id" FROM "business_units" WHERE "BU_Name" = :name LIMIT 1`,
      { transaction: t, replacements: { name: buName } },
    );
    if (!rows?.[0]) throw badReq("BusinessUnitName not found");
    return Number(rows[0].Id);
  }

  throw badReq("BusinessUnitCode (or BusinessUnitId) is required");
}

module.exports = {
  badReq,

  /** =========================
   * GET LIST /branches (grouped by BU)
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

    // global search (branch + BU)
    if (searchTerm) {
      where.push(`(
        b."BR_Code" ILIKE :q OR
        b."BR_Name" ILIKE :q OR
        bu."BU_Code" ILIKE :q OR
        bu."BU_Name" ILIKE :q
      )`);
      replacements.q = `%${searchTerm}%`;
    }

    // range
    where.push(...buildWhereFromRange(query.from, query.to, replacements));

    // filters
    where.push(...buildWhereFromFilters(filterColumnRaw, replacements));

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj))
        norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    // count branches (not BU group count) -> matches FE pagination behavior (list item count)
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM "branches" b
      JOIN "business_units" bu ON bu."BU_Id" = b."BU_Id"
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    // data
    const dataSql = `
      SELECT
        b."BR_Id" AS "Id",
        b."BR_Code" AS "Code",
        b."BR_Name" AS "Name",
        b."BR_Active" AS "Active",
        b."BR_IdERP" AS "IdERP",
        b."BR_DocPrefix" AS "DocPrefix",
        b."BR_CreatedAt" AS "CreatedAt",
        b."BR_UpdatedAt" AS "UpdatedAt",
        b."BR_CreatedBy" AS "CreatedBy",
        b."BR_UpdatedBy" AS "UpdatedBy",
        bu."BU_Id" AS "BusinessUnitId",
        bu."BU_Code" AS "BusinessUnitCode",
        bu."BU_Name" AS "BusinessUnitName"
      FROM "branches" b
      JOIN "business_units" bu ON bu."BU_Id" = b."BU_Id"
      ${whereSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [rows] = await sequelize.query(dataSql, { replacements });

    const mapped = (rows || []).map(mapBranchRow);
    const grouped = groupByBusinessUnit(mapped);

    return {
      records: grouped,
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
   * GET /branches/summary
   * ========================= */
  async summary() {
    const sql = `
      SELECT
        COUNT(*)::bigint AS "TotalBranch",
        SUM(CASE WHEN "BR_Active" = true THEN 1 ELSE 0 END)::bigint AS "TotalOperationalStatus"
      FROM "branches"
    `;
    const [rows] = await sequelize.query(sql);
    const r = rows?.[0] || {};
    return {
      TotalBranch: Number(r.TotalBranch || 0),
      TotalOperationalStatus: Number(r.TotalOperationalStatus || 0),
    };
  },

  /** =========================
   * GET DETAIL /branches/:id
   * ========================= */
  async getById(id, t = null) {
    const branchId = toStr(id);
    if (!branchId) throw badReq("branchId is required");

    const sql = `
    SELECT
      b."BR_Id" AS "Id",
      b."BR_Code" AS "Code",
      b."BR_Name" AS "Name",
      b."BR_Active" AS "Active",
      b."BR_IdERP" AS "IdERP",
      b."BR_DocPrefix" AS "DocPrefix",
      b."BR_CreatedAt" AS "CreatedAt",
      b."BR_UpdatedAt" AS "UpdatedAt",
      b."BR_CreatedBy" AS "CreatedBy",
      b."BR_UpdatedBy" AS "UpdatedBy",
      bu."BU_Id" AS "BusinessUnitId",
      bu."BU_Code" AS "BusinessUnitCode",
      bu."BU_Name" AS "BusinessUnitName"
    FROM "branches" b
    JOIN "business_units" bu ON bu."BU_Id" = b."BU_Id"
    WHERE b."BR_Id" = :id
    LIMIT 1
  `;

    const [rows] = await sequelize.query(sql, {
      replacements: { id: branchId },
      ...(t ? { transaction: t } : {}),
    });

    if (!rows?.[0]) return null;
    return mapBranchRow(rows[0]);
  },

  /** =========================
   * POST /branches
   * ========================= */
  async create(payload, actor = "system") {
    const code = toStr(
      pick(payload, ["Code", "code", "BR_Code", "branchCode"]),
    );
    const name = toStr(
      pick(payload, ["Name", "name", "BR_Name", "branchName"]),
    );

    const activeRaw = pick(payload, ["Active", "active", "BR_Active"]);
    const activeParsed = activeRaw == null ? true : toBoolOrNull(activeRaw);
    if (activeRaw != null && activeParsed === null)
      throw badReq("Active must be boolean");

    const idErpRaw = pick(payload, ["IdERP", "idERP", "BR_IdERP"]);
    const idErp = idErpRaw == null ? null : toNumOrNull(idErpRaw);
    if (idErpRaw != null && idErp === null)
      throw badReq("IdERP must be number");

    const docPrefix =
      toStr(pick(payload, ["DocPrefix", "docPrefix", "BR_DocPrefix"])) || "";

    if (!code) throw badReq("Code is required");
    if (!name) throw badReq("Name is required");

    return await sequelize.transaction(async (t) => {
      const buId = await resolveBusinessUnitIdByCodeOrName(payload, t);

      // ...unique check tetap...

      const insertSql = `
      INSERT INTO "branches"
        ("BU_Id","BR_Code","BR_Name","BR_Active","BR_IdERP","BR_DocPrefix","BR_CreatedBy","BR_CreatedAt","BR_UpdatedBy","BR_UpdatedAt")
      VALUES
        (:buId,:code,:name,:active,:idErp,:docPrefix,:actor,NOW(),:actor,NOW())
      RETURNING "BR_Id" AS "Id"
    `;
      const [insRows] = await sequelize.query(insertSql, {
        transaction: t,
        replacements: {
          buId,
          code,
          name,
          active: activeParsed,
          idErp,
          docPrefix,
          actor,
        },
      });

      const newId = insRows?.[0]?.Id;
      return await this.getById(newId, t); // ✅ pakai transaction
    });
  },

  /** =========================
   * PUT /branches/:id
   * ========================= */
  async update(id, payload, actor = "system") {
    const branchId = toStr(id);
    if (!branchId) throw badReq("branchId is required");

    const codeRaw = pick(payload, ["Code", "code", "BR_Code", "branchCode"]);
    const nameRaw = pick(payload, ["Name", "name", "BR_Name", "branchName"]);
    const activeRaw = pick(payload, ["Active", "active", "BR_Active"]);
    const idErpRaw = pick(payload, ["IdERP", "idERP", "BR_IdERP"]);
    const docPrefixRaw = pick(payload, [
      "DocPrefix",
      "docPrefix",
      "BR_DocPrefix",
    ]);

    // optional BU move
    const buAny =
      pick(payload, ["BusinessUnitId", "businessUnitId", "BU_Id"]) !==
        undefined ||
      pick(payload, ["BusinessUnitCode", "businessUnitCode", "BU_Code"]) !==
        undefined ||
      pick(payload, ["BusinessUnitName", "businessUnitName", "BU_Name"]) !==
        undefined;

    const code = codeRaw === undefined ? undefined : toStr(codeRaw);
    const name = nameRaw === undefined ? undefined : toStr(nameRaw);
    const active =
      activeRaw === undefined ? undefined : toBoolOrNull(activeRaw);

    const idErp =
      idErpRaw === undefined
        ? undefined
        : idErpRaw == null
          ? null
          : toNumOrNull(idErpRaw);
    const docPrefix =
      docPrefixRaw === undefined ? undefined : toStr(docPrefixRaw);

    const hasAny =
      code !== undefined ||
      name !== undefined ||
      active !== undefined ||
      idErp !== undefined ||
      docPrefix !== undefined ||
      buAny;

    if (!hasAny) throw badReq("at least one field must be provided");
    if (code !== undefined && !code) throw badReq("Code cannot be empty");
    if (name !== undefined && !name) throw badReq("Name cannot be empty");
    if (activeRaw !== undefined && active === null)
      throw badReq("Active must be boolean");
    if (idErpRaw !== undefined && idErpRaw != null && idErp === null)
      throw badReq("IdERP must be number");

    const existing = await this.getById(branchId);
    if (!existing) throw notFound("Branch not found");

    return await sequelize.transaction(async (t) => {
      let buId = null;
      if (buAny) buId = await resolveBusinessUnitIdByCodeOrName(payload, t);

      // unique check code (if changed)
      if (code !== undefined && code !== existing.Code) {
        const [dupRows] = await sequelize.query(
          `SELECT 1 FROM "branches" WHERE "BR_Code" = :code AND "BR_Id" <> :id LIMIT 1`,
          { transaction: t, replacements: { code, id: branchId } },
        );
        if (dupRows?.[0]) throw conflict("Branch code already exists");
      }

      const sets = [];
      const replacements = { id: branchId, actor };

      if (buId !== null) {
        sets.push(`"BU_Id" = :buId`);
        replacements.buId = buId;
      }
      if (code !== undefined) {
        sets.push(`"BR_Code" = :code`);
        replacements.code = code;
      }
      if (name !== undefined) {
        sets.push(`"BR_Name" = :name`);
        replacements.name = name;
      }
      if (active !== undefined) {
        sets.push(`"BR_Active" = :active`);
        replacements.active = active;
      }
      if (idErp !== undefined) {
        sets.push(`"BR_IdERP" = :idErp`);
        replacements.idErp = idErp;
      }
      if (docPrefix !== undefined) {
        sets.push(`"BR_DocPrefix" = :docPrefix`);
        replacements.docPrefix = docPrefix;
      }

      sets.push(`"BR_UpdatedBy" = :actor`);
      sets.push(`"BR_UpdatedAt" = NOW()`);

      const sql = `
      UPDATE "branches"
      SET ${sets.join(", ")}
      WHERE "BR_Id" = :id
      RETURNING "BR_Id" AS "Id"
    `;

      const [updRows] = await sequelize.query(sql, {
        transaction: t,
        replacements,
      });

      // ✅ kalau 0 row ke-update => treat as not found
      if (!updRows?.[0]?.Id) throw notFound("Branch not found");

      return await this.getById(branchId, t); // ✅ pakai transaction biar response langsung updated
    });
  },

  /** =========================
   * DELETE /branches/:id
   * ========================= */
  async remove(id) {
    const branchId = toStr(id);
    if (!branchId) throw badReq("branchId is required");

    const existing = await this.getById(branchId);
    if (!existing) throw notFound("Branch not found");

    try {
      await sequelize.query(`DELETE FROM "branches" WHERE "BR_Id" = :id`, {
        replacements: { id: branchId },
      });
      return true;
    } catch (e) {
      if (e?.original?.code === "23503") {
        throw conflict("Branch cannot be deleted because it is still in use");
      }
      throw e;
    }
  },
};
