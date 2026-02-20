"use strict";

const { sequelize } = require("../config/db");

function toInt(v, def) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : def;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * active can be:
 * - true / false
 * - 1 / 0
 * - on/off, yes/no
 */
function parseActive(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().trim();

  if (["true", "1", "on", "yes", "active"].includes(s)) return true;
  if (["false", "0", "off", "no", "inactive"].includes(s)) return false;

  return null; // invalid => ignore (atau throw badReq kalau mau strict)
}

function badReq(message) {
  const e = new Error(message);
  e.isBadRequest = true;
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

function toStr(v) {
  return String(v ?? "").trim();
}

function toBoolOrNull(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "on", "yes"].includes(s)) return true;
  if (["false", "0", "off", "no"].includes(s)) return false;
  return null; // invalid
}

// ambil value dari payload dengan beberapa alias (biar FE/BE fleksibel)
function pick(payload, keys) {
  for (const k of keys) {
    if (payload && payload[k] !== undefined) return payload[k];
  }
  return undefined;
}

/** =========================
 *  NEW PARAMS SUPPORT
 *  ========================= */

// whitelist filter key -> SQL column + type
const FILTER_MAP = {
  code: { col: `"R_Code"`, type: "text" },
  name: { col: `"R_Name"`, type: "text" },
  description: { col: `"R_Description"`, type: "text" },

  // ✅ active only (NOT status)
  active: { col: `"R_Active"`, type: "active" },

  // optional
  isdefault: { col: `"R_IsDefault"`, type: "bool" },
};

// whitelist order key -> SQL column
const ORDER_BY_MAP = {
  name: `"R_Name"`,
  code: `"R_Code"`,

  // ✅ active only (NOT status)
  active: `"R_Active"`,

  created_at: `"R_CreatedAt"`,
  updated_at: `"R_UpdatedAt"`,
  isdefault: `"R_IsDefault"`,
};

function parseJsonObjectOrEmpty(raw, fieldName) {
  const s = String(raw ?? "").trim();
  if (!s) return {};

  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("must be an object");
    }
    return obj;
  } catch (e) {
    throw badReq(`${fieldName} must be a valid JSON object string`);
  }
}

// parse orderBy JSON => ORDER BY sql + echo normalized
function parseOrderByToSql(orderByRaw) {
  const obj = parseJsonObjectOrEmpty(orderByRaw, "orderBy");

  // preserve insertion order
  const entries = Object.entries(obj);

  const pairs = [];
  for (const [keyRaw, dirRaw] of entries) {
    const key = String(keyRaw || "").trim();
    if (!key) continue;

    const keyNorm = key.toLowerCase();
    const col = ORDER_BY_MAP[keyNorm];
    if (!col) continue;

    const dir = String(dirRaw ?? "ASC")
      .toUpperCase()
      .trim();
    const dirNorm = dir === "DESC" ? "DESC" : "ASC";

    pairs.push({ key: keyNorm, dir: dirNorm, col });
  }

  if (!pairs.length) {
    return {
      orderSql: `${ORDER_BY_MAP.name} ASC, "R_Id" ASC`,
      orderByEcho: JSON.stringify({ name: "ASC" }),
    };
  }

  // anti abuse: limit multi-sort length
  const limited = pairs.slice(0, 3);

  const orderSql = limited.map((p) => `${p.col} ${p.dir}`).join(", ");
  const orderSqlWithTie = `${orderSql}, "R_Id" ASC`;

  // echo normalized (maintain order)
  const echoObj = {};
  for (const p of limited) echoObj[p.key] = p.dir;

  return {
    orderSql: orderSqlWithTie,
    orderByEcho: JSON.stringify(echoObj),
  };
}

