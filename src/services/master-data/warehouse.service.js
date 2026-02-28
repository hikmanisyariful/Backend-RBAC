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
const FILTER_MAP = {
  // warehouse
  code: { col: `w."code"`, type: "text" },
  name: { col: `w."name"`, type: "text" },
  status: { col: `w."status"`, type: "bool" },

  // branch
  branchid: { col: `b."BR_Id"`, type: "number" },
  branchids: { col: `b."BR_Id"`, type: "numberArray" }, // ✅ NEW
  branchcode: { col: `b."BR_Code"`, type: "text" },
  branchname: { col: `b."BR_Name"`, type: "text" },

  // business unit
  businessunitid: { col: `bu."BU_Id"`, type: "number" },
  businessunitcode: { col: `bu."BU_Code"`, type: "text" },
  businessunitname: { col: `bu."BU_Name"`, type: "text" },

  // country
  countryid: { col: `co."id"`, type: "number" },
  countryname: { col: `co."name"`, type: "text" },
};

const ORDER_BY_MAP = {
  businessunitname: `bu."BU_Name"`,
  businessunitcode: `bu."BU_Code"`,
  branchcode: `b."BR_Code"`,
  branchname: `b."BR_Name"`,

  code: `w."code"`,
  name: `w."name"`,
  status: `w."status"`,
  createdat: `w."created_at"`,
  updatedat: `w."updated_at"`,
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
      orderSql: `bu."BU_Name" ASC, b."BR_Code" ASC, w."code" ASC, w."id" ASC`,
      orderByEcho: JSON.stringify({
        businessunitname: "ASC",
        branchcode: "ASC",
        code: "ASC",
      }),
    };
  }

  const limited = pairs.slice(0, 4);
  const orderSql = `${limited.map((p) => `${p.col} ${p.dir}`).join(", ")}, w."id" ASC`;

  const echoObj = {};
  for (const p of limited) echoObj[p.key] = p.dir;

  return { orderSql, orderByEcho: JSON.stringify(echoObj) };
}

