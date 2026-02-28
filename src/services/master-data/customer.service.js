"use strict";

const { sequelize } = require("../../config/db");

/** ===== utils (sama pola) ===== */
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

const FILTER_MAP = {
  code: { col: `"c"."code"`, type: "text" },
  name: { col: `"c"."name"`, type: "text" },
  sapcode: { col: `"c"."sap_code"`, type: "text" },
  npwp: { col: `"c"."npwp"`, type: "text" },

  statusactive: { col: `"c"."status_active"`, type: "bool" },

  businessunitid: { col: `"c"."business_unit_id"`, type: "id" },
  countryid: { col: `"c"."country_id"`, type: "id" },
  userid: { col: `"c"."user_id"`, type: "id" },
};

const ORDER_BY_MAP = {
  code: `"c"."code"`,
  name: `"c"."name"`,
  sapcode: `"c"."sap_code"`,
  statusactive: `"c"."status_active"`,

  businessunitid: `"c"."business_unit_id"`,
  countryid: `"c"."country_id"`,
  userid: `"c"."user_id"`,

  createdat: `"c"."created_at"`,
  updatedat: `"c"."updated_at"`,
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
      orderSql: `${ORDER_BY_MAP.createdat} DESC, "c"."id" ASC`,
      orderByEcho: JSON.stringify({ createdat: "DESC" }),
    };
  }

  const limited = pairs.slice(0, 3);
  const orderSql = `${limited.map((p) => `${p.col} ${p.dir}`).join(", ")}, "c"."id" ASC`;

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

    if (spec.type === "id") {
      const param = `f_${key}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = String(val).trim();
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
    where.push(`"c"."created_at" >= :fromDate`);
    replacements.fromDate = new Date(fromStr);
  }
  if (toStrv) {
    where.push(`"c"."created_at" <= :toDate`);
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

function mapCustomer(r) {
  return {
    Id: String(r.Id),
    SAPCode: r.SAPCode ?? null,
    Code: r.Code,
    Name: r.Name,
    NPWP: r.NPWP ?? null,
    Logo: r.Logo ?? null,
    BillingAddress: r.BillingAddress ?? null,
    StatusActive: !!r.StatusActive,

    BusinessUnitId: String(r.BusinessUnitId),
    CountryId: String(r.CountryId),
    UserId: String(r.UserId),

    CreatedBy: r.CreatedBy,
    CreatedAt: r.CreatedAt,
    UpdatedAt: r.UpdatedAt,
    DeletedAt: r.DeletedAt,

    BusinessUnitName: r.BusinessUnitName ?? undefined,
    CountryName: r.CountryName ?? undefined,
    UserFullName: r.UserFullName ?? undefined,
    Username: r.Username ?? undefined,
    Email: r.Email ?? undefined,
  };
}

module.exports = {
  badReq,

  /** =========================
   *  GET LIST /customers
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

    // global search (customer)
    if (searchTerm) {
      where.push(`("c"."code" ILIKE :q OR "c"."name" ILIKE :q OR "c"."sap_code" ILIKE :q)`);
      replacements.q = `%${searchTerm}%`;
    }

    where.push(...buildWhereFromRange(query.from, query.to, replacements));
    where.push(...buildWhereFromFilters(filterColumnRaw, replacements));

    // soft delete default: exclude deleted
    if (toStr(query.includeDeleted).toLowerCase() !== "true") {
      where.push(`"c"."deleted_at" IS NULL`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj)) norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    const fromSql = `
      FROM "customers" "c"
      LEFT JOIN "business_units" "bu" ON "bu"."BU_Id" = "c"."business_unit_id"
      LEFT JOIN "countries" "co" ON "co"."id" = "c"."country_id"
      LEFT JOIN "users" "u" ON "u"."U_Id" = "c"."user_id"
      ${whereSql}
    `;

    // count
    const countSql = `SELECT COUNT(*)::bigint AS total ${fromSql}`;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    // data
    const dataSql = `
      SELECT
        "c"."id" AS "Id",
        "c"."sap_code" AS "SAPCode",
        "c"."code" AS "Code",
        "c"."name" AS "Name",
        "c"."npwp" AS "NPWP",
        "c"."logo" AS "Logo",
        "c"."billing_address" AS "BillingAddress",
        "c"."status_active" AS "StatusActive",

        "c"."business_unit_id" AS "BusinessUnitId",
        "c"."country_id" AS "CountryId",
        "c"."user_id" AS "UserId",

        "c"."created_by" AS "CreatedBy",
        "c"."created_at" AS "CreatedAt",
        "c"."updated_at" AS "UpdatedAt",
        "c"."deleted_at" AS "DeletedAt",

        "bu"."BU_Name" AS "BusinessUnitName",
        "co"."name" AS "CountryName",
        "u"."U_FullName" AS "UserFullName",
        "u"."U_Username" AS "Username",
        "u"."U_Email" AS "Email"
      ${fromSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [rows] = await sequelize.query(dataSql, { replacements });

    return {
      records: (rows || []).map(mapCustomer),
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
};