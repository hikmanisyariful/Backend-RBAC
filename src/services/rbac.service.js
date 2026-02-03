const { sequelize } = require("../config/db");

async function getRoleTree(roleCode) {
  // 1) ambil roleId
  const [roleRows] = await sequelize.query(
    `SELECT "R_Id","R_Code" FROM roles WHERE "R_Code"=:roleCode LIMIT 1`,
    { replacements: { roleCode } }
  );

  if (!roleRows.length) return { roleCode, tree: [] };
  const roleId = roleRows[0].R_Id;

  // 2) ambil semua menu aktif
  const [menuRows] = await sequelize.query(
    `
    SELECT "M_Id","M_Code","M_Name","M_ParentId","M_Route","M_MenuLevel","M_OrderPosition"
    FROM menus
    WHERE "M_Active" = true
    ORDER BY "M_MenuLevel" ASC, "M_OrderPosition" ASC
    `
  );

  // 3) ambil semua permission (atau nanti bisa filter SETTINGS_% saja)
  const [permRows] = await sequelize.query(
    `
    SELECT "P_Id","P_Code","P_Name"
    FROM permissions
    ORDER BY "P_Code" ASC
    `
  );

  // 4) granted permission milik role
  const [grantedRows] = await sequelize.query(
    `
    SELECT p."P_Code"
    FROM role_menu_permissions rmp
    JOIN role_menu_permission_items rmpi ON rmpi."RMP_Id" = rmp."RMP_Id"
    JOIN permissions p ON p."P_Id" = rmpi."P_Id"
    WHERE rmp."RoleId" = :roleId
    `,
    { replacements: { roleId } }
  );

  const grantedSet = new Set(grantedRows.map((x) => x.P_Code));

  // ===== group permissions by menuCode prefix =====
  const permsByMenuCode = new Map();
  for (const p of permRows) {
    const menuCode = String(p.P_Code).split(".")[0]; // e.g. SETTINGS_ROLE
    if (!permsByMenuCode.has(menuCode)) permsByMenuCode.set(menuCode, []);
    permsByMenuCode.get(menuCode).push({ code: p.P_Code, name: p.P_Name });
  }

  // ===== build node map =====
  const nodeById = new Map();
  for (const m of menuRows) {
    const menuCode = m.M_Code;

    const availablePerms = permsByMenuCode.get(menuCode) || [];
    const granted = availablePerms
      .map((pp) => pp.code)
      .filter((code) => grantedSet.has(code));

    nodeById.set(m.M_Id, {
      menuId: m.M_Id,
      menuCode: m.M_Code,
      title: m.M_Name,
      route: m.M_Route || "",
      level: m.M_MenuLevel,
      order: m.M_OrderPosition,
      permissions: availablePerms,
      granted,
      children: [],
    });
  }

  // ===== link parent-child =====
  const roots = [];
  for (const m of menuRows) {
    const node = nodeById.get(m.M_Id);
    if (!m.M_ParentId) {
      roots.push(node);
    } else {
      const parent = nodeById.get(m.M_ParentId);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  // sort children by order
  const sortTree = (nodes) => {
    nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const n of nodes) sortTree(n.children);
  };
  sortTree(roots);

  // strip internal fields
  const strip = (n) => ({
    menuCode: n.menuCode,
    title: n.title,
    ...(n.route ? { route: n.route } : {}),
    ...(n.permissions?.length ? { permissions: n.permissions } : {}),
    granted: n.granted || [],
    ...(n.children?.length ? { children: n.children.map(strip) } : {}),
  });

  return { roleCode, tree: roots.map(strip) };
}

module.exports = { getRoleTree };
