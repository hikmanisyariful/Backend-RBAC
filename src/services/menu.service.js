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
function toBoolOrNull(v) {
  if (v == null || v === "") return null;
  const s = String(v).toLowerCase().trim();
  if (["true", "1", "on", "yes"].includes(s)) return true;
  if (["false", "0", "off", "no"].includes(s)) return false;
  return null;
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
function pick(payload, keys) {
  for (const k of keys) {
    if (payload && payload[k] !== undefined) return payload[k];
  }
  return undefined;
}

/** =========================
 * filtering/sorting
 * ========================= */

// ✅ match migration columns
const FILTER_MAP = {
  menucode: { col: `"M_Code"`, type: "text" },
  menuname: { col: `"M_Name"`, type: "text" },
  route: { col: `"M_Route"`, type: "text" },
  menutype: { col: `"M_MenuType"`, type: "text" },
  icon: { col: `"M_Icon"`, type: "text" },

  parentid: { col: `"M_ParentId"`, type: "int" },
  menulevel: { col: `"M_MenuLevel"`, type: "int" },
  orderposition: { col: `"M_OrderPosition"`, type: "int" },

  isactive: { col: `"M_Active"`, type: "bool" },
  isselected: { col: `"M_IsSelected"`, type: "bool" },
};

const ORDER_BY_MAP = {
  menuname: `"M_Name"`,
  menucode: `"M_Code"`,
  route: `"M_Route"`,
  menulevel: `"M_MenuLevel"`,
  orderposition: `"M_OrderPosition"`,
  isactive: `"M_Active"`,
  createdat: `"M_CreatedAt"`,
  updatedat: `"M_UpdatedAt"`,
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
  } catch {
    throw badReq(`${fieldName} must be a valid JSON object string`);
  }
}

function parseOrderByToSql(orderByRaw) {
  const obj = parseJsonObjectOrEmpty(orderByRaw, "orderBy");
  const entries = Object.entries(obj);

  const pairs = [];
  for (const [keyRaw, dirRaw] of entries) {
    const key = String(keyRaw || "").trim();
    if (!key) continue;

    const keyNorm = key.toLowerCase();
    const col = ORDER_BY_MAP[keyNorm];
    if (!col) continue;

    const dir = String(dirRaw ?? "ASC").toUpperCase().trim();
    const dirNorm = dir === "DESC" ? "DESC" : "ASC";

    pairs.push({ key: keyNorm, dir: dirNorm, col });
  }

  if (!pairs.length) {
    return {
      orderSql: `${ORDER_BY_MAP.orderposition} ASC, ${ORDER_BY_MAP.menuname} ASC, "M_Id" ASC`,
      orderByEcho: JSON.stringify({ orderposition: "ASC" }),
    };
  }

  const limited = pairs.slice(0, 3);
  const orderSql = limited.map((p) => `${p.col} ${p.dir}`).join(", ");
  const orderSqlWithTie = `${orderSql}, "M_Id" ASC`;

  const echoObj = {};
  for (const p of limited) echoObj[p.key] = p.dir;

  return { orderSql: orderSqlWithTie, orderByEcho: JSON.stringify(echoObj) };
}

