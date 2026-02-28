"use strict";

const { sequelize } = require("../config/db");

/** =========================
 * utils
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
function badReq(message, exception) {
  const e = new Error(message);
  e.isBadRequest = true;
  e.exception = exception ?? null;
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
function parseActive(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "on", "yes", "active"].includes(s)) return true;
  if (["false", "0", "off", "no", "inactive"].includes(s)) return false;
  return null;
}
function toBoolOrNull(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "on", "yes"].includes(s)) return true;
  if (["false", "0", "off", "no"].includes(s)) return false;
  return null;
}
function parseStatusStrict(v) {
  // FE: boolean. Kita toleran string "active/inactive" juga.
  const b = toBoolOrNull(v);
  if (b !== null) return b;
  const a = parseActive(v);
  if (a !== null) return a;
  return null;
}
function pick(payload, keys) {
  for (const k of keys) {
    if (payload && payload[k] !== undefined) return payload[k];
  }
  return undefined;
}
function uniqStr(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = String(x ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
function parseDateOrNull(v, fieldName) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  // Expect YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw badReq(`${fieldName} must be in YYYY-MM-DD format`);
  }
  return s;
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
 * FILTER + ORDER whitelist
 * ========================= */
const FILTER_MAP = {
  username: { col: `u."U_Username"`, type: "text" },
  email: { col: `u."U_Email"`, type: "text" },
  name: { col: `u."U_FullName"`, type: "text" },
  phonenumber: { col: `u."U_PhoneNumber"`, type: "text" },

  active: { col: `u."U_Active"`, type: "active" },
  roleid: { col: `u."U_RoleId"`, type: "int" },
  usertype: { col: `u."U_UserType"`, type: "text" },
  expirydate: { col: `u."U_ExpiryDate"`, type: "date" },

  business_unit_id: { col: `uom."business_unit_id"`, type: "int" },
  branch_id: { col: `uom."branch_id"`, type: "int" },
  warehouse_id: { col: `uom."warehouse_id"`, type: "int" },
  customer_id: { col: `uom."customer_id"`, type: "int" },
};

const ORDER_BY_MAP = {
  username: `u."U_Username"`,
  email: `u."U_Email"`,
  name: `u."U_FullName"`,
  active: `u."U_Active"`,
  usertype: `u."U_UserType"`,
  expirydate: `u."U_ExpiryDate"`,

  created_at: `u."U_CreatedAt"`,
  updated_at: `u."U_UpdatedAt"`,

  role_name: `r."R_Name"`,
  role_code: `r."R_Code"`,
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

    pairs.push({ key, col, dir: dirNorm });
  }

  if (!pairs.length) {
    return {
      orderSql: `${ORDER_BY_MAP.name} ASC, u."U_Id" ASC`,
      orderByEcho: JSON.stringify({ name: "ASC" }),
    };
  }

  const limited = pairs.slice(0, 3);
  const orderSql = limited.map((p) => `${p.col} ${p.dir}`).join(", ");
  const orderSqlWithTie = `${orderSql}, u."U_Id" ASC`;

  const echoObj = {};
  for (const p of limited) echoObj[p.key] = p.dir;

  return { orderSql: orderSqlWithTie, orderByEcho: JSON.stringify(echoObj) };
}

function buildWhereFromFilters(filterColumnRaw, replacements) {
  const filters = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
  const where = [];

  for (const [kRaw, val] of Object.entries(filters)) {
    const key = String(kRaw || "").trim().toLowerCase();
    if (!key) continue;

    const spec = FILTER_MAP[key];
    if (!spec) continue;

    if (val == null) continue;
    if (typeof val === "string" && !val.trim()) continue;

    if (spec.type === "text") {
      const p = `f_${key}`;
      where.push(`${spec.col} ILIKE :${p}`);
      replacements[p] = `%${String(val).trim()}%`;
      continue;
    }

    if (spec.type === "active") {
      const parsed = parseActive(val);
      if (parsed === null) continue;
      const p = `f_${key}`;
      where.push(`${spec.col} = :${p}`);
      replacements[p] = parsed;
      continue;
    }

    if (spec.type === "int") {
      const n = toInt(val, NaN);
      if (!Number.isFinite(n)) continue;
      const p = `f_${key}`;
      where.push(`${spec.col} = :${p}`);
      replacements[p] = n;
      continue;
    }

    if (spec.type === "date") {
      const d = parseDateOrNull(val, key);
      if (!d) continue;
      const p = `f_${key}`;
      where.push(`${spec.col}::date = :${p}::date`);
      replacements[p] = d;
      continue;
    }
  }

  return where;
}

