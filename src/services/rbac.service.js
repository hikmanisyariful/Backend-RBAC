"use strict";

const { sequelize } = require("../config/db");
const {
  toStr,
  normalizeCode,
  uniqueStringArray,
  getRoleByCodeOrThrow,
  getUserByIdOrThrow,
  assertUserRoleMatches,
  getActiveMenus,
  getAllPermissions,
  buildPermissionLookup,
  buildActiveMenuLookup,
  groupPermissionsByMenuCode,
  validatePermissionCodesOrThrow,
  groupPermissionIdsByActiveMenuOrThrow,
  getEffectivePermissionCodesByUserAndRole,
  getRoleGrantedPermissionCodes,
  getUserExtraPermissionCodes,
  sortTreeByOrder,
} = require("./rbac.read.service");

/* =========================
 * GET /rbac/roles/:roleCode/tree
 * ========================= */
async function getRoleTree(roleCodeInput) {
  const roleRow = await getRoleByCodeOrThrow(roleCodeInput);
  const roleCode = String(roleRow.R_Code);
  const roleId = roleRow.R_Id;

  const [menuRows, permRows, granted] = await Promise.all([
    getActiveMenus(),
    getAllPermissions(),
    getRoleGrantedPermissionCodes({ roleId }),
  ]);

  const grantedSet = new Set(granted);
  const permsByMenuCode = groupPermissionsByMenuCode(permRows);

  const nodeById = new Map();
  for (const m of menuRows) {
    const menuCode = String(m.M_Code);
    const availablePerms = permsByMenuCode.get(menuCode) || [];

    const grantedForMenu = availablePerms
      .map((pp) => pp.code)
      .filter((code) => grantedSet.has(code));

    nodeById.set(m.M_Id, {
      menuId: m.M_Id,
      menuCode,
      title: String(m.M_Name ?? ""),
      route: String(m.M_Route ?? ""),
      order: Number(m.M_OrderPosition ?? 0),
      permissions: availablePerms,
      granted: grantedForMenu,
      children: [],
    });
  }

  const roots = [];
  for (const m of menuRows) {
    const node = nodeById.get(m.M_Id);
    if (!node) continue;

    if (!m.M_ParentId) roots.push(node);
    else {
      const parent = nodeById.get(m.M_ParentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  sortTreeByOrder(roots);

  const strip = (n) => ({
    menuCode: n.menuCode,
    title: n.title,
    ...(n.route ? { route: n.route } : {}),
    ...(n.permissions?.length ? { permissions: n.permissions } : {}),
    granted: n.granted || [],
    ...(n.children?.length ? { children: n.children.map(strip) } : {}),
  });

  return {
    roleCode,
    tree: roots.map(strip),
  };
}

/* =========================
 * PUT /rbac/roles/:roleCode/permissions
 * replace-all
 * ========================= */
async function saveRolePermissions(payload) {
  const roleCode = normalizeCode(payload?.roleCode);
  const granted = uniqueStringArray(payload?.granted);

  if (!roleCode) {
    const e = new Error("roleCode is required");
    e.isBadRequest = true;
    throw e;
  }

  if (!Array.isArray(payload?.granted)) {
    const e = new Error("granted must be an array");
    e.isBadRequest = true;
    throw e;
  }

  return sequelize.transaction(async (t) => {
    const roleRow = await getRoleByCodeOrThrow(roleCode, { transaction: t });
    const roleId = roleRow.R_Id;

    const [menuRows, permRows] = await Promise.all([
      sequelize
        .query(`SELECT "M_Id","M_Code" FROM menus WHERE "M_Active" = true`, {
          transaction: t,
        })
        .then(([rows]) => rows || []),
      sequelize
        .query(`SELECT "P_Id","P_Code" FROM permissions`, {
          transaction: t,
        })
        .then(([rows]) => rows || []),
    ]);

    const menuByCode = buildActiveMenuLookup(menuRows);
    const permByCode = buildPermissionLookup(permRows);

    validatePermissionCodesOrThrow(granted, permByCode, "granted");
    const groupedByMenuCode = groupPermissionIdsByActiveMenuOrThrow(
      granted,
      permByCode,
      menuByCode,
    );

    // delete old mappings (detail first, then header)
    await sequelize.query(
      `
      DELETE FROM role_menu_permission_items
      WHERE "RMP_Id" IN (
        SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId" = :roleId
      )
      `,
      { replacements: { roleId }, transaction: t },
    );

    await sequelize.query(
      `DELETE FROM role_menu_permissions WHERE "RoleId" = :roleId`,
      { replacements: { roleId }, transaction: t },
    );

    let totalMenusMapped = 0;
    let totalPermissionItems = 0;

    for (const [, data] of groupedByMenuCode.entries()) {
      const [insertRmpRows] = await sequelize.query(
        `
        INSERT INTO role_menu_permissions ("RoleId", "MenuId")
        VALUES (:roleId, :menuId)
        RETURNING "RMP_Id"
        `,
        {
          replacements: { roleId, menuId: data.menuId },
          transaction: t,
        },
      );

      const rmpId = insertRmpRows[0].RMP_Id;
      totalMenusMapped += 1;

      for (const pId of data.permissionIds) {
        await sequelize.query(
          `
          INSERT INTO role_menu_permission_items ("RMP_Id", "P_Id")
          VALUES (:rmpId, :pId)
          `,
          { replacements: { rmpId, pId }, transaction: t },
        );
        totalPermissionItems += 1;
      }
    }

    return {
      message: "Role permissions saved successfully",
      data: {
        roleCode,
        roleId,
        totalGranted: granted.length,
        totalMenusMapped,
        totalPermissionItems,
        granted,
      },
    };
  });
}

/* =========================
 * GET /rbac/users/:userId/roles/:roleCode/tree
 * EXTRA_ONLY tree
 * ========================= */
async function getUserOverrideTree(userIdInput, roleCodeInput) {
  const roleRow = await getRoleByCodeOrThrow(roleCodeInput);
  const roleCode = String(roleRow.R_Code);
  const roleId = roleRow.R_Id;

  const userRow = await getUserByIdOrThrow(userIdInput);
  assertUserRoleMatches(userRow, roleRow, roleCode);
  const userId = Number(userRow.U_Id);

  const [menuRows, permRows, roleGranted, userExtra] = await Promise.all([
    getActiveMenus(),
    getAllPermissions(),
    getRoleGrantedPermissionCodes({ roleId }),
    getUserExtraPermissionCodes({ userId }),
  ]);

  const roleGrantedSet = new Set(roleGranted);
  const userExtraSet = new Set(userExtra);
  const permsByMenuCode = groupPermissionsByMenuCode(permRows);

  const nodeById = new Map();
  for (const m of menuRows) {
    const menuCode = String(m.M_Code);
    const availablePerms = permsByMenuCode.get(menuCode) || [];

    const grantedForMenu = availablePerms
      .map((pp) => pp.code)
      .filter((code) => roleGrantedSet.has(code));

    const userExtraForMenu = availablePerms
      .map((pp) => pp.code)
      .filter((code) => userExtraSet.has(code));

    const effective = [...new Set([...grantedForMenu, ...userExtraForMenu])];

    nodeById.set(m.M_Id, {
      menuId: m.M_Id,
      menuCode,
      title: String(m.M_Name ?? ""),
      route: String(m.M_Route ?? ""),
      order: Number(m.M_OrderPosition ?? 0),
      permissions: availablePerms,
      granted: grantedForMenu,
      userExtra: userExtraForMenu,
      effective,
      children: [],
    });
  }

  const roots = [];
  for (const m of menuRows) {
    const node = nodeById.get(m.M_Id);
    if (!node) continue;

    if (!m.M_ParentId) roots.push(node);
    else {
      const parent = nodeById.get(m.M_ParentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  sortTreeByOrder(roots);

  const strip = (n) => ({
    menuCode: n.menuCode,
    title: n.title,
    ...(n.route ? { route: n.route } : {}),
    permissions: n.permissions || [],
    granted: n.granted || [],
    userExtra: n.userExtra || [],
    effective: n.effective || [],
    children: (n.children || []).map(strip),
  });

  return {
    userId: String(userId),
    roleCode,
    overrideMode: "EXTRA_ONLY",
    tree: roots.map(strip),
  };
}

/* =========================
 * PUT /rbac/users/:userId/roles/:roleCode/permission-overrides
 * EXTRA_ONLY replace-all
 * ========================= */
async function saveUserPermissionOverride(payload) {
  const userIdRaw = toStr(payload?.userId);
  const roleCode = normalizeCode(payload?.roleCode);
  const userExtra = uniqueStringArray(payload?.userExtra);

  if (!userIdRaw) {
    const e = new Error("userId is required");
    e.isBadRequest = true;
    throw e;
  }
  if (!roleCode) {
    const e = new Error("roleCode is required");
    e.isBadRequest = true;
    throw e;
  }
  if (!Array.isArray(payload?.userExtra)) {
    const e = new Error("userExtra must be an array");
    e.isBadRequest = true;
    throw e;
  }

  return sequelize.transaction(async (t) => {
    const roleRow = await getRoleByCodeOrThrow(roleCode, { transaction: t });
    const roleId = roleRow.R_Id;

    const userRow = await getUserByIdOrThrow(userIdRaw, { transaction: t });
    assertUserRoleMatches(userRow, roleRow, roleCode);
    const userId = Number(userRow.U_Id);

    const [menuRows, permRows] = await Promise.all([
      sequelize
        .query(`SELECT "M_Id","M_Code" FROM menus WHERE "M_Active" = true`, {
          transaction: t,
        })
        .then(([rows]) => rows || []),
      sequelize
        .query(`SELECT "P_Id","P_Code" FROM permissions`, {
          transaction: t,
        })
        .then(([rows]) => rows || []),
    ]);

    const menuByCode = buildActiveMenuLookup(menuRows);
    const permByCode = buildPermissionLookup(permRows);

    validatePermissionCodesOrThrow(userExtra, permByCode, "userExtra");
    const groupedByMenuCode = groupPermissionIdsByActiveMenuOrThrow(
      userExtra,
      permByCode,
      menuByCode,
    );

    // optional strict BE validation (recommended to match FE validation)
    const roleGranted = await getRoleGrantedPermissionCodes(
      { roleId },
      { transaction: t },
    );
    const roleGrantedSet = new Set(roleGranted);
    const overlaps = userExtra.filter((p) => roleGrantedSet.has(p));
    if (overlaps.length) {
      const e = new Error("Some userExtra permissions already exist in role");
      e.isBadRequest = true;
      e.exception = { overlaps };
      throw e;
    }

    // replace-all existing user overrides
    await sequelize.query(
      `
      DELETE FROM user_menu_permission_items
      WHERE "UMP_Id" IN (
        SELECT "UMP_Id"
        FROM user_menu_permissions
        WHERE "U_Id" = :userId
      )
      `,
      { replacements: { userId }, transaction: t },
    );

    await sequelize.query(
      `DELETE FROM user_menu_permissions WHERE "U_Id" = :userId`,
      { replacements: { userId }, transaction: t },
    );

    if (userExtra.length === 0) {
      return {
        message: "User extra permissions cleared successfully",
        data: {
          userId,
          roleCode,
          roleId,
          overrideMode: "EXTRA_ONLY",
          totalUserExtra: 0,
          totalMenusMapped: 0,
          totalPermissionItems: 0,
          userExtra: [],
        },
      };
    }

    let totalMenusMapped = 0;
    let totalPermissionItems = 0;

    for (const [, data] of groupedByMenuCode.entries()) {
      const [insertUmpRows] = await sequelize.query(
        `
        INSERT INTO user_menu_permissions ("U_Id", "MenuId")
        VALUES (:userId, :menuId)
        RETURNING "UMP_Id"
        `,
        {
          replacements: { userId, menuId: data.menuId },
          transaction: t,
        },
      );

      const umpId = insertUmpRows[0].UMP_Id;
      totalMenusMapped += 1;

      for (const pId of data.permissionIds) {
        await sequelize.query(
          `
          INSERT INTO user_menu_permission_items ("UMP_Id", "P_Id")
          VALUES (:umpId, :pId)
          `,
          {
            replacements: { umpId, pId },
            transaction: t,
          },
        );
        totalPermissionItems += 1;
      }
    }

    return {
      message: "User extra permissions saved successfully",
      data: {
        userId,
        roleCode,
        roleId,
        overrideMode: "EXTRA_ONLY",
        totalUserExtra: userExtra.length,
        totalMenusMapped,
        totalPermissionItems,
        userExtra,
      },
    };
  });
}

/* =========================
 * GET /rbac/users/:userId/roles/:roleCode/effective-permissions
 * ========================= */
async function getEffectiveUserPermissions(userIdInput, roleCodeInput) {
  const roleRow = await getRoleByCodeOrThrow(roleCodeInput);
  const roleCode = String(roleRow.R_Code);
  const roleId = roleRow.R_Id;

  const userRow = await getUserByIdOrThrow(userIdInput);
  assertUserRoleMatches(userRow, roleRow, roleCode);
  const userId = Number(userRow.U_Id);

  const { granted, userExtra, effective } =
    await getEffectivePermissionCodesByUserAndRole({
      userId,
      roleId,
    });

  return {
    userId: String(userId),
    roleCode,
    overrideMode: "EXTRA_ONLY",
    granted,
    userExtra,
    effective,
  };
}

module.exports = {
  getRoleTree,
  saveRolePermissions,
  getUserOverrideTree,
  saveUserPermissionOverride,
  getEffectiveUserPermissions,
};