/** ✅ helper: normalize number array */
function normalizeNumberArray(val) {
  // allow: [1,2], ["1","2"], "1,2"
  const arr = Array.isArray(val)
    ? val
    : typeof val === "string"
      ? val.split(",")
      : [];

  const parsed = arr
    .map((x) => toNumOrNull(x))
    .filter((n) => n != null);

  // uniq
  return Array.from(new Set(parsed));
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

    if (spec.type === "number") {
      const parsed = toNumOrNull(val);
      if (parsed === null) continue;
      const param = `f_${key}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = parsed;
      continue;
    }

    /** ✅ NEW: branchIds array support */
    if (spec.type === "numberArray") {
      const nums = normalizeNumberArray(val);
      if (!nums.length) continue;

      const ph = [];
      for (let i = 0; i < nums.length; i++) {
        const param = `f_${key}_${i}`;
        ph.push(`:${param}`);
        replacements[param] = nums[i];
      }

      where.push(`${spec.col} IN (${ph.join(", ")})`);
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
    where.push(`w."created_at" >= :fromDate`);
    replacements.fromDate = new Date(fromStr);
  }
  if (toStrv) {
    where.push(`w."created_at" <= :toDate`);
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

function mapWarehouseRow(r) {
  return {
    Id: String(r.Id),
    Code: r.Code,
    Name: r.Name,
    Address: r.Address,
    Status: !!r.Status,
    Lat: r.Lat,
    Long: r.Long,
    MaxCapacity: r.MaxCapacity,
    DefaultRitase: r.DefaultRitase,
    CreatedAt: r.CreatedAt,
    UpdatedAt: r.UpdatedAt,
    CreatedBy: r.CreatedBy,
    DeletedAt: r.DeletedAt,

    BusinessUnitId: String(r.BusinessUnitId),
    BusinessUnitCode: r.BusinessUnitCode,
    BusinessUnitName: r.BusinessUnitName,

    BranchId: String(r.BranchId),
    BranchCode: r.BranchCode,
    BranchName: r.BranchName,

    CountryId: String(r.CountryId),
    CountryName: r.CountryName,
  };
}

function groupByBusinessUnitBranch(rows) {
  const buMap = new Map();

  for (const r of rows) {
    const buId = String(r.BusinessUnitId);
    if (!buMap.has(buId)) {
      buMap.set(buId, {
        BusinessUnitId: buId,
        BusinessUnitCode: r.BusinessUnitCode,
        BusinessUnitName: r.BusinessUnitName,
        Branches: [],
      });
    }

    const buNode = buMap.get(buId);

    const brId = String(r.BranchId);
    let brNode = buNode.Branches.find((x) => x.BranchId === brId);

    if (!brNode) {
      brNode = {
        BranchId: brId,
        BranchCode: r.BranchCode,
        BranchName: r.BranchName,
        Warehouses: [],
      };
      buNode.Branches.push(brNode);
    }

    brNode.Warehouses.push({
      Id: r.Id,
      Code: r.Code,
      Name: r.Name,
      Address: r.Address,
      Status: r.Status,
      Lat: r.Lat,
      Long: r.Long,
      MaxCapacity: r.MaxCapacity,
      DefaultRitase: r.DefaultRitase,
      CountryId: r.CountryId,
      CountryName: r.CountryName,
      CreatedAt: r.CreatedAt,
      UpdatedAt: r.UpdatedAt,
      CreatedBy: r.CreatedBy,
      DeletedAt: r.DeletedAt,
    });
  }

  return Array.from(buMap.values());
}

module.exports = {
  badReq,

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
        w."code" ILIKE :q OR
        w."name" ILIKE :q OR
        b."BR_Code" ILIKE :q OR
        b."BR_Name" ILIKE :q OR
        bu."BU_Code" ILIKE :q OR
        bu."BU_Name" ILIKE :q OR
        co."name" ILIKE :q
      )`);
      replacements.q = `%${searchTerm}%`;
    }

    where.push(...buildWhereFromRange(query.from, query.to, replacements));
    where.push(...buildWhereFromFilters(filterColumnRaw, replacements));

    if (toStr(query.includeDeleted).toLowerCase() !== "true") {
      where.push(`w."deleted_at" IS NULL`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj)) norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM "warehouses" w
      JOIN "branches" b ON b."BR_Id" = w."branch_id"
      JOIN "business_units" bu ON bu."BU_Id" = w."business_unit_id"
      LEFT JOIN "countries" co ON co."id" = w."country_id"
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    const dataSql = `
      SELECT
        w."id" AS "Id",
        w."code" AS "Code",
        w."name" AS "Name",
        w."address" AS "Address",
        w."status" AS "Status",
        w."lat" AS "Lat",
        w."long" AS "Long",
        w."max_capacity" AS "MaxCapacity",
        w."default_ritase" AS "DefaultRitase",
        w."created_by" AS "CreatedBy",
        w."created_at" AS "CreatedAt",
        w."updated_at" AS "UpdatedAt",
        w."deleted_at" AS "DeletedAt",

        bu."BU_Id" AS "BusinessUnitId",
        bu."BU_Code" AS "BusinessUnitCode",
        bu."BU_Name" AS "BusinessUnitName",

        b."BR_Id" AS "BranchId",
        b."BR_Code" AS "BranchCode",
        b."BR_Name" AS "BranchName",

        co."id" AS "CountryId",
        co."name" AS "CountryName"
      FROM "warehouses" w
      JOIN "branches" b ON b."BR_Id" = w."branch_id"
      JOIN "business_units" bu ON bu."BU_Id" = w."business_unit_id"
      LEFT JOIN "countries" co ON co."id" = w."country_id"
      ${whereSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [rows] = await sequelize.query(dataSql, { replacements });

    const mapped = (rows || []).map(mapWarehouseRow);
    const grouped = groupByBusinessUnitBranch(mapped);

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
};