function buildPaginationMeta({ page, limit, totalRows, query, orderByEcho, filterColumnEcho }) {
  const totalPage = limit > 0 ? Math.ceil(totalRows / limit) : 0;

  return {
    page,
    limit,
    totalRecord: totalRows,
    totalPage,
    nextPage: page < totalPage,
    previousPage: page > 1,
    searchTerm: String(query.searchTerm || "").trim() || undefined,
    filterColumn: filterColumnEcho,
    orderBy: orderByEcho,
  };
}

/** =========================
 * BusinessUnits grouping
 * ========================= */
function buildBusinessUnitsByUser(mappingRows) {
  const byUser = new Map();

  for (const row of mappingRows || []) {
    const userId = String(row.UserId);
    if (!byUser.has(userId)) byUser.set(userId, new Map());
    const buMap = byUser.get(userId);

    const buId = row.BusinessUnitId == null ? "" : String(row.BusinessUnitId);
    if (!buId) continue;

    if (!buMap.has(buId)) {
      buMap.set(buId, {
        BusinessUnitId: buId,
        BusinessUnitName: row.BusinessUnitName ?? "",
        BusinessUnitCode: row.BusinessUnitCode ?? "",
        Branches: [],
        Warehouses: [],
        CustomerId: null,
      });
    }

    const bu = buMap.get(buId);

    if (row.BranchId != null) {
      const bid = String(row.BranchId);
      if (!bu.Branches.some((x) => x.BranchId === bid)) {
        bu.Branches.push({
          BranchId: bid,
          BranchName: row.BranchName ?? "",
          BranchCode: row.BranchCode ?? "",
        });
      }
    }

    if (row.WarehouseId != null) {
      const wid = String(row.WarehouseId);
      if (!bu.Warehouses.some((x) => x.WarehouseId === wid)) {
        bu.Warehouses.push({
          WarehouseId: wid,
          WarehouseName: row.WarehouseName ?? "",
          WarehouseCode: row.WarehouseCode ?? "",
        });
      }
    }

    if (!bu.CustomerId && row.CustomerId != null) {
      bu.CustomerId = {
        CustomerId: String(row.CustomerId),
        CustomerName: row.CustomerName ?? "",
        CustomerCode: row.CustomerCode ?? "",
      };
    }
  }

  const out = new Map();
  for (const [userId, buMap] of byUser.entries()) {
    out.set(userId, Array.from(buMap.values()));
  }
  return out;
}

/** =========================
 * org mappings helpers
 * ========================= */
function buildUomRowsFromPayload(userId, businessUnitsRaw) {
  const buList = Array.isArray(businessUnitsRaw) ? businessUnitsRaw : [];
  const rows = [];

  for (const bu of buList) {
    const businessUnitId = toStr(pick(bu, ["BusinessUnitId", "businessUnitId", "BU_Id"]));
    if (!businessUnitId) throw badReq("BusinessUnitId is required in BusinessUnitIds[]");

    const branchIds = uniqStr(pick(bu, ["BranchIds", "branchIds"]));
    const warehouseIds = uniqStr(pick(bu, ["WarehouseIds", "warehouseIds"]));
    const customerId = toStr(pick(bu, ["CustomerId", "customerId"])) || null;

    const branches = branchIds.length ? branchIds : [null];
    const warehouses = warehouseIds.length ? warehouseIds : [null];

    for (const brId of branches) {
      for (const whId of warehouses) {
        rows.push({
          user_id: Number(userId),
          business_unit_id: toInt(businessUnitId, NaN),
          branch_id: brId == null ? null : toInt(brId, NaN),
          warehouse_id: whId == null ? null : toInt(whId, NaN),
          customer_id: customerId ? toInt(customerId, NaN) : null,
        });
      }
    }
  }

  for (const r of rows) {
    if (!Number.isFinite(r.business_unit_id)) throw badReq("BusinessUnitId must be integer-like");
    if (r.branch_id != null && !Number.isFinite(r.branch_id)) throw badReq("BranchIds must be integer-like");
    if (r.warehouse_id != null && !Number.isFinite(r.warehouse_id)) throw badReq("WarehouseIds must be integer-like");
    if (r.customer_id != null && !Number.isFinite(r.customer_id)) throw badReq("CustomerId must be integer-like");
  }

  return rows;
}

/** =========================
 * override helpers (schema kamu)
 * - user_menu_permissions + user_menu_permission_items
 * - FE kirim permission codes (P_Code)
 * ========================= */