// build WHERE parts from filterColumn JSON
function buildWhereFromFilters(filterColumnRaw, replacements) {
  const filters = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
  const where = [];

  for (const [keyRaw, val] of Object.entries(filters)) {
    const keyNorm = String(keyRaw || "").trim().toLowerCase();
    if (!keyNorm) continue;

    const spec = FILTER_MAP[keyNorm];
    if (!spec) continue; // ignore unknown keys

    // skip null/empty string => not filtering
    if (val == null) continue;
    if (typeof val === "string" && !val.trim()) continue;

    if (spec.type === "text") {
      const param = `f_${keyNorm}`;
      where.push(`${spec.col} ILIKE :${param}`);
      replacements[param] = `%${String(val).trim()}%`;
      continue;
    }

    if (spec.type === "active") {
      const parsed = parseActive(val);
      if (parsed === null) continue; // invalid => ignore (atau throw badReq)
      const param = `f_${keyNorm}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = parsed;
      continue;
    }

    if (spec.type === "bool") {
      const parsed = toBoolOrNull(val);
      if (parsed === null) continue; // invalid => ignore (atau throw badReq)
      const param = `f_${keyNorm}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = parsed;
      continue;
    }
  }

  return where;
}

// FE expects camelCase pagination in Meta.Pagination
function buildPaginationMeta({
  page,
  limit,
  totalRows,
  query,
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

    // optional echo
    searchTerm: String(query.searchTerm || "").trim() || undefined,
    filterColumn: filterColumnEcho, // string JSON normalized
    orderBy: orderByEcho, // string JSON normalized
  };
}

