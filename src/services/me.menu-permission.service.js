// src/services/me.menu-permission.service.js

"use strict";

const { sequelize } = require("../config/db");
const { fail } = require("../utils/response");

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

function sortByOrderThenId(a, b) {
  const ao = Number(a.OrderPosition ?? 0);
  const bo = Number(b.OrderPosition ?? 0);
  if (ao !== bo) return ao - bo;
  return String(a.Id).localeCompare(String(b.Id));
}

function canView(permissionIndex, menuCode) {
  const list = permissionIndex?.[menuCode] || [];
  return list.includes(`${menuCode}.VIEW`);
}

/**
 * Map DB row (menus table) -> MenuDataApi (FE)
 */
function normalizeMenuDataApiRow(m) {
  return {
    Id: String(m.M_Id),
    MenuCode: String(m.M_Code || ""),
    MenuName: String(m.M_Name || ""),
    ParentId: m.M_ParentId == null ? undefined : String(m.M_ParentId),
    Route: String(m.M_Route || ""),
    MenuType: String(m.M_MenuType || m.M_Type || "Menu"),
    Icon: m.M_Icon ? String(m.M_Icon) : undefined,
    MenuLevel: Number(m.M_MenuLevel ?? 0),
    OrderPosition: Number(m.M_OrderPosition ?? 0),
    IsActive: !!m.M_Active,
    IsSelected: false,

    CreatedAt: m.M_CreatedAt ? new Date(m.M_CreatedAt).toISOString() : nowISO(),
    UpdatedAt: m.M_UpdatedAt ? new Date(m.M_UpdatedAt).toISOString() : nowISO(),
    CreatedBy: m.M_CreatedBy ? String(m.M_CreatedBy) : undefined,
    UpdatedBy: m.M_UpdatedBy ? String(m.M_UpdatedBy) : undefined,
  };
}

/**
 * Build tree MenuTreeDataApi[] from flat MenuDataApi[]
 */
function buildMenuTree(flatMenus) {
  const byId = new Map();
  const roots = [];

  for (const m of flatMenus) {
    byId.set(m.Id, { ...m, Children: [] });
  }

  for (const m of byId.values()) {
    if (m.ParentId && byId.has(m.ParentId)) {
      byId.get(m.ParentId).Children.push(m);
    } else {
      roots.push(m);
    }
  }

  function sortNode(node) {
    if (node.Children && node.Children.length) {
      node.Children.sort(sortByOrderThenId);
      node.Children.forEach(sortNode);
    } else {
      delete node.Children;
    }
  }

  roots.sort(sortByOrderThenId);
  roots.forEach(sortNode);

  return roots;
}

/**
 * Filter menu tree by VIEW permission.
 * Rules:
 * - Node with Children: keep only visible children; keep node if children remain.
 * - Leaf node: keep only if canView(menuCode) AND Route not empty.
 */
function filterMenuTreeByPermission(nodes, permissionIndex) {
  const walk = (node) => {
    const children = Array.isArray(node.Children) ? node.Children : [];

    // Has children -> filter them first
    if (children.length > 0) {
      const filteredChildren = children.map(walk).filter(Boolean);
      if (filteredChildren.length === 0) return null;

      return {
        ...node,
        Children: filteredChildren,
      };
    }

    // Leaf -> must have VIEW
    if (!node.MenuCode) return null;
    if (!canView(permissionIndex, node.MenuCode)) return null;

    // Leaf should have route (remove this if you want leaf without route to show)
    if (!node.Route || node.Route === "") return null;

    return { ...node };
  };

  return (nodes || []).map(walk).filter(Boolean);
}

/**
 * Collect visible MenuCode from filtered tree
 */
function collectMenuCodesFromTree(nodes, out = new Set()) {
  for (const n of nodes || []) {
    if (n?.MenuCode) out.add(n.MenuCode);
    if (Array.isArray(n.Children)) collectMenuCodesFromTree(n.Children, out);
  }
  return out;
}

/**
 * Resolve userId + roleId
 */
async function getUserAndRole({ userId, roleId }) {
  const [rows] = await sequelize.query(
    `SELECT "U_Id","U_RoleId" FROM users WHERE "U_Id" = :userId LIMIT 1`,
    { replacements: { userId } },
  );

  if (!rows || rows.length === 0) throw new Error("User not found");

  const dbRoleId = Number(rows[0].U_RoleId);
  return {
    userId: Number(rows[0].U_Id),
    roleId: roleId ? Number(roleId) : dbRoleId,
  };
}

/**
 * Effective permissions (role + user extra)
 */
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

/**
 * Ambil menu aktif.
 */
async function getActiveMenus() {
  const [rows] = await sequelize.query(
    `
    SELECT
      "M_Id","M_Code","M_Name","M_ParentId","M_Route","M_Icon",
      "M_MenuLevel","M_OrderPosition","M_Active",
      "M_MenuType",
      "M_CreatedAt","M_UpdatedAt","M_CreatedBy","M_UpdatedBy"
    FROM menus
    WHERE "M_Active" = true
    ORDER BY "M_MenuLevel" ASC, "M_OrderPosition" ASC, "M_Id" ASC
    `,
  );

  return rows || [];
}

/**
 * Build Permissions[] sesuai format:
 * { MenuId, MenuCode, MenuUrl, PermissionCodes[] }
 */
function buildPermissionsList({ flatMenus, permissionIndex }) {
  const byCode = new Map(flatMenus.map((m) => [m.MenuCode, m]));
  const permissions = [];

  for (const [menuCode, codes] of Object.entries(permissionIndex || {})) {
    const menu = byCode.get(menuCode);

    permissions.push({
      MenuId: menu ? String(menu.Id) : "",
      MenuCode: menuCode,
      MenuUrl: menu ? String(menu.Route || "") : "",
      PermissionCodes: uniq(codes || []),
    });
  }

  permissions.sort((a, b) => a.MenuCode.localeCompare(b.MenuCode));
  return permissions;
}

/**
 * Public: Build Record payload for GET /menus/menu-permission
 * Record: { generatedAt, Menus, Permissions }
 */
async function buildMyMenuPermissionResponse({ userId, roleId }) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return fail("Invalid userId", 400);

  const resolved = await getUserAndRole({ userId: id, roleId });

  const { effective } = await getEffectivePermissionCodesByUserAndRole({
    userId: resolved.userId,
    roleId: resolved.roleId,
  });

  const permissionIndex = buildPermissionIndex(effective);

  // menus (flat -> tree)
  const menuRows = await getActiveMenus();
  const flatMenus = (menuRows || []).map(normalizeMenuDataApiRow);

  const rawTree = buildMenuTree(flatMenus);

  // ✅ filter tree by VIEW permissions
  const Menus = filterMenuTreeByPermission(rawTree, permissionIndex);

  // ✅ Permissions only for visible menus
  const visibleCodes = collectMenuCodesFromTree(Menus);
  const Permissions = buildPermissionsList({
    flatMenus,
    permissionIndex,
  }).filter((p) => visibleCodes.has(p.MenuCode));

  return {
    generatedAt: nowISO(),
    Menus,
    Permissions,
  };
}

module.exports = {
  buildMyMenuPermissionResponse,
};