async function resolvePermissionCodesToIds(permissionCodes, { transaction }) {
  const codes = uniqStr(permissionCodes);
  if (!codes.length) return [];

  const sql = `
    SELECT "P_Id" AS "Id", "P_Code" AS "Code"
    FROM permissions
    WHERE "P_Code" IN (:codes)
  `;
  const [rows] = await sequelize.query(sql, {
    replacements: { codes },
    transaction,
  });

  const found = new Map((rows || []).map((r) => [String(r.Code), Number(r.Id)]));
  const missing = codes.filter((c) => !found.has(c));
  if (missing.length) throw badReq(`Unknown permission code(s): ${missing.join(", ")}`);

  return codes.map((c) => ({ code: c, id: found.get(c) }));
}

async function resolveMenuByPermissionIds(permissionIds, { transaction }) {
  // derive MenuId per P_Id from role_menu_permission_items -> role_menu_permissions
  const sql = `
    SELECT
      rmpi."P_Id" AS "PermissionId",
      rmp."MenuId" AS "MenuId"
    FROM role_menu_permission_items rmpi
    JOIN role_menu_permissions rmp ON rmp."RMP_Id" = rmpi."RMP_Id"
    WHERE rmpi."P_Id" IN (:pids)
  `;
  const [rows] = await sequelize.query(sql, {
    replacements: { pids: permissionIds },
    transaction,
  });

  const byPid = new Map(); // pid -> Set(menuId)
  for (const r of rows || []) {
    const pid = Number(r.PermissionId);
    const mid = Number(r.MenuId);
    if (!Number.isFinite(pid) || !Number.isFinite(mid)) continue;
    if (!byPid.has(pid)) byPid.set(pid, new Set());
    byPid.get(pid).add(mid);
  }

  const missing = permissionIds.filter((pid) => !byPid.has(pid));
  if (missing.length) {
    throw badReq(`PermissionId(s) not mapped to any menu: ${missing.join(", ")}`);
  }

  return byPid;
}

async function replaceUserOverrides(userId, permissionCodes, actorUserId, { transaction }) {
  // delete existing override for user
  const [umpRows] = await sequelize.query(
    `SELECT "UMP_Id" AS "Id" FROM user_menu_permissions WHERE "U_Id" = :uid`,
    { replacements: { uid: Number(userId) }, transaction }
  );
  const umpIds = (umpRows || []).map((x) => Number(x.Id)).filter(Number.isFinite);

  if (umpIds.length) {
    await sequelize.query(`DELETE FROM user_menu_permission_items WHERE "UMP_Id" IN (:umpIds)`, {
      replacements: { umpIds },
      transaction,
    });
  }
  await sequelize.query(`DELETE FROM user_menu_permissions WHERE "U_Id" = :uid`, {
    replacements: { uid: Number(userId) },
    transaction,
  });

  const codes = uniqStr(permissionCodes);
  if (!codes.length) return;

  // resolve P_Code -> P_Id
  const perms = await resolvePermissionCodesToIds(codes, { transaction });
  const pids = perms.map((p) => p.id);

  // resolve P_Id -> MenuId(s)
  const pidToMenus = await resolveMenuByPermissionIds(pids, { transaction });

  // group MenuId -> Set(P_Id)
  const menuToPids = new Map();
  for (const pid of pids) {
    const menus = pidToMenus.get(pid); // Set<MenuId>
    for (const mid of menus) {
      if (!menuToPids.has(mid)) menuToPids.set(mid, new Set());
      menuToPids.get(mid).add(pid);
    }
  }

  // insert headers & items
  for (const [menuId, pidSet] of menuToPids.entries()) {
    const headerSql = `
      INSERT INTO user_menu_permissions
        ("U_Id","MenuId","UMP_CreatedBy","UMP_CreatedAt","UMP_UpdatedBy","UMP_UpdatedAt")
      VALUES
        (:uid, :menuId, :by, NOW(), :by, NOW())
      RETURNING "UMP_Id" AS "Id"
    `;
    const [hdrRows] = await sequelize.query(headerSql, {
      replacements: {
        uid: Number(userId),
        menuId: Number(menuId),
        by: actorUserId ?? "system",
      },
      transaction,
    });
    const umpId = hdrRows?.[0]?.Id;
    if (!umpId) throw new Error("Failed to create user_menu_permissions");

    const pidArr = Array.from(pidSet.values());
    if (!pidArr.length) continue;

    const valuesSql = pidArr.map((_, i) => `(:umpId, :pid_${i})`).join(", ");
    const repl = { umpId: Number(umpId) };
    pidArr.forEach((pid, i) => (repl[`pid_${i}`] = Number(pid)));

    const itemsSql = `
      INSERT INTO user_menu_permission_items ("UMP_Id","P_Id")
      VALUES ${valuesSql}
    `;
    await sequelize.query(itemsSql, { replacements: repl, transaction });
  }
}

/** =========================
 * service
 * ========================= */
