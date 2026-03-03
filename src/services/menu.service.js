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
  if (["true", "1", "on", "yes", "active"].includes(s)) return true;
  if (["false", "0", "off", "no", "inactive"].includes(s)) return false;
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

    const dir = String(dirRaw ?? "ASC")
      .toUpperCase()
      .trim();
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
    const keyNorm = String(keyRaw || "")
      .trim()
      .toLowerCase();
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

/** =========================
 * tree builder
 * ========================= */
function buildMenuTree(rows = []) {
  const byId = new Map();
  const roots = [];

  for (const r of rows) {
    const id = String(r.Id);
    byId.set(id, {
      ...r,
      Id: id,
      ParentId: r.ParentId == null ? null : String(r.ParentId),
      Children: [],
    });
  }

  for (const node of byId.values()) {
    const pid = node.ParentId;
    if (!pid || pid === "0" || !byId.has(pid)) {
      roots.push(node);
    } else {
      byId.get(pid).Children.push(node);
    }
  }

  const sortRec = (list) => {
    list.sort((a, b) => {
      const ao = Number(a.OrderPosition ?? 0);
      const bo = Number(b.OrderPosition ?? 0);
      if (ao !== bo) return ao - bo;
      return String(a.MenuName ?? "").localeCompare(String(b.MenuName ?? ""));
    });
    for (const n of list) sortRec(n.Children);
  };
  sortRec(roots);

  return roots;
}

function normalizeOptionalCode(v) {
  const s = toStr(v);
  return s ? s : null;
}

