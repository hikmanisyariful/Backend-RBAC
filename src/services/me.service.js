// src/services/me.service.js
// Build response for GET /me/menu
// - Uses current schema (menus, roles, users, role_menu_permissions + items, user_menu_permissions + items)
// - Output shape follows FE DTO:
//   groups[].items[] => DTOParentMenuProps (PM_*)
//   PM_Items[]       => DTOChildrenMenuProps (CM_*)

const { sequelize } = require("../config/db");
const { ok, fail } = require("../utils/response");
// const { getEffectivePermissionCodesByUserAndRole } = require("./rbac.read.service");

function nowISO() {
  return new Date().toISOString();
}

function uniq(arr) {
  return [...new Set(arr)];
}

/**
 * permission format: MENU_CODE.ACTION
 * Example: SETTINGS_ROLE.VIEW
 * Result: { SETTINGS_ROLE: ["SETTINGS_ROLE.VIEW", ...], ... }
 */
function buildPermissionIndex(permissionCodes) {
  const idx = {};
  for (const codeRaw of permissionCodes || []) {
    const code = String(codeRaw);
    const dot = code.indexOf(".");
    if (dot <= 0) continue;

    const menuCode = code.slice(0, dot);
    if (!idx[menuCode]) idx[menuCode] = [];
    idx[menuCode].push(code);
  }

  Object.keys(idx).forEach((k) => (idx[k] = uniq(idx[k])));
  return idx;
}

function canView(permissionIndex, menuCode) {
  const list = permissionIndex?.[menuCode] || [];
  return list.includes(`${menuCode}.VIEW`);
}

function sortByOrderThenId(a, b) {
  const ao = Number(a.order ?? 0);
  const bo = Number(b.order ?? 0);
  if (ao !== bo) return ao - bo;
  return Number(a.id ?? 0) - Number(b.id ?? 0);
}

function normalizeMenuRow(m) {
  return {
    id: Number(m.M_Id),
    code: m.M_Code,
    title: m.M_Name,
    icon: m.M_Icon || "",
    route: m.M_Route || "",
    level: Number(m.M_MenuLevel),
    parentId: m.M_ParentId == null ? null : Number(m.M_ParentId),
    order: Number(m.M_OrderPosition ?? 0),
    active: !!m.M_Active,
  };
}

/**
 * Build groups[] with FE DTO shape:
 * group: { code,title,icon,order, items: DTOParentMenuProps[] }
 *
 * Rules:
 * - level1 = GROUP nodes
 * - level2:
 *   - if leaf (has route, no children) => show if has VIEW on that menuCode
 *   - if parent (route empty or has children) => show only if any child visible
 * - level3 (submenu): show if has VIEW on submenu code
 */
function buildTreeDTO({ menus, permissionIndex }) {
  // Build children map by parentId
  const childrenByParent = new Map(); // key: parentId|0 -> normalized children

  for (const raw of menus || []) {
    const m = normalizeMenuRow(raw);
    const pid = m.parentId ?? 0;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(m);
  }

  // sort children lists
  for (const [k, list] of childrenByParent.entries()) {
    list.sort(sortByOrderThenId);
    childrenByParent.set(k, list);
  }

  // get groups = level1
  const groupsLevel1 = (menus || [])
    .map(normalizeMenuRow)
    .filter((m) => m.level === 1 && m.active)
    .sort(sortByOrderThenId);

  const groups = [];

  for (const g of groupsLevel1) {
    const level2 = (childrenByParent.get(g.id) || []).filter(
      (x) => x.level === 2 && x.active,
    );

    const items = []; // DTOParentMenuProps[]

    for (const m2 of level2) {
      const level3 = (childrenByParent.get(m2.id) || []).filter(
        (x) => x.level === 3 && x.active,
      );

      // CASE A: level2 leaf link (Dashboard/Notification)
      if (m2.route && m2.route !== "" && level3.length === 0) {
        if (canView(permissionIndex, m2.code)) {
          items.push({
            PM_Id: m2.id,
            PM_Title: m2.title,
            PM_URL: m2.route,
            PM_Icon: m2.icon,
            PM_Slug: m2.code,
            PM_Active: m2.active,
            PM_MenuOrder: m2.order,
            PM_Items: [],
          });
        }
        continue;
      }

      // CASE B: level2 parent with children (Settings)
      const PM_Items = []; // DTOChildrenMenuProps[]

      for (const c of level3) {
        if (!c.route || c.route === "") continue; // submenu must have route
        if (!canView(permissionIndex, c.code)) continue;

        PM_Items.push({
          CM_Id: c.id,
          CM_ParentId: String(m2.id),
          CM_ParentEntity: null, // keep null to reduce payload, FE sidebar doesn't need it
          CM_Code: c.code,
          CM_Title: c.title,
          CM_URL: c.route,
          CM_Icon: c.icon,
          CM_Active: c.active,
          CM_MenuOrder: c.order,
        });
      }

      PM_Items.sort((a, b) => a.CM_MenuOrder - b.CM_MenuOrder);

      // Parent visible only if has at least 1 visible child
      if (PM_Items.length > 0) {
        items.push({
          PM_Id: m2.id,
          PM_Title: m2.title,
          PM_URL: "", // parent container, usually no route
          PM_Icon: m2.icon,
          PM_Slug: m2.code,
          PM_Active: m2.active,
          PM_MenuOrder: m2.order,
          PM_Items,
        });
      }
    }

    items.sort((a, b) => a.PM_MenuOrder - b.PM_MenuOrder);

    if (items.length > 0) {
      groups.push({
        code: g.code,
        title: g.title,
        icon: g.icon,
        order: g.order,
        items,
      });
    }
  }

  groups.sort((a, b) => a.order - b.order);
  return groups;
}