function buildWhereFromFilters(filterColumnRaw, replacements) {
  const filters = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
  const where = [];

  for (const [keyRaw, val] of Object.entries(filters)) {
    const keyNorm = String(keyRaw || "").trim().toLowerCase();
    if (!keyNorm) continue;

    const spec = FILTER_MAP[keyNorm];
    if (!spec) continue;

    if (val == null) continue;
    if (typeof val === "string" && !val.trim()) continue;

    if (spec.type === "text") {
      const param = `f_${keyNorm}`;
      where.push(`${spec.col} ILIKE :${param}`);
      replacements[param] = `%${String(val).trim()}%`;
      continue;
    }

    if (spec.type === "int") {
      const parsed = toInt(val, NaN);
      if (!Number.isFinite(parsed)) continue;
      const param = `f_${keyNorm}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = parsed;
      continue;
    }

    if (spec.type === "bool") {
      const parsed = toBoolOrNull(val);
      if (parsed === null) continue;
      const param = `f_${keyNorm}`;
      where.push(`${spec.col} = :${param}`);
      replacements[param] = parsed;
      continue;
    }
  }

  return where;
}

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

    searchTerm: String(query.searchTerm || "").trim() || undefined,
    filterColumn: filterColumnEcho,
    orderBy: orderByEcho,
  };
}

module.exports = {
  badReq,

  /** GET /menus */
  async listMenus(query) {
    const page = clamp(toInt(query.page, 1), 1, 1_000_000_000);
    const limit = clamp(toInt(query.limit, 10), 1, 100);
    const offset = (page - 1) * limit;

    const searchTerm = String(query.searchTerm || "").trim();

    const filterColumnRaw = query.filterColumn;
    const orderByRaw = query.orderBy;

    const { orderSql, orderByEcho } = parseOrderByToSql(orderByRaw);

    const where = [];
    const replacements = { offset, limit };

    // global search
    if (searchTerm) {
      where.push(`(
        "M_Code" ILIKE :q OR
        "M_Name" ILIKE :q OR
        "M_Route" ILIKE :q OR
        "M_MenuType" ILIKE :q
      )`);
      replacements.q = `%${searchTerm}%`;
    }

    // filters
    const filterWhere = buildWhereFromFilters(filterColumnRaw, replacements);
    where.push(...filterWhere);

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj))
        norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    // count
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM menus
      ${whereSql}
    `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRows = Number(countRows?.[0]?.total || 0);

    // data (✅ mapping ke response yang kamu mau)
    const dataSql = `
      SELECT
        "M_Id" AS "Id",
        "M_Code" AS "MenuCode",
        "M_Name" AS "MenuName",
        "M_ParentId" AS "ParentId",
        "M_Route" AS "Route",
        "M_MenuType" AS "MenuType",
        "M_Icon" AS "Icon",
        "M_MenuLevel" AS "MenuLevel",
        "M_OrderPosition" AS "OrderPosition",
        "M_Active" AS "IsActive",
        "M_IsSelected" AS "IsSelected",
        "M_CreatedBy" AS "CreatedBy",
        "M_CreatedAt" AS "CreatedAt",
        "M_UpdatedBy" AS "UpdatedBy",
        "M_UpdatedAt" AS "UpdatedAt"
      FROM menus
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

  /** GET /menus/:id */
  async getMenuById(id) {
    const menuId = toStr(id);
    if (!menuId) throw badReq("menuId is required");

    const sql = `
      SELECT
        "M_Id" AS "Id",
        "M_Code" AS "MenuCode",
        "M_Name" AS "MenuName",
        "M_ParentId" AS "ParentId",
        "M_Route" AS "Route",
        "M_MenuType" AS "MenuType",
        "M_Icon" AS "Icon",
        "M_MenuLevel" AS "MenuLevel",
        "M_OrderPosition" AS "OrderPosition",
        "M_Active" AS "IsActive",
        "M_IsSelected" AS "IsSelected",
        "M_CreatedBy" AS "CreatedBy",
        "M_CreatedAt" AS "CreatedAt",
        "M_UpdatedBy" AS "UpdatedBy",
        "M_UpdatedAt" AS "UpdatedAt"
      FROM menus
      WHERE "M_Id" = :id
      LIMIT 1
    `;
    const [rows] = await sequelize.query(sql, { replacements: { id: menuId } });
    return rows?.[0] ?? null;
  },

  /** POST /menus */
  async createMenu(payload, actor = "system") {
    const MenuCode = toStr(pick(payload, ["MenuCode", "menuCode", "code", "M_Code"]));
    const MenuName = toStr(pick(payload, ["MenuName", "menuName", "name", "M_Name"]));
    const Route = toStr(pick(payload, ["Route", "route", "M_Route"]));
    const MenuType = toStr(pick(payload, ["MenuType", "menuType", "type", "M_MenuType"]));
    const Icon = toStr(pick(payload, ["Icon", "icon", "M_Icon"]));

    const ParentIdRaw = pick(payload, ["ParentId", "parentId", "M_ParentId"]);
    const MenuLevelRaw = pick(payload, ["MenuLevel", "menuLevel", "M_MenuLevel"]);
    const OrderPositionRaw = pick(payload, ["OrderPosition", "orderPosition", "M_OrderPosition"]);
    const IsActiveRaw = pick(payload, ["IsActive", "isActive", "active", "M_Active"]);

    const ParentId =
      ParentIdRaw == null || ParentIdRaw === ""
        ? null
        : toInt(ParentIdRaw, NaN);
    if (ParentIdRaw != null && ParentId === null) throw badReq("ParentId must be number");

    const MenuLevel = toInt(MenuLevelRaw, NaN);
    const OrderPosition = toInt(OrderPositionRaw, NaN);

    const IsActiveParsed = IsActiveRaw == null ? true : toBoolOrNull(IsActiveRaw);
    if (IsActiveRaw != null && IsActiveParsed === null) throw badReq("IsActive must be boolean");
    const IsActive = IsActiveParsed;

    if (!MenuCode) throw badReq("MenuCode is required");
    if (!MenuName) throw badReq("MenuName is required");
    if (!Route) throw badReq("Route is required");
    if (!MenuType) throw badReq("MenuType is required");
    if (!Icon) throw badReq("Icon is required");
    if (!Number.isFinite(MenuLevel)) throw badReq("MenuLevel must be number");
    if (!Number.isFinite(OrderPosition)) throw badReq("OrderPosition must be number");

    // validate parent
    if (ParentId != null) {
      const parent = await this.getMenuById(ParentId);
      if (!parent) throw badReq("ParentId not found");
    }

    // unique check (M_Code is unique; optional: Route unique)
    const checkSql = `
      SELECT "M_Id","M_Code","M_Route"
      FROM menus
      WHERE "M_Code" = :code OR "M_Route" = :route
      LIMIT 1
    `;
    const [checkRows] = await sequelize.query(checkSql, {
      replacements: { code: MenuCode, route: Route },
    });
    const exists = checkRows?.[0];
    if (exists) {
      if (String(exists.M_Code) === MenuCode) throw conflict("MenuCode already exists");
      if (String(exists.M_Route) === Route) throw conflict("Route already exists");
      throw conflict("Menu already exists");
    }

    const insertSql = `
      INSERT INTO menus (
        "M_Code","M_Name","M_ParentId","M_Route","M_MenuType","M_Icon",
        "M_MenuLevel","M_OrderPosition","M_Active","M_IsSelected",
        "M_CreatedBy","M_CreatedAt","M_UpdatedBy","M_UpdatedAt"
      )
      VALUES (
        :MenuCode, :MenuName, :ParentId, :Route, :MenuType, :Icon,
        :MenuLevel, :OrderPosition, :IsActive, false,
        :CreatedBy, NOW(), :UpdatedBy, NOW()
      )
      RETURNING
        "M_Id" AS "Id",
        "M_Code" AS "MenuCode",
        "M_Name" AS "MenuName",
        "M_ParentId" AS "ParentId",
        "M_Route" AS "Route",
        "M_MenuType" AS "MenuType",
        "M_Icon" AS "Icon",
        "M_MenuLevel" AS "MenuLevel",
        "M_OrderPosition" AS "OrderPosition",
        "M_Active" AS "IsActive",
        "M_IsSelected" AS "IsSelected",
        "M_CreatedBy" AS "CreatedBy",
        "M_CreatedAt" AS "CreatedAt",
        "M_UpdatedBy" AS "UpdatedBy",
        "M_UpdatedAt" AS "UpdatedAt"
    `;

    try {
      const [rows] = await sequelize.query(insertSql, {
        replacements: {
          MenuCode,
          MenuName,
          ParentId,
          Route,
          MenuType,
          Icon,
          MenuLevel,
          OrderPosition,
          IsActive,
          CreatedBy: actor,
          UpdatedBy: actor,
        },
      });
      return rows?.[0] ?? null;
    } catch (e) {
      if (e?.original?.code === "23505") throw conflict("Menu already exists");
      throw e;
    }
  },

  /** PUT /menus/:id */
  async updateMenu(id, payload, actor = "system") {
    const menuId = toStr(id);
    if (!menuId) throw badReq("menuId is required");

    const existing = await this.getMenuById(menuId);
    if (!existing) throw notFound("Menu not found");

    const MenuCodeRaw = pick(payload, ["MenuCode", "menuCode", "code", "M_Code"]);
    const MenuNameRaw = pick(payload, ["MenuName", "menuName", "name", "M_Name"]);
    const ParentIdRaw = pick(payload, ["ParentId", "parentId", "M_ParentId"]);
    const RouteRaw = pick(payload, ["Route", "route", "M_Route"]);
    const MenuTypeRaw = pick(payload, ["MenuType", "menuType", "type", "M_MenuType"]);
    const IconRaw = pick(payload, ["Icon", "icon", "M_Icon"]);
    const MenuLevelRaw = pick(payload, ["MenuLevel", "menuLevel", "M_MenuLevel"]);
    const OrderPositionRaw = pick(payload, ["OrderPosition", "orderPosition", "M_OrderPosition"]);
    const IsActiveRaw = pick(payload, ["IsActive", "isActive", "active", "M_Active"]);

    const MenuCode = MenuCodeRaw === undefined ? undefined : toStr(MenuCodeRaw);
    const MenuName = MenuNameRaw === undefined ? undefined : toStr(MenuNameRaw);
    const Route = RouteRaw === undefined ? undefined : toStr(RouteRaw);
    const MenuType = MenuTypeRaw === undefined ? undefined : toStr(MenuTypeRaw);
    const Icon = IconRaw === undefined ? undefined : toStr(IconRaw);

    const ParentId =
      ParentIdRaw === undefined
        ? undefined
        : ParentIdRaw == null || ParentIdRaw === ""
          ? null
          : toInt(ParentIdRaw, NaN);

    const MenuLevel = MenuLevelRaw === undefined ? undefined : toInt(MenuLevelRaw, NaN);
    const OrderPosition = OrderPositionRaw === undefined ? undefined : toInt(OrderPositionRaw, NaN);

    const IsActive = IsActiveRaw === undefined ? undefined : toBoolOrNull(IsActiveRaw);

    const hasAny =
      MenuCode !== undefined ||
      MenuName !== undefined ||
      ParentId !== undefined ||
      Route !== undefined ||
      MenuType !== undefined ||
      Icon !== undefined ||
      MenuLevel !== undefined ||
      OrderPosition !== undefined ||
      IsActive !== undefined;

    if (!hasAny) throw badReq("at least one field must be provided");

    if (MenuCode !== undefined && !MenuCode) throw badReq("MenuCode cannot be empty");
    if (MenuName !== undefined && !MenuName) throw badReq("MenuName cannot be empty");
    if (Route !== undefined && !Route) throw badReq("Route cannot be empty");
    if (MenuType !== undefined && !MenuType) throw badReq("MenuType cannot be empty");
    if (Icon !== undefined && !Icon) throw badReq("Icon cannot be empty");

    if (ParentId !== undefined && ParentId !== null && !Number.isFinite(ParentId))
      throw badReq("ParentId must be number");
    if (MenuLevel !== undefined && !Number.isFinite(MenuLevel))
      throw badReq("MenuLevel must be number");
    if (OrderPosition !== undefined && !Number.isFinite(OrderPosition))
      throw badReq("OrderPosition must be number");
    if (IsActive === null) throw badReq("IsActive must be boolean");

    // validate parent
    if (ParentId !== undefined) {
      if (ParentId === Number(menuId)) throw badReq("ParentId cannot be self");
      if (ParentId != null) {
        const parent = await this.getMenuById(ParentId);
        if (!parent) throw badReq("ParentId not found");
      }
    }

    // unique check for code/route if changed
    if (MenuCode !== undefined || Route !== undefined) {
      const checkSql = `
        SELECT "M_Id","M_Code","M_Route"
        FROM menus
        WHERE ("M_Code" = :code OR "M_Route" = :route)
          AND "M_Id" <> :id
        LIMIT 1
      `;
      const [checkRows] = await sequelize.query(checkSql, {
        replacements: {
          id: menuId,
          code: MenuCode ?? "__NO_CODE__",
          route: Route ?? "__NO_ROUTE__",
        },
      });

      const dup = checkRows?.[0];
      if (dup) {
        if (MenuCode !== undefined && String(dup.M_Code) === MenuCode)
          throw conflict("MenuCode already exists");
        if (Route !== undefined && String(dup.M_Route) === Route)
          throw conflict("Route already exists");
        throw conflict("Menu already exists");
      }
    }

    const sets = [];
    const replacements = { id: menuId, UpdatedBy: actor };

    if (MenuCode !== undefined) {
      sets.push(`"M_Code" = :MenuCode`);
      replacements.MenuCode = MenuCode;
    }
    if (MenuName !== undefined) {
      sets.push(`"M_Name" = :MenuName`);
      replacements.MenuName = MenuName;
    }
    if (ParentId !== undefined) {
      sets.push(`"M_ParentId" = :ParentId`);
      replacements.ParentId = ParentId;
    }
    if (Route !== undefined) {
      sets.push(`"M_Route" = :Route`);
      replacements.Route = Route;
    }
    if (MenuType !== undefined) {
      sets.push(`"M_MenuType" = :MenuType`);
      replacements.MenuType = MenuType;
    }
    if (Icon !== undefined) {
      sets.push(`"M_Icon" = :Icon`);
      replacements.Icon = Icon;
    }
    if (MenuLevel !== undefined) {
      sets.push(`"M_MenuLevel" = :MenuLevel`);
      replacements.MenuLevel = MenuLevel;
    }
    if (OrderPosition !== undefined) {
      sets.push(`"M_OrderPosition" = :OrderPosition`);
      replacements.OrderPosition = OrderPosition;
    }
    if (IsActive !== undefined) {
      sets.push(`"M_Active" = :IsActive`);
      replacements.IsActive = IsActive;
    }

    sets.push(`"M_UpdatedBy" = :UpdatedBy`);
    sets.push(`"M_UpdatedAt" = NOW()`);

    const updateSql = `
      UPDATE menus
      SET ${sets.join(", ")}
      WHERE "M_Id" = :id
      RETURNING
        "M_Id" AS "Id",
        "M_Code" AS "MenuCode",
        "M_Name" AS "MenuName",
        "M_ParentId" AS "ParentId",
        "M_Route" AS "Route",
        "M_MenuType" AS "MenuType",
        "M_Icon" AS "Icon",
        "M_MenuLevel" AS "MenuLevel",
        "M_OrderPosition" AS "OrderPosition",
        "M_Active" AS "IsActive",
        "M_IsSelected" AS "IsSelected",
        "M_CreatedBy" AS "CreatedBy",
        "M_CreatedAt" AS "CreatedAt",
        "M_UpdatedBy" AS "UpdatedBy",
        "M_UpdatedAt" AS "UpdatedAt"
    `;

    try {
      const [rows] = await sequelize.query(updateSql, { replacements });
      const record = rows?.[0] ?? null;
      if (!record) throw notFound("Menu not found");
      return record;
    } catch (e) {
      if (e?.original?.code === "23505") throw conflict("Menu already exists");
      throw e;
    }
  },

  /** DELETE /menus/:id */
  async deleteMenu(id) {
    const menuId = toStr(id);
    if (!menuId) throw badReq("menuId is required");

    const existing = await this.getMenuById(menuId);
    if (!existing) throw notFound("Menu not found");

    // block delete if has children
    const childSql = `SELECT 1 FROM menus WHERE "M_ParentId" = :id LIMIT 1`;
    const [childRows] = await sequelize.query(childSql, { replacements: { id: menuId } });
    if (childRows?.length) {
      throw conflict("Menu cannot be deleted because it still has child menus");
    }

    const delSql = `DELETE FROM menus WHERE "M_Id" = :id`;

    try {
      await sequelize.query(delSql, { replacements: { id: menuId } });
      return true;
    } catch (e) {
      if (e?.original?.code === "23503") {
        throw conflict("Menu cannot be deleted because it is still in use");
      }
      throw e;
    }
  },
};