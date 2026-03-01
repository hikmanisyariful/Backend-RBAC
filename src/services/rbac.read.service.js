"use strict";

const { sequelize } = require("../config/db");

/* =========================
 * Error Helpers (standardized)
 * ========================= */
function badReq(message, exception) {
  const e = new Error(message);
  e.isBadRequest = true;
  if (exception) e.exception = exception;
  return e;
}

function notFound(message, exception) {
  const e = new Error(message);
  e.isNotFound = true;
  if (exception) e.exception = exception;
  return e;
}

function conflict(message, exception) {
  const e = new Error(message);
  e.isConflict = true;
  if (exception) e.exception = exception;
  return e;
}

/* =========================
 * Primitive Helpers
 * ========================= */
function toStr(v) {
  return String(v ?? "").trim();
}

function normalizeCode(v) {
  return toStr(v).toUpperCase();
}

function uniqueStringArray(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => toStr(x)).filter(Boolean))];
}

function splitMenuCodeFromPermission(permissionCode) {
  return String(permissionCode ?? "").split(".")[0];
}

function isPositiveIntegerString(v) {
  return /^\d+$/.test(toStr(v));
}

function toPositiveIntOrThrow(v, fieldName) {
  const s = toStr(v);
  if (!s) throw badReq(`${fieldName} is required`);
  if (!isPositiveIntegerString(s)) {
    throw badReq(`${fieldName} must be a numeric ID (BIGINT)`, {
      received: s,
      example: "1",
    });
  }
  return Number(s);
}

/* =========================
 * Shared DB Readers / Validators
 * ========================= */
async function getRoleByIdOrThrow(roleIdInput, options = {}) {
  const roleId = toPositiveIntOrThrow(roleIdInput, "roleId");

  const [rows] = await sequelize.query(
    `SELECT "R_Id","R_Code" FROM roles WHERE "R_Id" = :roleId LIMIT 1`,
    {
      replacements: { roleId },
      transaction: options.transaction,
    },
  );

  if (!rows.length) throw notFound(`Role not found: ${roleId}`);
  return rows[0];
}

async function getUserByIdOrThrow(userIdInput, options = {}) {
  const userId = toPositiveIntOrThrow(userIdInput, "userId");

  const [rows] = await sequelize.query(
    `
    SELECT "U_Id", "U_RoleId"
    FROM users
    WHERE "U_Id" = :userId
    LIMIT 1
    `,
    {
      replacements: { userId },
      transaction: options.transaction,
    },
  );

  if (!rows.length) throw notFound(`User not found: ${userId}`);
  return rows[0]; // { U_Id, U_RoleId }
}

/**
 * requestedRoleId is only used for exception details (help debug FE/route).
 */
function assertUserRoleMatches(userRow, roleRow, requestedRoleId) {
  if (String(userRow.U_RoleId) !== String(roleRow.R_Id)) {
    throw badReq("roleId does not match user's assigned role", {
      userId: userRow.U_Id,
      userRoleId: userRow.U_RoleId,
      requestedRoleId,
      requestedRoleCode: roleRow?.R_Code,
    });
  }
}

async function getActiveMenus(options = {}) {
  const [rows] = await sequelize.query(
    `
    SELECT "M_Id","M_Code","M_Name","M_ParentId","M_Route","M_MenuLevel","M_OrderPosition","M_Icon","M_Active"
    FROM menus
    WHERE "M_Active" = true
    ORDER BY "M_MenuLevel" ASC, "M_OrderPosition" ASC, "M_Id" ASC
    `,
    { transaction: options.transaction },
  );
  return rows || [];
}

async function getAllPermissions(options = {}) {
  const [rows] = await sequelize.query(
    `
    SELECT "P_Id","P_Code","P_Name"
    FROM permissions
    ORDER BY "P_Code" ASC
    `,
    { transaction: options.transaction },
  );
  return rows || [];
}

function buildPermissionLookup(permRows) {
  const permByCode = new Map();
  for (const p of permRows || []) {
    permByCode.set(String(p.P_Code), p);
  }
  return permByCode;
}

function buildActiveMenuLookup(menuRows) {
  const menuByCode = new Map();
  for (const m of menuRows || []) {
    menuByCode.set(String(m.M_Code), m);
  }
  return menuByCode;
}

function groupPermissionsByMenuCode(permRows) {
  const permsByMenuCode = new Map();

  for (const p of permRows || []) {
    const menuCode = splitMenuCodeFromPermission(p.P_Code);
    if (!permsByMenuCode.has(menuCode)) permsByMenuCode.set(menuCode, []);
    permsByMenuCode.get(menuCode).push({
      code: String(p.P_Code),
      name: String(p.P_Name ?? ""),
    });
  }

  return permsByMenuCode;
}