module.exports = {
  badReq,

  /** =========================
   * GET /menus
   * ✅ DEFAULT: grouped tree
   * optional: ?flat=1 => return flat
   * ========================= */
  async listMenus(query) {
    const page = clamp(toInt(query.page, 1), 1, 1_000_000_000);
    const limit = clamp(toInt(query.limit, 10), 1, 100);

    // slot pagination dihitung dari "route nodes"
    const start = (page - 1) * limit + 1;
    const end = start + limit - 1;

    const searchTerm = String(query.searchTerm || "").trim();
    const filterColumnRaw = query.filterColumn;

    const replacements = { start, end };

    /**
     * Build conditions untuk alias t."..."
     * (karena di CTE kita pakai FROM t)
     */
    const conds = [];

    if (searchTerm) {
      conds.push(`(
      t."M_Code" ILIKE :q OR
      t."M_Name" ILIKE :q OR
      t."M_Route" ILIKE :q OR
      t."M_MenuType" ILIKE :q
    )`);
      replacements.q = `%${searchTerm}%`;
    }

    // filters -> prefix alias t.
    const filters = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
    for (const [keyRaw, val] of Object.entries(filters)) {
      const key = String(keyRaw || "")
        .trim()
        .toLowerCase();
      if (!key) continue;

      const spec = FILTER_MAP[key];
      if (!spec) continue;

      if (val == null) continue;
      if (typeof val === "string" && !val.trim()) continue;

      const col = `t.${spec.col}`; // spec.col contoh: `"M_Name"`

      if (spec.type === "text") {
        const p = `f_${key}`;
        conds.push(`${col} ILIKE :${p}`);
        replacements[p] = `%${String(val).trim()}%`;
      } else if (spec.type === "int") {
        const parsed = toInt(val, NaN);
        if (!Number.isFinite(parsed)) continue;
        const p = `f_${key}`;
        conds.push(`${col} = :${p}`);
        replacements[p] = parsed;
      } else if (spec.type === "bool") {
        const parsed = toBoolOrNull(val);
        if (parsed === null) continue;
        const p = `f_${key}`;
        conds.push(`${col} = :${p}`);
        replacements[p] = parsed;
      }
    }

    // ✅ RULE slot: node yang punya route (non-empty)
    // Kalau kamu mau "leaf route only", bilang—aku kasih versi routeCond leaf.
    const routeCond = `COALESCE(NULLIF(t."M_Route", ''), '') <> ''`;

    const whereRoute = conds.length
      ? `WHERE ${conds.join(" AND ")} AND ${routeCond}`
      : `WHERE ${routeCond}`;

    const filterColumnEcho = (() => {
      const obj = parseJsonObjectOrEmpty(filterColumnRaw, "filterColumn");
      const norm = {};
      for (const [k, v] of Object.entries(obj))
        norm[String(k).toLowerCase()] = v;
      return JSON.stringify(norm);
    })();

    // ====== CTE tree preorder path ======
    const cteTree = `
    WITH RECURSIVE t AS (
      SELECT
        m.*,
        (LPAD(COALESCE(m."M_OrderPosition", 0)::text, 6, '0') || '.' || LPAD(m."M_Id"::text, 10, '0'))::text AS path
      FROM menus m
      WHERE m."M_ParentId" IS NULL

      UNION ALL

      SELECT
        c.*,
        (t.path || '/' ||
          (LPAD(COALESCE(c."M_OrderPosition", 0)::text, 6, '0') || '.' || LPAD(c."M_Id"::text, 10, '0'))
        )::text AS path
      FROM menus c
      JOIN t ON c."M_ParentId" = t."M_Id"
    )
  `;

    /**
     * 1) Count total route nodes (pagination meta)
     */
    const countSql = `
    ${cteTree}
    SELECT COUNT(*)::bigint AS total
    FROM t
    ${whereRoute}
  `;
    const [countRows] = await sequelize.query(countSql, { replacements });
    const totalRouteRows = Number(countRows?.[0]?.total || 0);

    /**
     * 2) Page query:
     * - rank route nodes by preorder path
     * - pick ids for this page
     * - pull FULL ancestors (context) from t
     */
    const pageSql = `
    ${cteTree},
    route_rank AS (
      SELECT
        t."M_Id" AS "Id",
        ROW_NUMBER() OVER (ORDER BY t.path ASC) AS rn
      FROM t
      ${whereRoute}
    ),
    picked_ids AS (
      SELECT "Id"
      FROM route_rank
      WHERE rn BETWEEN :start AND :end
    ),
    -- nodes in page (route nodes)
    picked_nodes AS (
      SELECT t.*
      FROM t
      JOIN picked_ids p ON p."Id" = t."M_Id"
    ),
    -- ancestors (context): climb up to root
    ancestors AS (
      SELECT * FROM picked_nodes
      UNION ALL
      SELECT parent.*
      FROM t parent
      JOIN ancestors a ON a."M_ParentId" = parent."M_Id"
    )
    SELECT DISTINCT
      a."M_Id" AS "Id",
      a."M_Code" AS "MenuCode",
      a."M_Name" AS "MenuName",
      a."M_ParentId" AS "ParentId",
      a."M_Route" AS "Route",
      a."M_MenuType" AS "MenuType",
      a."M_Icon" AS "Icon",
      a."M_MenuLevel" AS "MenuLevel",
      a."M_OrderPosition" AS "OrderPosition",
      a."M_Active" AS "IsActive",
      a."M_IsSelected" AS "IsSelected",
      a."M_CreatedBy" AS "CreatedBy",
      a."M_CreatedAt" AS "CreatedAt",
      a."M_UpdatedBy" AS "UpdatedBy",
      a."M_UpdatedAt" AS "UpdatedAt",
      a.path AS "Path"
    FROM ancestors a
    ORDER BY "Path" ASC
  `;

    const [rows] = await sequelize.query(pageSql, { replacements });

    const tree = buildMenuTree(rows || []);

    return {
      records: tree,
      pagination: buildPaginationMeta({
        page,
        limit,
        totalRows: totalRouteRows, // ✅ totalRecord = jumlah route nodes
        query: { searchTerm },
        orderByEcho: JSON.stringify({ route_preorder: "ASC" }),
        filterColumnEcho,
      }),
    };
  },

  /** =========================
   * GET /menus/:id
   * ========================= */
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

  /** =========================
   * POST /menus
   * - MenuCode auto-generate if empty (DB M_Code NOT NULL)
   * - MenuType/MenuLevel/OrderPosition auto-generate
   * ========================= */
  async createMenu(payload, actor = "system") {
    // ====== helpers ======
    function slugToCode(name) {
      return String(name || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
    }

    async function ensureUniqueCode(baseCode) {
      // baseCode sudah uppercase, max 50
      let code = String(baseCode || "").slice(0, 50);
      if (!code) throw badReq("MenuCode is required");

      const sql = `SELECT 1 FROM menus WHERE "M_Code" = :code LIMIT 1`;

      // coba sampai 50 percobaan (should be enough)
      for (let i = 0; i <= 50; i++) {
        const candidate =
          i === 0
            ? code
            : (() => {
                const suffix = `_${i}`;
                const cut = 50 - suffix.length;
                return `${code.slice(0, cut)}${suffix}`;
              })();

        const [rows] = await sequelize.query(sql, {
          replacements: { code: candidate },
        });

        if (!rows?.length) return candidate;
      }

      throw conflict("MenuCode already exists");
    }

    // ====== basic fields ======
    let MenuCodeFinal = normalizeOptionalCode(
      pick(payload, ["MenuCode", "menuCode", "code", "M_Code"]),
    );

    const MenuName = toStr(
      pick(payload, ["MenuName", "menuName", "name", "M_Name"]),
    );
    const Route = toStr(pick(payload, ["Route", "route", "M_Route"]));
    const MenuType = toStr(
      pick(payload, ["MenuType", "menuType", "type", "M_MenuType"]),
    );
    const Icon = toStr(pick(payload, ["Icon", "icon", "M_Icon"])) || "";

    const ParentIdRaw = pick(payload, ["ParentId", "parentId", "M_ParentId"]);
    const MenuLevelRaw = pick(payload, [
      "MenuLevel",
      "menuLevel",
      "M_MenuLevel",
    ]);
    const OrderPositionRaw = pick(payload, [
      "OrderPosition",
      "orderPosition",
      "M_OrderPosition",
    ]);
    const IsActiveRaw = pick(payload, [
      "IsActive",
      "isActive",
      "active",
      "M_Active",
    ]);

    // ====== parse ParentId ======
    const ParentId =
      ParentIdRaw == null || ParentIdRaw === ""
        ? null
        : toInt(ParentIdRaw, NaN);

    if (
      ParentIdRaw != null &&
      ParentIdRaw !== "" &&
      !Number.isFinite(ParentId)
    ) {
      throw badReq("ParentId must be number");
    }

    // ====== parse numbers (may be NaN) ======
    const MenuLevel = toInt(MenuLevelRaw, NaN);
    const OrderPosition = toInt(OrderPositionRaw, NaN);

    // ====== parse active ======
    const IsActiveParsed =
      IsActiveRaw == null ? true : toBoolOrNull(IsActiveRaw);
    if (IsActiveRaw != null && IsActiveParsed === null) {
      throw badReq("IsActive must be boolean");
    }
    const IsActive = IsActiveParsed;

    // ====== base validations ======
    if (!MenuName) throw badReq("MenuName is required");

    // =========================
    // AUTO-GENERATE MenuCode (because DB NOT NULL)
    // =========================
    if (!MenuCodeFinal) {
      MenuCodeFinal = slugToCode(MenuName);
    }
    MenuCodeFinal = await ensureUniqueCode(MenuCodeFinal);

    // =========================
    // AUTO-GENERATE parent, MenuType, MenuLevel, OrderPosition
    // =========================
    let parent = null;
    if (ParentId != null) {
      parent = await this.getMenuById(ParentId);
      if (!parent) throw badReq("ParentId not found");
    }

    // MenuType:
    // - root + route kosong => GROUP
    // - selain itu default => MENU
    let MenuTypeFinal = MenuType;
    if (!MenuTypeFinal) {
      if (!parent && !Route) MenuTypeFinal = "GROUP";
      else MenuTypeFinal = "MENU";
    }

    // MenuLevel:
    // - parent => parent.MenuLevel + 1
    // - root => 1
    let MenuLevelFinal = MenuLevel;
    if (!Number.isFinite(MenuLevelFinal) || MenuLevelFinal <= 0) {
      const parentLevel = parent ? Number(parent.MenuLevel ?? 1) : 0;
      MenuLevelFinal = parent ? parentLevel + 1 : 1;
    }

    // OrderPosition:
    // - kalau invalid => max sibling + 1
    let OrderPositionFinal = OrderPosition;
    if (!Number.isFinite(OrderPositionFinal) || OrderPositionFinal <= 0) {
      const maxSql = `
      SELECT COALESCE(MAX("M_OrderPosition"), 0)::int AS maxpos
      FROM menus
      WHERE (
        (:pid::bigint IS NULL AND "M_ParentId" IS NULL)
        OR ("M_ParentId" = :pid)
      )
    `;
      const [maxRows] = await sequelize.query(maxSql, {
        replacements: { pid: ParentId == null ? null : ParentId },
      });
      const maxPos = Number(maxRows?.[0]?.maxpos ?? 0);
      OrderPositionFinal = maxPos + 1;
    }

    // ====== final validations ======
    if (!MenuTypeFinal) throw badReq("MenuType is required");
    if (MenuTypeFinal !== "GROUP" && !Route) {
      throw badReq("Route is required (non-GROUP)");
    }

    // ====== unique check (Route) ======
    // (MenuCode sudah kita pastikan unique di ensureUniqueCode)
    if (Route) {
      const routeCheckSql = `
      SELECT 1
      FROM menus
      WHERE "M_Route" = :route
      LIMIT 1
    `;
      const [routeRows] = await sequelize.query(routeCheckSql, {
        replacements: { route: Route },
      });
      if (routeRows?.length) throw conflict("Route already exists");
    }

    // ====== insert ======
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
          MenuCode: MenuCodeFinal,
          MenuName,
          ParentId,
          Route: Route || "",
          MenuType: MenuTypeFinal,
          Icon,
          MenuLevel: MenuLevelFinal,
          OrderPosition: OrderPositionFinal,
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

  /** =========================
   * PUT /menus/:id
   * - MenuCode NOT NULL: if empty/null => auto-generate (unique)
   * - Auto: MenuType/MenuLevel/OrderPosition when needed
   * ========================= */
  async updateMenu(id, payload, actor = "system") {
    // ===== helpers =====
    function slugToCode(name) {
      return String(name || "")
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
    }

    async function ensureUniqueCodeForUpdate(baseCode, selfId) {
      let code = String(baseCode || "").slice(0, 50);
      if (!code) throw badReq("MenuCode is required");

      const sql = `SELECT 1 FROM menus WHERE "M_Code" = :code AND "M_Id" <> :id LIMIT 1`;

      for (let i = 0; i <= 50; i++) {
        const candidate =
          i === 0
            ? code
            : (() => {
                const suffix = `_${i}`;
                const cut = 50 - suffix.length;
                return `${code.slice(0, cut)}${suffix}`;
              })();

        const [rows] = await sequelize.query(sql, {
          replacements: { code: candidate, id: selfId },
        });

        if (!rows?.length) return candidate;
      }

      throw conflict("MenuCode already exists");
    }

    async function nextSiblingOrder(parentId) {
      const maxSql = `
      SELECT COALESCE(MAX("M_OrderPosition"), 0)::int AS maxpos
      FROM menus
      WHERE (
        (:pid::bigint IS NULL AND "M_ParentId" IS NULL)
        OR ("M_ParentId" = :pid)
      )
    `;
      const [maxRows] = await sequelize.query(maxSql, {
        replacements: { pid: parentId == null ? null : parentId },
      });
      const maxPos = Number(maxRows?.[0]?.maxpos ?? 0);
      return maxPos + 1;
    }

    // ===== base =====
    const menuId = toStr(id);
    if (!menuId) throw badReq("menuId is required");

    const existing = await this.getMenuById(menuId);
    if (!existing) throw notFound("Menu not found");

    // ===== pick raw =====
    const MenuCodeRaw = pick(payload, [
      "MenuCode",
      "menuCode",
      "code",
      "M_Code",
    ]);
    const MenuNameRaw = pick(payload, [
      "MenuName",
      "menuName",
      "name",
      "M_Name",
    ]);
    const ParentIdRaw = pick(payload, ["ParentId", "parentId", "M_ParentId"]);
    const RouteRaw = pick(payload, ["Route", "route", "M_Route"]);
    const MenuTypeRaw = pick(payload, [
      "MenuType",
      "menuType",
      "type",
      "M_MenuType",
    ]);
    const IconRaw = pick(payload, ["Icon", "icon", "M_Icon"]);
    const MenuLevelRaw = pick(payload, [
      "MenuLevel",
      "menuLevel",
      "M_MenuLevel",
    ]);
    const OrderPositionRaw = pick(payload, [
      "OrderPosition",
      "orderPosition",
      "M_OrderPosition",
    ]);
    const IsActiveRaw = pick(payload, [
      "IsActive",
      "isActive",
      "active",
      "M_Active",
    ]);

    // ===== parse "provided?" flags =====
    const hasMenuCode = MenuCodeRaw !== undefined;
    const hasMenuName = MenuNameRaw !== undefined;
    const hasParentId = ParentIdRaw !== undefined;
    const hasRoute = RouteRaw !== undefined;
    const hasMenuType = MenuTypeRaw !== undefined;
    const hasIcon = IconRaw !== undefined;
    const hasMenuLevel = MenuLevelRaw !== undefined;
    const hasOrderPosition = OrderPositionRaw !== undefined;
    const hasIsActive = IsActiveRaw !== undefined;

    const hasAny =
      hasMenuCode ||
      hasMenuName ||
      hasParentId ||
      hasRoute ||
      hasMenuType ||
      hasIcon ||
      hasMenuLevel ||
      hasOrderPosition ||
      hasIsActive;

    if (!hasAny) throw badReq("at least one field must be provided");

    // ===== normalize values (undefined means "not provided") =====
    let MenuName = hasMenuName ? toStr(MenuNameRaw) : undefined;
    let Route = hasRoute ? toStr(RouteRaw) : undefined;
    let MenuType = hasMenuType ? toStr(MenuTypeRaw) : undefined;
    let Icon = hasIcon ? toStr(IconRaw) : undefined;

    let ParentId = !hasParentId
      ? undefined
      : ParentIdRaw == null || ParentIdRaw === ""
        ? null
        : toInt(ParentIdRaw, NaN);

    let MenuLevel = !hasMenuLevel ? undefined : toInt(MenuLevelRaw, NaN);
    let OrderPosition = !hasOrderPosition
      ? undefined
      : toInt(OrderPositionRaw, NaN);
    let IsActive = !hasIsActive ? undefined : toBoolOrNull(IsActiveRaw);

    // MenuCode: "" => null (tapi DB NOT NULL, nanti kita auto-generate)
    let MenuCode = !hasMenuCode
      ? undefined
      : normalizeOptionalCode(MenuCodeRaw);

    // ===== basic validations =====
    if (MenuName !== undefined && !MenuName)
      throw badReq("MenuName cannot be empty");
    if (MenuType !== undefined && !MenuType)
      throw badReq("MenuType cannot be empty");

    if (
      ParentId !== undefined &&
      ParentId !== null &&
      !Number.isFinite(ParentId)
    ) {
      throw badReq("ParentId must be number");
    }

    if (MenuLevel !== undefined && !Number.isFinite(MenuLevel)) {
      throw badReq("MenuLevel must be number");
    }

    if (OrderPosition !== undefined && !Number.isFinite(OrderPosition)) {
      throw badReq("OrderPosition must be number");
    }

    if (hasIsActive && IsActive === null) {
      throw badReq("IsActive must be boolean");
    }

    // self parent check
    if (ParentId !== undefined) {
      if (ParentId === Number(menuId)) throw badReq("ParentId cannot be self");
    }

    // ===== resolve Parent (if changed) =====
    const nextParentId =
      ParentId !== undefined ? ParentId : (existing.ParentId ?? null);
    let parent = null;

    if (nextParentId != null) {
      parent = await this.getMenuById(nextParentId);
      if (!parent) throw badReq("ParentId not found");
    }

    // ===== resolve final field values (apply defaults/auto) =====
    const MenuNameFinal =
      MenuName !== undefined ? MenuName : String(existing.MenuName ?? "");
    const RouteFinal =
      Route !== undefined ? Route : String(existing.Route ?? "");
    let MenuTypeFinal =
      MenuType !== undefined ? MenuType : String(existing.MenuType ?? "");

    // Auto MenuType if empty
    if (!MenuTypeFinal) {
      if (!parent && !RouteFinal) MenuTypeFinal = "GROUP";
      else MenuTypeFinal = "MENU";
    }

    // Route rules (non-GROUP must have route)
    if (MenuTypeFinal !== "GROUP" && !RouteFinal) {
      throw badReq("Route cannot be empty (non-GROUP)");
    }

    // MenuLevel: if provided invalid/<=0 OR parent changed OR MenuLevel provided explicitly
    let MenuLevelFinal =
      MenuLevel !== undefined ? MenuLevel : Number(existing.MenuLevel ?? NaN);

    const parentChanged =
      ParentId !== undefined &&
      String(existing.ParentId ?? "") !== String(nextParentId ?? "");
    if (
      !Number.isFinite(MenuLevelFinal) ||
      MenuLevelFinal <= 0 ||
      parentChanged
    ) {
      const parentLevel = parent ? Number(parent.MenuLevel ?? 1) : 0;
      MenuLevelFinal = parent ? parentLevel + 1 : 1;
    }

    // OrderPosition: if provided invalid/<=0 OR (parent changed and order not provided)
    let OrderPositionFinal =
      OrderPosition !== undefined
        ? OrderPosition
        : Number(existing.OrderPosition ?? NaN);

    if (
      !Number.isFinite(OrderPositionFinal) ||
      OrderPositionFinal <= 0 ||
      (parentChanged && OrderPosition === undefined)
    ) {
      OrderPositionFinal = await nextSiblingOrder(nextParentId);
    }

    // MenuCode: DB NOT NULL
    // - if explicitly provided as ''/null => auto-generate
    // - if not provided => keep existing
    let MenuCodeFinal =
      MenuCode !== undefined ? MenuCode : String(existing.MenuCode ?? "");

    if (!MenuCodeFinal) {
      MenuCodeFinal = slugToCode(MenuNameFinal);
    }

    // ensure unique (exclude self)
    MenuCodeFinal = await ensureUniqueCodeForUpdate(MenuCodeFinal, menuId);

    // ===== unique check Route (only if changed/provided, and non-empty) =====
    if (Route !== undefined && RouteFinal) {
      const routeCheckSql = `
      SELECT 1
      FROM menus
      WHERE "M_Route" = :route
        AND "M_Id" <> :id
      LIMIT 1
    `;
      const [routeRows] = await sequelize.query(routeCheckSql, {
        replacements: { route: RouteFinal, id: menuId },
      });
      if (routeRows?.length) throw conflict("Route already exists");
    }

    // ===== build update sets only for changed fields =====
    const sets = [];
    const replacements = { id: menuId, UpdatedBy: actor };

    // always update UpdatedBy/UpdatedAt
    sets.push(`"M_UpdatedBy" = :UpdatedBy`);
    sets.push(`"M_UpdatedAt" = NOW()`);

    // update fields (even if not "provided") when auto-changed is needed
    // 1) MenuCodeFinal might be auto-changed
    if (MenuCodeFinal !== String(existing.MenuCode ?? "")) {
      sets.push(`"M_Code" = :MenuCode`);
      replacements.MenuCode = MenuCodeFinal;
    } else if (MenuCode !== undefined) {
      // provided but same => still ok to set
      sets.push(`"M_Code" = :MenuCode`);
      replacements.MenuCode = MenuCodeFinal;
    }

    if (MenuNameFinal !== String(existing.MenuName ?? "")) {
      sets.push(`"M_Name" = :MenuName`);
      replacements.MenuName = MenuNameFinal;
    } else if (MenuName !== undefined) {
      sets.push(`"M_Name" = :MenuName`);
      replacements.MenuName = MenuNameFinal;
    }

    if (String(nextParentId ?? "") !== String(existing.ParentId ?? "")) {
      sets.push(`"M_ParentId" = :ParentId`);
      replacements.ParentId = nextParentId;
    } else if (ParentId !== undefined) {
      sets.push(`"M_ParentId" = :ParentId`);
      replacements.ParentId = nextParentId;
    }

    if (RouteFinal !== String(existing.Route ?? "")) {
      sets.push(`"M_Route" = :Route`);
      replacements.Route = RouteFinal;
    } else if (Route !== undefined) {
      sets.push(`"M_Route" = :Route`);
      replacements.Route = RouteFinal;
    }

    if (MenuTypeFinal !== String(existing.MenuType ?? "")) {
      sets.push(`"M_MenuType" = :MenuType`);
      replacements.MenuType = MenuTypeFinal;
    } else if (MenuType !== undefined) {
      sets.push(`"M_MenuType" = :MenuType`);
      replacements.MenuType = MenuTypeFinal;
    }

    if (Icon !== undefined) {
      sets.push(`"M_Icon" = :Icon`);
      replacements.Icon = Icon;
    }

    if (MenuLevelFinal !== Number(existing.MenuLevel ?? NaN)) {
      sets.push(`"M_MenuLevel" = :MenuLevel`);
      replacements.MenuLevel = MenuLevelFinal;
    } else if (MenuLevel !== undefined) {
      sets.push(`"M_MenuLevel" = :MenuLevel`);
      replacements.MenuLevel = MenuLevelFinal;
    }

    if (OrderPositionFinal !== Number(existing.OrderPosition ?? NaN)) {
      sets.push(`"M_OrderPosition" = :OrderPosition`);
      replacements.OrderPosition = OrderPositionFinal;
    } else if (OrderPosition !== undefined) {
      sets.push(`"M_OrderPosition" = :OrderPosition`);
      replacements.OrderPosition = OrderPositionFinal;
    }

    if (IsActive !== undefined) {
      sets.push(`"M_Active" = :IsActive`);
      replacements.IsActive = IsActive;
    }

    // nothing to update except UpdatedAt? avoid noisy update
    // (optional) but we keep it simple: allow update anyway

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

  /** =========================
   * DELETE /menus/:id
   * ========================= */
  async deleteMenu(id) {
    const menuId = toStr(id);
    if (!menuId) throw badReq("menuId is required");

    const existing = await this.getMenuById(menuId);
    if (!existing) throw notFound("Menu not found");

    const childSql = `SELECT 1 FROM menus WHERE "M_ParentId" = :id LIMIT 1`;
    const [childRows] = await sequelize.query(childSql, {
      replacements: { id: menuId },
    });
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

  /** =========================
   * GET /menus/lookup
   * return flat list for select parent
   *
   * query params (optional):
   * - searchTerm: string
   * - includeInactive: true/false (default false)
   * - limit: number (default 500, max 2000)
   * - excludeId: string/number (exclude current menu id when edit)
   * - onlyParents: true/false (default false) -> only nodes that can act as parent (has children OR MenuType=GROUP)
   * ========================= */
  async listMenuLookup(query) {
    const searchTerm = String(query.searchTerm || "").trim();

    const includeInactive = toBoolOrNull(query.includeInactive) === true;

    const excludeIdRaw = toStr(query.excludeId);
    const excludeId = excludeIdRaw ? toInt(excludeIdRaw, NaN) : NaN;

    const onlyParents = toBoolOrNull(query.onlyParents) === true;

    const limit = clamp(toInt(query.limit, 500), 1, 2000);

    const replacements = { limit };

    // ====== CTE title_path + order_path (stable order) ======
    // order_path = based on OrderPosition + Id (biar urut mirip tree)
    const sql = `
      WITH RECURSIVE t AS (
        SELECT
          m."M_Id" AS "Id",
          m."M_ParentId" AS "ParentId",
          m."M_Name" AS "Name",
          m."M_Code" AS "Code",
          m."M_MenuType" AS "MenuType",
          m."M_Active" AS "IsActive",
          m."M_OrderPosition" AS "OrderPosition",
          m."M_Name"::text AS title_path,
          (LPAD(COALESCE(m."M_OrderPosition", 0)::text, 6, '0') || '.' || LPAD(m."M_Id"::text, 10, '0'))::text AS order_path
        FROM menus m
        WHERE m."M_ParentId" IS NULL

        UNION ALL

        SELECT
          c."M_Id" AS "Id",
          c."M_ParentId" AS "ParentId",
          c."M_Name" AS "Name",
          c."M_Code" AS "Code",
          c."M_MenuType" AS "MenuType",
          c."M_Active" AS "IsActive",
          c."M_OrderPosition" AS "OrderPosition",
          (t.title_path || ' > ' || c."M_Name")::text AS title_path,
          (t.order_path || '/' ||
            (LPAD(COALESCE(c."M_OrderPosition", 0)::text, 6, '0') || '.' || LPAD(c."M_Id"::text, 10, '0'))
          )::text AS order_path
        FROM menus c
        JOIN t ON c."M_ParentId" = t."Id"
      ),
      child_counts AS (
        SELECT "M_ParentId" AS "ParentId", COUNT(*)::int AS cnt
        FROM menus
        GROUP BY "M_ParentId"
      )
      SELECT
        t."Id"::text AS "MenuId",
        t.title_path AS "MenuTitle"
      FROM t
      LEFT JOIN child_counts cc ON cc."ParentId" = t."Id"
      WHERE 1=1
        ${includeInactive ? "" : `AND t."IsActive" = true`}
        ${Number.isFinite(excludeId) ? `AND t."Id" <> :excludeId` : ""}
        ${
          onlyParents
            ? `AND (COALESCE(cc.cnt, 0) > 0 OR UPPER(COALESCE(t."MenuType",''))
                 = 'GROUP')`
            : ""
        }
        ${
          searchTerm
            ? `AND (
                t.title_path ILIKE :q
                OR COALESCE(t."Code",'') ILIKE :q
              )`
            : ""
        }
      ORDER BY t.order_path ASC
      LIMIT :limit
    `;

    if (Number.isFinite(excludeId)) replacements.excludeId = excludeId;
    if (searchTerm) replacements.q = `%${searchTerm}%`;

    const [rows] = await sequelize.query(sql, { replacements });

    return {
      records: rows || [],
    };
  },
};