module.exports = {
  badReq,
  notFound,
  conflict,

  /** GET /users */
  async listUsers(query) {
    const page = clamp(toInt(query.page, 1), 1, 1_000_000_000);
    const limit = clamp(toInt(query.limit, 10), 1, 100);
    const offset = (page - 1) * limit;

    const searchTerm = String(query.searchTerm || "").trim();
    const filterColumnRaw = query.filterColumn;
    const orderByRaw = query.orderBy;

    const { orderSql, orderByEcho } = parseOrderByToSql(orderByRaw);

    // detect need join uom (kalau filter butuh mapping)
    const filterObj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
    const filterObjLower = Object.fromEntries(
      Object.entries(filterObj).map(([k, v]) => [String(k).toLowerCase(), v]),
    );
    const needUomJoin = [
      "business_unit_id",
      "branch_id",
      "warehouse_id",
      "customer_id",
    ].some((k) => Object.prototype.hasOwnProperty.call(filterObjLower, k));

    const where = [];
    const replacements = { offset, limit };

    if (searchTerm) {
      where.push(`(
        u."U_Username" ILIKE :q OR
        u."U_Email" ILIKE :q OR
        u."U_FullName" ILIKE :q OR
        COALESCE(u."U_PhoneNumber",'') ILIKE :q OR
        r."R_Name" ILIKE :q OR
        r."R_Code" ILIKE :q
      )`);
      replacements.q = `%${searchTerm}%`;
    }

    where.push(...buildWhereFromFilters(filterColumnRaw, replacements));
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj))
        norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    const joinUom = needUomJoin
      ? `LEFT JOIN user_org_mappings uom ON uom."user_id" = u."U_Id"`
      : "";

    // count distinct
    const countSql = `
      SELECT COUNT(DISTINCT u."U_Id")::bigint AS total
      FROM users u
      JOIN roles r ON r."R_Id" = u."U_RoleId"
      ${joinUom}
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    // data
    const dataSql = `
      SELECT DISTINCT
        u."U_Id" AS "Id",
        u."U_Username" AS "Username",
        u."U_Email" AS "Email",
        u."U_FullName" AS "Name",
        u."U_PhoneNumber" AS "PhoneNumber",
        u."U_Active" AS "Active",
        u."U_UserType" AS "UserType",
        u."U_ExpiryDate" AS "ExpiryDate",

        u."U_CreatedAt" AS "CreatedAt",
        u."U_UpdatedAt" AS "UpdatedAt",
        u."U_CreatedBy" AS "CreatedBy",
        u."U_UpdatedBy" AS "UpdatedBy",

        r."R_Id" AS "RoleId",
        r."R_Code" AS "RoleCode",
        r."R_Name" AS "RoleName"
      FROM users u
      JOIN roles r ON r."R_Id" = u."U_RoleId"
      ${joinUom}
      ${whereSql}
      ORDER BY ${orderSql}
      OFFSET :offset
      LIMIT :limit
    `;
    const [userRows] = await sequelize.query(dataSql, { replacements });

    const userIds = (userRows || [])
      .map((x) => Number(x.Id))
      .filter(Number.isFinite);
    let buByUser = new Map();

    if (userIds.length) {
      const mappingSql = `
        SELECT
          uom."user_id" AS "UserId",

          bu."BU_Id" AS "BusinessUnitId",
          bu."BU_Name" AS "BusinessUnitName",
          bu."BU_Code" AS "BusinessUnitCode",

          br."BR_Id" AS "BranchId",
          br."BR_Name" AS "BranchName",
          br."BR_Code" AS "BranchCode",

          wh."id" AS "WarehouseId",
          wh."name" AS "WarehouseName",
          wh."code" AS "WarehouseCode",

          cu."id" AS "CustomerId",
          cu."name" AS "CustomerName",
          cu."code" AS "CustomerCode"
        FROM user_org_mappings uom
        JOIN business_units bu ON bu."BU_Id" = uom."business_unit_id"
        LEFT JOIN branches br ON br."BR_Id" = uom."branch_id"
        LEFT JOIN warehouses wh ON wh."id" = uom."warehouse_id"
        LEFT JOIN customers cu ON cu."id" = uom."customer_id"
        WHERE uom."user_id" IN (:userIds)
      `;
      const [mappingRows] = await sequelize.query(mappingSql, {
        replacements: { userIds },
      });
      buByUser = buildBusinessUnitsByUser(mappingRows);
    }

    const records = (userRows || []).map((u) => {
      const uid = String(u.Id);
      const active = !!u.Active;

      return {
        Id: uid,
        Username: u.Username ?? "",
        Email: u.Email ?? "",
        Name: u.Name ?? "",

        UserType: u.UserType ?? "",
        Address: "",
        ExpiryDate: u.ExpiryDate ?? "",

        PhoneNumber: u.PhoneNumber ?? "",
        Status: active ? "active" : "inactive",

        Role: {
          RoleId: String(u.RoleId ?? ""),
          RoleCode: u.RoleCode ?? "",
          RoleName: u.RoleName ?? "",
        },

        BusinessUnits: buByUser.get(uid) ?? [],

        CreatedAt: u.CreatedAt ?? null,
        UpdatedAt: u.UpdatedAt ?? null,
        CreatedBy: u.CreatedBy ?? undefined,
        UpdatedBy: u.UpdatedBy ?? undefined,
      };
    });

    return {
      records,
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

  /** GET /users/:id */
  async getUserById(id) {
    const userId = toStr(id);
    if (!userId) throw badReq("userId is required");

    const userSql = `
      SELECT
        u."U_Id" AS "Id",
        u."U_Username" AS "Username",
        u."U_Email" AS "Email",
        u."U_FullName" AS "Name",
        u."U_PhoneNumber" AS "PhoneNumber",
        u."U_Active" AS "Active",
        u."U_UserType" AS "UserType",
        u."U_ExpiryDate" AS "ExpiryDate",

        u."U_CreatedAt" AS "CreatedAt",
        u."U_UpdatedAt" AS "UpdatedAt",
        u."U_CreatedBy" AS "CreatedBy",
        u."U_UpdatedBy" AS "UpdatedBy",

        r."R_Id" AS "RoleId",
        r."R_Code" AS "RoleCode",
        r."R_Name" AS "RoleName"
      FROM users u
      JOIN roles r ON r."R_Id" = u."U_RoleId"
      WHERE u."U_Id" = :id
      LIMIT 1
    `;
    const [rows] = await sequelize.query(userSql, {
      replacements: { id: userId },
    });
    const u = rows?.[0];
    if (!u) return null;

    const mappingSql = `
      SELECT
        uom."user_id" AS "UserId",

        bu."BU_Id" AS "BusinessUnitId",
        bu."BU_Name" AS "BusinessUnitName",
        bu."BU_Code" AS "BusinessUnitCode",

        br."BR_Id" AS "BranchId",
        br."BR_Name" AS "BranchName",
        br."BR_Code" AS "BranchCode",

        wh."id" AS "WarehouseId",
        wh."name" AS "WarehouseName",
        wh."code" AS "WarehouseCode",

        cu."id" AS "CustomerId",
        cu."name" AS "CustomerName",
        cu."code" AS "CustomerCode"
      FROM user_org_mappings uom
      JOIN business_units bu ON bu."BU_Id" = uom."business_unit_id"
      LEFT JOIN branches br ON br."BR_Id" = uom."branch_id"
      LEFT JOIN warehouses wh ON wh."id" = uom."warehouse_id"
      LEFT JOIN customers cu ON cu."id" = uom."customer_id"
      WHERE uom."user_id" = :uid
    `;
    const [mappingRows] = await sequelize.query(mappingSql, {
      replacements: { uid: Number(userId) },
    });

    const buByUser = buildBusinessUnitsByUser(mappingRows);
    const active = !!u.Active;

    return {
      Id: String(u.Id),
      Username: u.Username ?? "",
      Email: u.Email ?? "",
      Name: u.Name ?? "",

      UserType: u.UserType ?? "",
      Address: "",
      ExpiryDate: u.ExpiryDate ?? "",

      PhoneNumber: u.PhoneNumber ?? "",
      Status: active ? "active" : "inactive",

      Role: {
        RoleId: String(u.RoleId ?? ""),
        RoleCode: u.RoleCode ?? "",
        RoleName: u.RoleName ?? "",
      },

      BusinessUnits: buByUser.get(String(u.Id)) ?? [],

      CreatedAt: u.CreatedAt ?? null,
      UpdatedAt: u.UpdatedAt ?? null,
      CreatedBy: u.CreatedBy ?? undefined,
      UpdatedBy: u.UpdatedBy ?? undefined,
    };
  },

  /** POST /users */
  async createUser(payload, actorUserId) {
    const Username = toStr(
      pick(payload, ["Username", "username", "U_Username"]),
    );
    const Email = toStr(pick(payload, ["Email", "email", "U_Email"]));
    const Name = toStr(pick(payload, ["Name", "name", "U_FullName"]));
    const UserType = toStr(
      pick(payload, ["UserType", "userType", "U_UserType"]),
    );
    const ExpiryDate = parseDateOrNull(
      pick(payload, ["ExpiryDate", "expiryDate", "U_ExpiryDate"]),
      "ExpiryDate",
    );

    const RoleIdRaw = pick(payload, ["RoleId", "roleId", "U_RoleId"]);
    const RoleId = toInt(RoleIdRaw, NaN);

    const StatusRaw = pick(payload, [
      "Status",
      "status",
      "Active",
      "active",
      "U_Active",
    ]);
    const activeParsed =
      StatusRaw == null ? true : parseStatusStrict(StatusRaw);
    if (StatusRaw != null && activeParsed === null)
      throw badReq("Status must be boolean");
    const Active = activeParsed;

    const UserOverridePermissions =
      pick(payload, ["UserOverridePermissions", "userOverridePermissions"]) ??
      [];
    const BusinessUnitIds =
      pick(payload, ["BusinessUnitIds", "businessUnitIds"]) ?? [];

    if (!Username) throw badReq("Username is required");
    if (!Email) throw badReq("Email is required");
    if (!Name) throw badReq("Name is required");
    if (!Number.isFinite(RoleId)) throw badReq("RoleId is required");

    const t = await sequelize.transaction();
    try {
      // unique username/email
      const checkSql = `
        SELECT "U_Id","U_Username","U_Email"
        FROM users
        WHERE "U_Username" = :username OR "U_Email" = :email
        LIMIT 1
      `;
      const [checkRows] = await sequelize.query(checkSql, {
        replacements: { username: Username, email: Email },
        transaction: t,
      });
      const exists = checkRows?.[0];
      if (exists) {
        if (String(exists.U_Username) === Username)
          throw conflict("Username already exists");
        if (String(exists.U_Email) === Email)
          throw conflict("Email already exists");
        throw conflict("User already exists");
      }

      // role exists
      const roleCheckSql = `SELECT "R_Id" FROM roles WHERE "R_Id" = :id LIMIT 1`;
      const [roleRows] = await sequelize.query(roleCheckSql, {
        replacements: { id: RoleId },
        transaction: t,
      });
      if (!roleRows?.[0]) throw badReq("RoleId not found");

      // insert user
      const insertSql = `
        INSERT INTO users (
          "U_Username","U_Email","U_FullName","U_UserType","U_ExpiryDate","U_RoleId","U_Active",
          "U_BusinessUnit",
          "U_CreatedAt","U_UpdatedAt","U_CreatedBy","U_UpdatedBy"
        )
        VALUES (
          :username,:email,:name,:userType,:expiryDate,:roleId,:active,
          :businessUnit,
          NOW(), NOW(), :createdBy, :updatedBy
        )
        RETURNING "U_Id" AS "Id"
      `;
      const [insRows] = await sequelize.query(insertSql, {
        replacements: {
          username: Username,
          email: Email,
          name: Name,
          userType: UserType || null,
          expiryDate: ExpiryDate,
          roleId: RoleId,
          active: Active,
          businessUnit: "",
          createdBy: actorUserId ?? null,
          updatedBy: actorUserId ?? null,
        },
        transaction: t,
      });

      const newId = insRows?.[0]?.Id;
      if (!newId) throw new Error("Failed to create user");

      // org mappings
      const uomRows = buildUomRowsFromPayload(newId, BusinessUnitIds);
      if (uomRows.length) {
        const valuesSql = uomRows
          .map(
            (_, i) =>
              `(:user_id_${i}, :business_unit_id_${i}, :branch_id_${i}, :warehouse_id_${i}, :customer_id_${i}, NOW(), :by, NOW())`,
          )
          .join(", ");

        const repl = { by: actorUserId ?? "system" };
        uomRows.forEach((r, i) => {
          repl[`user_id_${i}`] = r.user_id;
          repl[`business_unit_id_${i}`] = r.business_unit_id;
          repl[`branch_id_${i}`] = r.branch_id;
          repl[`warehouse_id_${i}`] = r.warehouse_id;
          repl[`customer_id_${i}`] = r.customer_id;
        });

        const uomInsertSql = `
          INSERT INTO user_org_mappings
            ("user_id","business_unit_id","branch_id","warehouse_id","customer_id","created_at","created_by","updated_at")
          VALUES ${valuesSql}
          ON CONFLICT DO NOTHING
        `;
        await sequelize.query(uomInsertSql, {
          replacements: repl,
          transaction: t,
        });
      }

      // overrides (replace strategy)
      await replaceUserOverrides(newId, UserOverridePermissions, actorUserId, {
        transaction: t,
      });

      await t.commit();
      return await this.getUserById(String(newId));
    } catch (e) {
      await t.rollback();
      if (e?.original?.code === "23505") throw conflict("User already exists");
      throw e;
    }
  },

  /** PUT/PATCH /users/:id */
  async updateUser(id, payload, actorUserId) {
    const userId = toStr(id);
    if (!userId) throw badReq("userId is required");

    const existing = await this.getUserById(userId);
    if (!existing) throw notFound("User not found");

    const UsernameRaw = pick(payload, ["Username", "username", "U_Username"]);
    const EmailRaw = pick(payload, ["Email", "email", "U_Email"]);
    const NameRaw = pick(payload, ["Name", "name", "U_FullName"]);
    const UserTypeRaw = pick(payload, ["UserType", "userType", "U_UserType"]);
    const ExpiryDateRaw = pick(payload, [
      "ExpiryDate",
      "expiryDate",
      "U_ExpiryDate",
    ]);
    const RoleIdRaw = pick(payload, ["RoleId", "roleId", "U_RoleId"]);
    const StatusRaw = pick(payload, [
      "Status",
      "status",
      "Active",
      "active",
      "U_Active",
    ]);

    const BusinessUnitIdsRaw = pick(payload, [
      "BusinessUnitIds",
      "businessUnitIds",
    ]);
    const OverrideRaw = pick(payload, [
      "UserOverridePermissions",
      "userOverridePermissions",
    ]);

    const sets = [];
    const repl = { id: userId };

    if (UsernameRaw !== undefined) {
      const Username = toStr(UsernameRaw);
      if (!Username) throw badReq("Username cannot be empty");
      sets.push(`"U_Username" = :username`);
      repl.username = Username;
    }
    if (EmailRaw !== undefined) {
      const Email = toStr(EmailRaw);
      if (!Email) throw badReq("Email cannot be empty");
      sets.push(`"U_Email" = :email`);
      repl.email = Email;
    }
    if (NameRaw !== undefined) {
      const Name = toStr(NameRaw);
      if (!Name) throw badReq("Name cannot be empty");
      sets.push(`"U_FullName" = :name`);
      repl.name = Name;
    }
    if (UserTypeRaw !== undefined) {
      const UserType = toStr(UserTypeRaw);
      sets.push(`"U_UserType" = :userType`);
      repl.userType = UserType || null;
    }
    if (ExpiryDateRaw !== undefined) {
      const ExpiryDate = parseDateOrNull(ExpiryDateRaw, "ExpiryDate");
      sets.push(`"U_ExpiryDate" = :expiryDate`);
      repl.expiryDate = ExpiryDate;
    }
    if (RoleIdRaw !== undefined) {
      const RoleId = toInt(RoleIdRaw, NaN);
      if (!Number.isFinite(RoleId)) throw badReq("RoleId must be integer-like");
      sets.push(`"U_RoleId" = :roleId`);
      repl.roleId = RoleId;
    }
    if (StatusRaw !== undefined) {
      const Active = parseStatusStrict(StatusRaw);
      if (Active === null) throw badReq("Status must be boolean");
      sets.push(`"U_Active" = :active`);
      repl.active = Active;
    }

    const hasUserUpdate = sets.length > 0;
    const hasMappingReplace = BusinessUnitIdsRaw !== undefined;
    const hasOverrideReplace = OverrideRaw !== undefined;

    if (!hasUserUpdate && !hasMappingReplace && !hasOverrideReplace) {
      throw badReq("at least one field must be provided");
    }

    const t = await sequelize.transaction();
    try {
      // unique checks
      if (repl.username !== undefined || repl.email !== undefined) {
        const checkSql = `
          SELECT "U_Id","U_Username","U_Email"
          FROM users
          WHERE ("U_Username" = :username OR "U_Email" = :email)
            AND "U_Id" <> :id
          LIMIT 1
        `;
        const [rows] = await sequelize.query(checkSql, {
          replacements: {
            id: userId,
            username: repl.username ?? "__NO_USERNAME__",
            email: repl.email ?? "__NO_EMAIL__",
          },
          transaction: t,
        });
        const dup = rows?.[0];
        if (dup) {
          if (
            repl.username !== undefined &&
            String(dup.U_Username) === repl.username
          )
            throw conflict("Username already exists");
          if (repl.email !== undefined && String(dup.U_Email) === repl.email)
            throw conflict("Email already exists");
          throw conflict("User already exists");
        }
      }

      // role exists if changed
      if (repl.roleId !== undefined) {
        const roleCheckSql = `SELECT "R_Id" FROM roles WHERE "R_Id" = :id LIMIT 1`;
        const [roleRows] = await sequelize.query(roleCheckSql, {
          replacements: { id: repl.roleId },
          transaction: t,
        });
        if (!roleRows?.[0]) throw badReq("RoleId not found");
      }

      // update user
      if (hasUserUpdate) {
        sets.push(`"U_UpdatedAt" = NOW()`);
        sets.push(`"U_UpdatedBy" = :updatedBy`);
        repl.updatedBy = actorUserId ?? null;

        const updateSql = `
          UPDATE users
          SET ${sets.join(", ")}
          WHERE "U_Id" = :id
          RETURNING "U_Id" AS "Id"
        `;
        const [updRows] = await sequelize.query(updateSql, {
          replacements: repl,
          transaction: t,
        });
        if (!updRows?.[0]?.Id) throw notFound("User not found");
      }

      // replace org mappings
      if (hasMappingReplace) {
        await sequelize.query(
          `DELETE FROM user_org_mappings WHERE "user_id" = :uid`,
          {
            replacements: { uid: Number(userId) },
            transaction: t,
          },
        );

        const uomRows = buildUomRowsFromPayload(
          userId,
          BusinessUnitIdsRaw ?? [],
        );
        if (uomRows.length) {
          const valuesSql = uomRows
            .map(
              (_, i) =>
                `(:user_id_${i}, :business_unit_id_${i}, :branch_id_${i}, :warehouse_id_${i}, :customer_id_${i}, NOW(), :by, NOW())`,
            )
            .join(", ");

          const repl2 = { by: actorUserId ?? "system" };
          uomRows.forEach((r, i) => {
            repl2[`user_id_${i}`] = r.user_id;
            repl2[`business_unit_id_${i}`] = r.business_unit_id;
            repl2[`branch_id_${i}`] = r.branch_id;
            repl2[`warehouse_id_${i}`] = r.warehouse_id;
            repl2[`customer_id_${i}`] = r.customer_id;
          });

          const uomInsertSql = `
            INSERT INTO user_org_mappings
              ("user_id","business_unit_id","branch_id","warehouse_id","customer_id","created_at","created_by","updated_at")
            VALUES ${valuesSql}
            ON CONFLICT DO NOTHING
          `;
          await sequelize.query(uomInsertSql, {
            replacements: repl2,
            transaction: t,
          });
        }
      }

      // replace overrides if provided
      if (hasOverrideReplace) {
        await replaceUserOverrides(userId, OverrideRaw ?? [], actorUserId, {
          transaction: t,
        });
      }

      await t.commit();
      return await this.getUserById(userId);
    } catch (e) {
      await t.rollback();
      if (e?.original?.code === "23505") throw conflict("User already exists");
      throw e;
    }
  },

  /** DELETE /users/:id */
  async deleteUser(id) {
    const userId = toStr(id);
    if (!userId) throw badReq("userId is required");

    const existing = await this.getUserById(userId);
    if (!existing) throw notFound("User not found");

    const t = await sequelize.transaction();
    try {
      // delete overrides (child first)
      const [umpRows] = await sequelize.query(
        `SELECT "UMP_Id" AS "Id" FROM user_menu_permissions WHERE "U_Id" = :uid`,
        { replacements: { uid: Number(userId) }, transaction: t },
      );
      const umpIds = (umpRows || [])
        .map((x) => Number(x.Id))
        .filter(Number.isFinite);

      if (umpIds.length) {
        await sequelize.query(
          `DELETE FROM user_menu_permission_items WHERE "UMP_Id" IN (:umpIds)`,
          {
            replacements: { umpIds },
            transaction: t,
          },
        );
      }
      await sequelize.query(
        `DELETE FROM user_menu_permissions WHERE "U_Id" = :uid`,
        {
          replacements: { uid: Number(userId) },
          transaction: t,
        },
      );

      // delete org mappings
      await sequelize.query(
        `DELETE FROM user_org_mappings WHERE "user_id" = :uid`,
        {
          replacements: { uid: Number(userId) },
          transaction: t,
        },
      );

      // delete user
      await sequelize.query(`DELETE FROM users WHERE "U_Id" = :id`, {
        replacements: { id: userId },
        transaction: t,
      });

      await t.commit();
      return true;
    } catch (e) {
      await t.rollback();
      if (e?.original?.code === "23503")
        throw conflict("User cannot be deleted because it is still in use");
      throw e;
    }
  },

  async getUserSummary() {
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(u."U_UserType",'') = 'EMPLOYEE')::bigint AS "TotalEmployee",
        COUNT(*) FILTER (WHERE COALESCE(u."U_UserType",'') = 'EXTERNAL')::bigint AS "TotalExternal"
      FROM users u
    `;

    const [rows] = await sequelize.query(sql);
    const r = rows?.[0] ?? {};

    return {
      TotalEmployee: Number(r.TotalEmployee ?? 0),
      TotalExternal: Number(r.TotalExternal ?? 0),
    };
  },
};