function validatePermissionCodesOrThrow(permissionCodes, permByCode, fieldName) {
  const invalidPermissions = (permissionCodes || []).filter(
    (code) => !permByCode.has(code),
  );
  if (invalidPermissions.length) {
    throw badReq(`Some ${fieldName} permissions are invalid`, {
      invalidPermissions,
    });
  }
}

function groupPermissionIdsByActiveMenuOrThrow(permissionCodes, permByCode, menuByCode) {
  const missingMenus = [];
  const groupedByMenuCode = new Map(); // menuCode -> { menuId, permissionIds[] }

  for (const pCode of permissionCodes || []) {
    const pRow = permByCode.get(pCode);
    const menuCode = splitMenuCodeFromPermission(pCode);
    const menuRow = menuByCode.get(menuCode);

    if (!menuRow) {
      missingMenus.push({ permission: pCode, menuCode });
      continue;
    }

    if (!groupedByMenuCode.has(menuCode)) {
      groupedByMenuCode.set(menuCode, {
        menuId: menuRow.M_Id,
        permissionIds: [],
      });
    }

    groupedByMenuCode.get(menuCode).permissionIds.push(pRow.P_Id);
  }

  if (missingMenus.length) {
    throw badReq("Some permission prefixes do not match active menu codes", {
      missingMenus,
    });
  }

  return groupedByMenuCode;
}

/* =========================
 * Shared permission readers
 * ========================= */
async function getRoleGrantedPermissionCodes({ roleId }, options = {}) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT p."P_Code"
    FROM role_menu_permissions rmp
    JOIN role_menu_permission_items rmpi ON rmpi."RMP_Id" = rmp."RMP_Id"
    JOIN permissions p ON p."P_Id" = rmpi."P_Id"
    WHERE rmp."RoleId" = :roleId
    ORDER BY p."P_Code" ASC
    `,
    {
      replacements: { roleId },
      transaction: options.transaction,
    },
  );

  return (rows || []).map((x) => String(x.P_Code));
}

async function getUserExtraPermissionCodes({ userId }, options = {}) {
  const [rows] = await sequelize.query(
    `
    SELECT DISTINCT p."P_Code"
    FROM user_menu_permissions ump
    JOIN user_menu_permission_items umpi ON umpi."UMP_Id" = ump."UMP_Id"
    JOIN permissions p ON p."P_Id" = umpi."P_Id"
    WHERE ump."U_Id" = :userId
    ORDER BY p."P_Code" ASC
    `,
    {
      replacements: { userId },
      transaction: options.transaction,
    },
  );

  return (rows || []).map((x) => String(x.P_Code));
}

/**
 * Single source of truth for effective permissions
 */
async function getEffectivePermissionCodesByUserAndRole({ userId, roleId }, options = {}) {
  const [roleGranted, userExtra] = await Promise.all([
    getRoleGrantedPermissionCodes({ roleId }, options),
    getUserExtraPermissionCodes({ userId }, options),
  ]);

  const effective = [...new Set([...roleGranted, ...userExtra])].sort();

  return {
    granted: roleGranted,
    userExtra,
    effective,
  };
}

function sortTreeByOrder(nodes) {
  nodes.sort((a, b) => {
    const ao = Number(a.order ?? 0);
    const bo = Number(b.order ?? 0);
    if (ao !== bo) return ao - bo;
    return Number(a.menuId ?? 0) - Number(b.menuId ?? 0);
  });
  for (const n of nodes) sortTreeByOrder(n.children);
}

module.exports = {
  // error helpers
  badReq,
  notFound,
  conflict,

  // primitive helpers
  toStr,
  normalizeCode,
  uniqueStringArray,
  splitMenuCodeFromPermission,
  isPositiveIntegerString,
  toPositiveIntOrThrow,

  // shared readers / validators
  getRoleByIdOrThrow,
  getUserByIdOrThrow,
  assertUserRoleMatches,
  getActiveMenus,
  getAllPermissions,
  buildPermissionLookup,
  buildActiveMenuLookup,
  groupPermissionsByMenuCode,
  validatePermissionCodesOrThrow,
  groupPermissionIdsByActiveMenuOrThrow,
  getRoleGrantedPermissionCodes,
  getUserExtraPermissionCodes,
  getEffectivePermissionCodesByUserAndRole,
  sortTreeByOrder,
};