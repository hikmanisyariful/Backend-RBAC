"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // =========================
    // Helpers
    // =========================
    async function findOne(sql, replacements) {
      const [rows] = await queryInterface.sequelize.query(sql, { replacements });
      return rows && rows.length > 0 ? rows[0] : null;
    }

    async function insertRoleIfNotExists({ code, name, desc, isDefault = false }) {
      const exists = await findOne(
        `SELECT "R_Id" FROM roles WHERE "R_Code" = :code LIMIT 1`,
        { code }
      );
      if (!exists) {
        await queryInterface.bulkInsert("roles", [
          {
            R_Code: code,
            R_Name: name,
            R_Description: desc ?? "",
            R_IsDefault: !!isDefault,
            R_CreatedBy: "seed",
            R_CreatedAt: now,
            R_UpdatedBy: "seed",
            R_UpdatedAt: now,
          },
        ]);
      }
      const role = await findOne(
        `SELECT "R_Id","R_Code" FROM roles WHERE "R_Code" = :code LIMIT 1`,
        { code }
      );
      return role;
    }

    async function insertMenuIfNotExists(menu) {
      const exists = await findOne(
        `SELECT "M_Id" FROM menus WHERE "M_Code" = :code LIMIT 1`,
        { code: menu.M_Code }
      );
      if (!exists) {
        await queryInterface.bulkInsert("menus", [menu]);
      }
    }

    async function insertPermissionIfNotExists({ code, name, desc }) {
      const exists = await findOne(
        `SELECT "P_Id" FROM permissions WHERE "P_Code" = :code LIMIT 1`,
        { code }
      );
      if (!exists) {
        await queryInterface.bulkInsert("permissions", [
          {
            P_Code: code,
            P_Name: name,
            P_Description: desc ?? "",
            P_CreatedBy: "seed",
            P_CreatedAt: now,
            P_UpdatedBy: "seed",
            P_UpdatedAt: now,
          },
        ]);
      }
      const perm = await findOne(
        `SELECT "P_Id","P_Code" FROM permissions WHERE "P_Code" = :code LIMIT 1`,
        { code }
      );
      return perm;
    }

    async function ensureRmpAndItems({ roleId, menuId, permIds }) {
      // upsert header
      let rmp = await findOne(
        `SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId"=:roleId AND "MenuId"=:menuId LIMIT 1`,
        { roleId, menuId }
      );

      if (!rmp) {
        await queryInterface.bulkInsert("role_menu_permissions", [
          {
            RoleId: roleId,
            MenuId: menuId,
            RMP_CreatedBy: "seed",
            RMP_CreatedAt: now,
            RMP_UpdatedBy: "seed",
            RMP_UpdatedAt: now,
          },
        ]);
        rmp = await findOne(
          `SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId"=:roleId AND "MenuId"=:menuId LIMIT 1`,
          { roleId, menuId }
        );
      } else {
        // clear items biar idempotent
        await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmp.RMP_Id });
        await queryInterface.bulkUpdate(
          "role_menu_permissions",
          { RMP_UpdatedBy: "seed", RMP_UpdatedAt: now },
          { RMP_Id: rmp.RMP_Id }
        );
      }

      // insert items
      const items = permIds.map((pid) => ({ RMP_Id: rmp.RMP_Id, P_Id: pid }));
      if (items.length > 0) {
        await queryInterface.bulkInsert("role_menu_permission_items", items);
      }
    }

    // =========================
    // 1) ROLES (8)
    // =========================
    const rolesToCreate = [
      { code: "CONTROL_ROOM", name: "Control Room", desc: "Access Transactions > Vessel Lineup" },
      { code: "OPERASIONAL", name: "Operasional", desc: "Access Transactions > Inbound > Workorder" },
      { code: "CUSTOMER_NPLOG", name: "Customer NPLog", desc: "Access Master Data > Transporter" },

      // 5 role tambahan (default minimal Dashboard)
      { code: "TRANSACTION_ADMIN", name: "Transaction Admin", desc: "Default dashboard access" },
      { code: "SUPERVISOR", name: "Supervisor", desc: "Default dashboard access" },
      { code: "WAREHOUSE", name: "Warehouse", desc: "Default dashboard access" },
      { code: "FINANCE", name: "Finance", desc: "Default dashboard access" },
      { code: "AUDITOR", name: "Auditor", desc: "Default dashboard access" },
    ];

    const roleRows = {};
    for (const r of rolesToCreate) {
      const role = await insertRoleIfNotExists(r);
      roleRows[r.code] = role;
    }

    // =========================
    // 2) MENUS (Groups + Tree)
    // =========================
    // LEVEL 1 GROUPS
    await insertMenuIfNotExists({
      M_Code: "CONTROL_HUB",
      M_Name: "Control Hub",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "GROUP",
      M_Icon: "LayoutDashboard",
      M_MenuLevel: 1,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    await insertMenuIfNotExists({
      M_Code: "TRANSACTIONS",
      M_Name: "Transactions",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "GROUP",
      M_Icon: "ArrowLeftRight",
      M_MenuLevel: 1,
      M_OrderPosition: 2,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // SYSTEM_MODULES sudah ada di seed kamu sebelumnya, tapi aman insert-if-not-exists:
    await insertMenuIfNotExists({
      M_Code: "SYSTEM_MODULES",
      M_Name: "System Modules",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "GROUP",
      M_Icon: "Layers",
      M_MenuLevel: 1,
      M_OrderPosition: 3,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // LEVEL 2 under CONTROL_HUB (leaf links)
    await insertMenuIfNotExists({
      M_Code: "DASHBOARD",
      M_Name: "Dashboard",
      M_ParentId: null,
      M_Route: "/dashboard",
      M_MenuType: "MENU",
      M_Icon: "Home",
      M_MenuLevel: 2,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // LEVEL 2 under TRANSACTIONS
    await insertMenuIfNotExists({
      M_Code: "VESSEL_LINEUP",
      M_Name: "Vessel Lineup",
      M_ParentId: null,
      M_Route: "/transaction/vessel-lineup",
      M_MenuType: "MENU",
      M_Icon: "Ship",
      M_MenuLevel: 2,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    await insertMenuIfNotExists({
      M_Code: "INBOUND",
      M_Name: "Inbound",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "MENU",
      M_Icon: "Inbox",
      M_MenuLevel: 2,
      M_OrderPosition: 2,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // LEVEL 3 under INBOUND
    await insertMenuIfNotExists({
      M_Code: "INBOUND_WORKORDER",
      M_Name: "Workorder",
      M_ParentId: null,
      M_Route: "/transaction/inbound/workorder",
      M_MenuType: "SUBMENU",
      M_Icon: "ClipboardList",
      M_MenuLevel: 3,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // LEVEL 2 under SYSTEM_MODULES
    await insertMenuIfNotExists({
      M_Code: "MASTER_DATA",
      M_Name: "Master Data",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "MENU",
      M_Icon: "Database",
      M_MenuLevel: 2,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // LEVEL 3 under MASTER_DATA
    await insertMenuIfNotExists({
      M_Code: "TRANSPORTER",
      M_Name: "Transporter",
      M_ParentId: null,
      M_Route: "/data/transporter",
      M_MenuType: "SUBMENU",
      M_Icon: "Truck",
      M_MenuLevel: 3,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // ---- fetch menu ids we just ensured
    const [menuRows] = await queryInterface.sequelize.query(
      `
      SELECT "M_Id","M_Code" FROM menus
      WHERE "M_Code" IN (
        'CONTROL_HUB','TRANSACTIONS','SYSTEM_MODULES',
        'DASHBOARD','VESSEL_LINEUP','INBOUND','INBOUND_WORKORDER',
        'MASTER_DATA','TRANSPORTER'
      )
      `
    );
    const menuIdByCode = new Map(menuRows.map((m) => [m.M_Code, m.M_Id]));

    // ---- update parent relations (idempotent)
    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("CONTROL_HUB"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["DASHBOARD"] }
    );

    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("TRANSACTIONS"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["VESSEL_LINEUP", "INBOUND"] }
    );

    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("INBOUND"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["INBOUND_WORKORDER"] }
    );

    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("SYSTEM_MODULES"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["MASTER_DATA"] }
    );

    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("MASTER_DATA"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["TRANSPORTER"] }
    );

    // =========================
    // 3) PERMISSIONS (minimal VIEW)
    // =========================
    const permsToEnsure = [
      { code: "DASHBOARD.VIEW", name: "View", desc: "View dashboard" },
      { code: "VESSEL_LINEUP.VIEW", name: "View", desc: "View vessel lineup" },
      { code: "INBOUND_WORKORDER.VIEW", name: "View", desc: "View inbound workorder" },
      { code: "TRANSPORTER.VIEW", name: "View", desc: "View transporter master" },
    ];

    const permIdByCode = new Map();
    for (const p of permsToEnsure) {
      const perm = await insertPermissionIfNotExists(p);
      permIdByCode.set(p.code, perm.P_Id);
    }

    // =========================
    // 4) GRANT role_menu_permissions + items
    // =========================
    // mapping role => leaf menus => permission codes
    const grants = {
      CONTROL_ROOM: {
        DASHBOARD: ["DASHBOARD.VIEW"],
        VESSEL_LINEUP: ["VESSEL_LINEUP.VIEW"],
      },
      OPERASIONAL: {
        DASHBOARD: ["DASHBOARD.VIEW"],
        INBOUND_WORKORDER: ["INBOUND_WORKORDER.VIEW"],
      },
      CUSTOMER_NPLOG: {
        DASHBOARD: ["DASHBOARD.VIEW"],
        TRANSPORTER: ["TRANSPORTER.VIEW"],
      },

      // default 5 roles: dashboard only
      TRANSACTION_ADMIN: { DASHBOARD: ["DASHBOARD.VIEW"] },
      SUPERVISOR: { DASHBOARD: ["DASHBOARD.VIEW"] },
      WAREHOUSE: { DASHBOARD: ["DASHBOARD.VIEW"] },
      FINANCE: { DASHBOARD: ["DASHBOARD.VIEW"] },
      AUDITOR: { DASHBOARD: ["DASHBOARD.VIEW"] },
    };

    for (const roleCode of Object.keys(grants)) {
      const role = roleRows[roleCode];
      if (!role) continue;

      const menus = grants[roleCode];
      for (const menuCode of Object.keys(menus)) {
        const menuId = menuIdByCode.get(menuCode);
        if (!menuId) continue;

        const permCodes = menus[menuCode];
        const permIds = permCodes.map((pc) => permIdByCode.get(pc)).filter(Boolean);

        await ensureRmpAndItems({
          roleId: role.R_Id,
          menuId,
          permIds,
        });
      }
    }
  },

  async down(queryInterface) {
    // NOTE: down dihapus agresif (grants + roles + menus + permissions yg kita tambah)
    // aman kalau DB kamu hanya buat dev.

    // 1) remove items + headers for our roles only
    const roleCodes = [
      "CONTROL_ROOM",
      "OPERASIONAL",
      "CUSTOMER_NPLOG",
      "TRANSACTION_ADMIN",
      "SUPERVISOR",
      "WAREHOUSE",
      "FINANCE",
      "AUDITOR",
    ];

    const [roles] = await queryInterface.sequelize.query(
      `SELECT "R_Id","R_Code" FROM roles WHERE "R_Code" IN (:codes)`,
      { replacements: { codes: roleCodes } }
    );
    const roleIds = (roles || []).map((r) => r.R_Id);

    if (roleIds.length > 0) {
      const [rmps] = await queryInterface.sequelize.query(
        `SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId" IN (:roleIds)`,
        { replacements: { roleIds } }
      );
      const rmpIds = (rmps || []).map((r) => r.RMP_Id);

      if (rmpIds.length > 0) {
        await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpIds });
        await queryInterface.bulkDelete("role_menu_permissions", { RMP_Id: rmpIds });
      }
    }

    // 2) delete permissions we added
    await queryInterface.bulkDelete(
      "permissions",
      { P_Code: ["DASHBOARD.VIEW", "VESSEL_LINEUP.VIEW", "INBOUND_WORKORDER.VIEW", "TRANSPORTER.VIEW"] },
      {}
    );

    // 3) delete menus we added (do not delete SYSTEM_MODULES if you already had it)
    await queryInterface.bulkDelete(
      "menus",
      {
        M_Code: [
          "CONTROL_HUB",
          "TRANSACTIONS",
          "DASHBOARD",
          "VESSEL_LINEUP",
          "INBOUND",
          "INBOUND_WORKORDER",
          "MASTER_DATA",
          "TRANSPORTER",
        ],
      },
      {}
    );

    // 4) delete roles
    await queryInterface.bulkDelete("roles", { R_Code: roleCodes }, {});
  },
};