async function getUserAndRole({ userId, roleId }) {
  // If roleId is missing in token, resolve from users table
  const [rows] = await sequelize.query(
    `SELECT "U_Id","U_RoleId" FROM users WHERE "U_Id" = :userId LIMIT 1`,
    { replacements: { userId } },
  );

  if (!rows || rows.length === 0) {
    throw new Error("User not found");
  }

  const dbRoleId = Number(rows[0].U_RoleId);
  return {
    userId: Number(rows[0].U_Id),
    roleId: roleId ? Number(roleId) : dbRoleId,
  };
}

async function getRoleCode(roleId) {
  const [rows] = await sequelize.query(
    `SELECT "R_Code" FROM roles WHERE "R_Id" = :roleId LIMIT 1`,
    { replacements: { roleId } },
  );

  return rows?.[0]?.R_Code || "";
}

async function getEffectivePermissionCodesByUserAndRole({ userId, roleId }) {
  const [rolePermRows] = await sequelize.query(
    `
    SELECT DISTINCT p."P_Code"
    FROM role_menu_permissions rmp
    JOIN role_menu_permission_items rmpi ON rmpi."RMP_Id" = rmp."RMP_Id"
    JOIN permissions p ON p."P_Id" = rmpi."P_Id"
    WHERE rmp."RoleId" = :roleId
    `,
    { replacements: { roleId } },
  );

  const [userPermRows] = await sequelize.query(
    `
    SELECT DISTINCT p."P_Code"
    FROM user_menu_permissions ump
    JOIN user_menu_permission_items umpi ON umpi."UMP_Id" = ump."UMP_Id"
    JOIN permissions p ON p."P_Id" = umpi."P_Id"
    WHERE ump."U_Id" = :userId
    `,
    { replacements: { userId } },
  );

  const roleCodes = (rolePermRows || []).map((r) => r.P_Code);
  const userCodes = (userPermRows || []).map((r) => r.P_Code);

  const effective = uniq([...roleCodes, ...userCodes]);

  return {
    granted: uniq(roleCodes),
    userExtra: uniq(userCodes),
    effective,
  };
}

async function getEffectivePermissionCodes({ userId, roleId }) {
  const { effective } = await getEffectivePermissionCodesByUserAndRole({
    userId,
    roleId,
  });

  return effective;
}

async function getActiveMenus() {
  const [rows] = await sequelize.query(
    `
    SELECT
      "M_Id","M_Code","M_Name","M_ParentId","M_Route","M_Icon",
      "M_MenuLevel","M_OrderPosition","M_Active"
    FROM menus
    WHERE "M_Active" = true
    ORDER BY "M_MenuLevel" ASC, "M_OrderPosition" ASC, "M_Id" ASC
    `,
  );

  return rows || [];
}

/**
 * Public: Build Record payload for /me/menu
 * Input:
 *  - userId (required)
 *  - roleId (optional; if not provided, resolved from users.U_RoleId)
 */
async function buildMyMenuResponse({ userId, roleId }) {
  const resolved = await getUserAndRole({ userId, roleId });
  const roleCode = await getRoleCode(resolved.roleId);

  const permissionCodes = await getEffectivePermissionCodes({
    userId: resolved.userId,
    roleId: resolved.roleId,
  });

  const permissionIndex = buildPermissionIndex(permissionCodes);
  const menus = await getActiveMenus();

  // groups[] follow FE DTO shape
  const groups = buildTreeDTO({ menus, permissionIndex });

  return {
    generatedAt: nowISO(),
    roleCode,
    groups,
    permissionIndex,
  };
}

async function getUserProfile(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return fail("Invalid userId", 400);

  // 1) ambil user + role
  const [rows] = await sequelize.query(
    `
    SELECT
      u."U_Id"        AS "Id",
      u."U_Email"     AS "Email",
      u."U_FullName"  AS "FullName",
      u."U_Active"    AS "Active",
      r."R_Id"        AS "RoleId",
      r."R_Code"      AS "RoleCode",
      r."R_Name"      AS "RoleName"
    FROM users u
    JOIN roles r ON r."R_Id" = u."U_RoleId"
    WHERE u."U_Id" = :userId
    LIMIT 1
    `,
    { replacements: { userId: id } },
  );

  if (!rows.length) return fail("User not found", 404);

  const u = rows[0];
  if (!u.Active) return fail("User is inactive", 403);

  // 2) ambil business units dari user_org_mappings (distinct)
  const [buRows] = await sequelize.query(
    `
    SELECT DISTINCT
      bu."BU_Id"   AS "BusinessUnitId",
      bu."BU_Code" AS "BusinessUnitCode",
      bu."BU_Name" AS "BusinessUnitName"
    FROM user_org_mappings uom
    JOIN business_units bu ON bu."BU_Id" = uom.business_unit_id
    WHERE uom.user_id = :userId
    ORDER BY bu."BU_Name" ASC
    `,
    { replacements: { userId: id } },
  );

  const profile = {
    Id: u.Id,
    Email: u.Email,
    FullName: u.FullName,
    Role: {
      RoleId: u.RoleId,
      RoleCode: u.RoleCode,
      RoleName: u.RoleName,
    },
    BusinessUnits: buRows ?? [],
  };

  return ok({ Record: profile }, "OK", 200);
}

module.exports = {
  buildMyMenuResponse,
  getUserProfile,
};