module.exports = {
  badReq,

  /**
   * listRoles params:
   * - searchTerm: string
   * - page: number (1-based)
   * - limit: number
   * - filterColumn: stringified JSON object (multi filter)
   * - orderBy: stringified JSON object (multi sort; insertion order)
   */
  async listRoles(query) {
    // ===== params =====
    const page = clamp(toInt(query.page, 1), 1, 1_000_000_000);
    const limit = clamp(toInt(query.limit, 10), 1, 100);
    const offset = (page - 1) * limit;

    const searchTerm = String(query.searchTerm || "").trim();

    // FE sends JSON stringify
    const filterColumnRaw = query.filterColumn;
    const orderByRaw = query.orderBy;

    const { orderSql, orderByEcho } = parseOrderByToSql(orderByRaw);

    // ===== where =====
    const where = [];
    const replacements = { offset, limit };

    // global search
    if (searchTerm) {
      where.push(`(
        "R_Code" ILIKE :q OR
        "R_Name" ILIKE :q OR
        "R_Description" ILIKE :q
      )`);
      replacements.q = `%${searchTerm}%`;
    }

    // column filters (multiple)
    const filterWhere = buildWhereFromFilters(filterColumnRaw, replacements);
    where.push(...filterWhere);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // echo filterColumn normalized (optional)
    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj))
        norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    // ===== count =====
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM roles
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    // ===== data =====
    const dataSql = `
      SELECT
        "R_Id" AS "Id",
        "R_Code" AS "Code",
        "R_Name" AS "Name",
        "R_Description" AS "Description",
        "R_IsDefault" AS "IsDefault",
        "R_Active" AS "Active",
        "R_CreatedAt" AS "CreatedAt",
        "R_UpdatedAt" AS "UpdatedAt"
      FROM roles
      ${whereSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [rows] = await sequelize.query(dataSql, { replacements });

    return {
      records: rows || [],
      pagination: buildPaginationMeta({
        page,
        limit,
        totalRows,
        query: { searchTerm },
        orderByEcho,
        filterColumnEcho,
      }),
    };
  },

  async getRoleById(id) {
    const roleId = String(id || "").trim();
    if (!roleId) throw badReq("roleId is required");

    const sql = `
      SELECT
        "R_Id" AS "Id",
        "R_Code" AS "Code",
        "R_Name" AS "Name",
        "R_Description" AS "Description",
        "R_IsDefault" AS "IsDefault",
        "R_Active" AS "Active",
        "R_CreatedAt" AS "CreatedAt",
        "R_UpdatedAt" AS "UpdatedAt"
      FROM roles
      WHERE "R_Id" = :id
      LIMIT 1
    `;

    const [rows] = await sequelize.query(sql, { replacements: { id: roleId } });
    return rows?.[0] ?? null;
  },

  async createRole(payload) {
    const code = toStr(pick(payload, ["code", "Code", "roleCode", "R_Code"]));
    const name = toStr(pick(payload, ["name", "Name", "roleName", "R_Name"]));

    const descriptionRaw = pick(payload, [
      "description",
      "Description",
      "roleDescription",
      "R_Description",
    ]);
    const description = descriptionRaw == null ? null : toStr(descriptionRaw);

    const isDefaultRaw = pick(payload, [
      "isDefault",
      "IsDefault",
      "roleIsDefault",
      "R_IsDefault",
    ]);
    const activeRaw = pick(payload, [
      "active",
      "Active",
      "roleActive",
      "R_Active",
    ]);

    // default: active=true, isDefault=false
    const isDefaultParsed =
      isDefaultRaw == null ? false : toBoolOrNull(isDefaultRaw);
    if (isDefaultRaw != null && isDefaultParsed === null)
      throw badReq("roleIsDefault must be boolean");
    const isDefault = isDefaultParsed;

    const activeParsed = activeRaw == null ? true : toBoolOrNull(activeRaw);
    if (activeRaw != null && activeParsed === null)
      throw badReq("roleActive must be boolean");
    const active = activeParsed;

    if (!code) throw badReq("roleCode is required");
    if (!name) throw badReq("roleName is required");

    // cek unique code / name
    const checkSql = `
      SELECT "R_Id","R_Code","R_Name"
      FROM roles
      WHERE "R_Code" = :code OR "R_Name" = :name
      LIMIT 1
    `;
    const [checkRows] = await sequelize.query(checkSql, {
      replacements: { code, name },
    });
    const exists = checkRows?.[0];
    if (exists) {
      if (String(exists.R_Code) === code)
        throw conflict("Role code already exists");
      if (String(exists.R_Name) === name)
        throw conflict("Role name already exists");
      throw conflict("Role already exists");
    }

    const insertSql = `
      INSERT INTO roles (
        "R_Code","R_Name","R_Description","R_IsDefault","R_Active","R_CreatedAt","R_UpdatedAt"
      )
      VALUES (
        :code, :name, :description, :isDefault, :active, NOW(), NOW()
      )
      RETURNING
        "R_Id" AS "Id",
        "R_Code" AS "Code",
        "R_Name" AS "Name",
        "R_Description" AS "Description",
        "R_IsDefault" AS "IsDefault",
        "R_Active" AS "Active",
        "R_CreatedAt" AS "CreatedAt",
        "R_UpdatedAt" AS "UpdatedAt"
    `;

    try {
      const [rows] = await sequelize.query(insertSql, {
        replacements: { code, name, description, isDefault, active },
      });
      return rows?.[0] ?? null;
    } catch (e) {
      if (e?.original?.code === "23505") throw conflict("Role already exists");
      throw e;
    }
  },

  async updateRole(id, payload) {
    const roleId = toStr(id);
    if (!roleId) throw badReq("roleId is required");

    const codeRaw = pick(payload, ["code", "Code", "roleCode", "R_Code"]);
    const nameRaw = pick(payload, ["name", "Name", "roleName", "R_Name"]);
    const descRaw = pick(payload, [
      "description",
      "Description",
      "roleDescription",
      "R_Description",
    ]);
    const isDefaultRaw = pick(payload, [
      "isDefault",
      "IsDefault",
      "roleIsDefault",
      "R_IsDefault",
    ]);
    const activeRaw = pick(payload, [
      "active",
      "Active",
      "roleActive",
      "R_Active",
    ]);

    const code = codeRaw === undefined ? undefined : toStr(codeRaw);
    const name = nameRaw === undefined ? undefined : toStr(nameRaw);
    const description =
      descRaw === undefined
        ? undefined
        : descRaw == null
          ? null
          : toStr(descRaw);

    const isDefault =
      isDefaultRaw === undefined ? undefined : toBoolOrNull(isDefaultRaw);
    const active =
      activeRaw === undefined ? undefined : toBoolOrNull(activeRaw);

    const hasAny =
      code !== undefined ||
      name !== undefined ||
      description !== undefined ||
      isDefault !== undefined ||
      active !== undefined;

    if (!hasAny) throw badReq("at least one field must be provided");
    if (code !== undefined && !code) throw badReq("roleCode cannot be empty");
    if (name !== undefined && !name) throw badReq("roleName cannot be empty");
    if (isDefault === null) throw badReq("roleIsDefault must be boolean");
    if (active === null) throw badReq("roleActive must be boolean");

    const existing = await this.getRoleById(roleId);
    if (!existing) throw notFound("Role not found");

    if (code !== undefined || name !== undefined) {
      const checkSql = `
        SELECT "R_Id","R_Code","R_Name"
        FROM roles
        WHERE ("R_Code" = :code OR "R_Name" = :name)
          AND "R_Id" <> :id
        LIMIT 1
      `;
      const [checkRows] = await sequelize.query(checkSql, {
        replacements: {
          id: roleId,
          code: code ?? "__NO_CODE__",
          name: name ?? "__NO_NAME__",
        },
      });

      const dup = checkRows?.[0];
      if (dup) {
        if (code !== undefined && String(dup.R_Code) === code)
          throw conflict("Role code already exists");
        if (name !== undefined && String(dup.R_Name) === name)
          throw conflict("Role name already exists");
        throw conflict("Role already exists");
      }
    }

    const sets = [];
    const replacements = { id: roleId };

    if (code !== undefined) {
      sets.push(`"R_Code" = :code`);
      replacements.code = code;
    }
    if (name !== undefined) {
      sets.push(`"R_Name" = :name`);
      replacements.name = name;
    }
    if (description !== undefined) {
      sets.push(`"R_Description" = :description`);
      replacements.description = description;
    }
    if (isDefault !== undefined) {
      sets.push(`"R_IsDefault" = :isDefault`);
      replacements.isDefault = isDefault;
    }
    if (active !== undefined) {
      sets.push(`"R_Active" = :active`);
      replacements.active = active;
    }

    sets.push(`"R_UpdatedAt" = NOW()`);

    const updateSql = `
      UPDATE roles
      SET ${sets.join(", ")}
      WHERE "R_Id" = :id
      RETURNING
        "R_Id" AS "Id",
        "R_Code" AS "Code",
        "R_Name" AS "Name",
        "R_Description" AS "Description",
        "R_IsDefault" AS "IsDefault",
        "R_Active" AS "Active",
        "R_CreatedAt" AS "CreatedAt",
        "R_UpdatedAt" AS "UpdatedAt"
    `;

    try {
      const [rows] = await sequelize.query(updateSql, { replacements });
      const record = rows?.[0] ?? null;
      if (!record) throw notFound("Role not found");
      return record;
    } catch (e) {
      if (e?.original?.code === "23505") throw conflict("Role already exists");
      throw e;
    }
  },

  async deleteRole(id) {
    const roleId = toStr(id);
    if (!roleId) throw badReq("roleId is required");

    const existing = await this.getRoleById(roleId);
    if (!existing) throw notFound("Role not found");

    const delSql = `DELETE FROM roles WHERE "R_Id" = :id`;
    try {
      await sequelize.query(delSql, { replacements: { id: roleId } });
      return true;
    } catch (e) {
      if (e?.original?.code === "23503") {
        throw conflict("Role cannot be deleted because it is still in use");
      }
      throw e;
    }
  },
};
