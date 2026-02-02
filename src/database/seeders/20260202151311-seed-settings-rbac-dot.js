"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ========= 1) ROLE ADMIN (id auto) =========
    const [roleExists] = await queryInterface.sequelize.query(
      `SELECT "R_Id" FROM roles WHERE "R_Code"='ADMIN' LIMIT 1`
    );

    if (roleExists.length === 0) {
      await queryInterface.bulkInsert("roles", [
        {
          R_Code: "ADMIN",
          R_Name: "Administrator",
          R_Description: "Full access",
          R_IsDefault: true,
          R_CreatedBy: "seed",
          R_CreatedAt: now,
          R_UpdatedBy: "seed",
          R_UpdatedAt: now,
        },
      ]);
    }

    const [roleAdmin] = await queryInterface.sequelize.query(
      `SELECT "R_Id" FROM roles WHERE "R_Code"='ADMIN' LIMIT 1`
    );
    const adminRoleId = roleAdmin[0].R_Id;

    // ========= 2) MENUS (insert idempotent) =========
    async function insertMenuIfNotExists(menu) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "M_Id" FROM menus WHERE "M_Code"=:code LIMIT 1`,
        { replacements: { code: menu.M_Code } }
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("menus", [menu]);
      }
    }

    await insertMenuIfNotExists({
      M_Code: "SYSTEM_MODULES",
      M_Name: "System Modules",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "GROUP",
      M_Icon: "",
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
      M_Code: "SETTINGS",
      M_Name: "Settings",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "MENU",
      M_Icon: "",
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
      M_Code: "SETTINGS_MENU",
      M_Name: "Master Menu",
      M_ParentId: null,
      M_Route: "/settings/master-menu",
      M_MenuType: "SUBMENU",
      M_Icon: "",
      M_MenuLevel: 3,
      M_OrderPosition: 1,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    await insertMenuIfNotExists({
      M_Code: "SETTINGS_ROLE",
      M_Name: "Role",
      M_ParentId: null,
      M_Route: "/settings/role",
      M_MenuType: "SUBMENU",
      M_Icon: "",
      M_MenuLevel: 3,
      M_OrderPosition: 2,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    await insertMenuIfNotExists({
      M_Code: "SETTINGS_USER",
      M_Name: "User",
      M_ParentId: null,
      M_Route: "/settings/user",
      M_MenuType: "SUBMENU",
      M_Icon: "",
      M_MenuLevel: 3,
      M_OrderPosition: 3,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // Fetch IDs
    const [menuRows] = await queryInterface.sequelize.query(
      `
      SELECT "M_Id","M_Code" FROM menus
      WHERE "M_Code" IN ('SYSTEM_MODULES','SETTINGS','SETTINGS_MENU','SETTINGS_ROLE','SETTINGS_USER')
      `
    );
    const menuIdByCode = new Map(menuRows.map((m) => [m.M_Code, m.M_Id]));

    // Update parent relations (idempotent)
    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("SYSTEM_MODULES"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "SETTINGS" }
    );

    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: menuIdByCode.get("SETTINGS"), M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["SETTINGS_MENU", "SETTINGS_ROLE", "SETTINGS_USER"] }
    );

    // ========= 3) PERMISSIONS (CRUD dot) =========
    const permList = [
      // Master Menu
      { code: "SETTINGS_MENU.VIEW", name: "View", desc: "View master menu" },
      { code: "SETTINGS_MENU.CREATE", name: "Create", desc: "Create master menu" },
      { code: "SETTINGS_MENU.EDIT", name: "Edit", desc: "Edit master menu" },
      { code: "SETTINGS_MENU.DELETE", name: "Delete", desc: "Delete master menu" },
      // Role
      { code: "SETTINGS_ROLE.VIEW", name: "View", desc: "View roles" },
      { code: "SETTINGS_ROLE.CREATE", name: "Create", desc: "Create role" },
      { code: "SETTINGS_ROLE.EDIT", name: "Edit", desc: "Edit role" },
      { code: "SETTINGS_ROLE.DELETE", name: "Delete", desc: "Delete role" },
      // User
      { code: "SETTINGS_USER.VIEW", name: "View", desc: "View users" },
      { code: "SETTINGS_USER.CREATE", name: "Create", desc: "Create user" },
      { code: "SETTINGS_USER.EDIT", name: "Edit", desc: "Edit user" },
      { code: "SETTINGS_USER.DELETE", name: "Delete", desc: "Delete user" },
    ];

    for (const p of permList) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "P_Id" FROM permissions WHERE "P_Code"=:code LIMIT 1`,
        { replacements: { code: p.code } }
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("permissions", [
          {
            P_Code: p.code,
            P_Name: p.name,
            P_Description: p.desc,
            P_CreatedBy: "seed",
            P_CreatedAt: now,
            P_UpdatedBy: "seed",
            P_UpdatedAt: now,
          },
        ]);
      }
    }

    // Load permission IDs  ✅ FIX: ANY -> IN
    const [permRows] = await queryInterface.sequelize.query(
      `SELECT "P_Id","P_Code" FROM permissions WHERE "P_Code" IN (:codes)`,
      { replacements: { codes: permList.map((x) => x.code) } }
    );
    const pIdByCode = new Map(permRows.map((r) => [r.P_Code, r.P_Id]));

    // ========= 4) USER u1 (optional) =========
    const [u1Exists] = await queryInterface.sequelize.query(
      `SELECT "U_Id" FROM users WHERE "U_Username"='u1' LIMIT 1`
    );
    if (u1Exists.length === 0) {
      await queryInterface.bulkInsert("users", [
        {
          U_Username: "u1",
          U_Email: "u1@example.com",
          U_FullName: "User One",
          U_PhoneNumber: null,
          U_KeycloakId: "",
          U_Active: true,
          U_RoleId: adminRoleId,
          U_BusinessUnit: "HQ",
          U_CreatedBy: "seed",
          U_CreatedAt: now,
          U_UpdatedBy: "seed",
          U_UpdatedAt: now,
        },
      ]);
    }

    // ========= 5) GRANT ADMIN: role_menu_permissions + items =========
    const leafCodes = ["SETTINGS_MENU", "SETTINGS_ROLE", "SETTINGS_USER"];
    const group = {
      SETTINGS_MENU: permList.filter((x) => x.code.startsWith("SETTINGS_MENU.")).map((x) => x.code),
      SETTINGS_ROLE: permList.filter((x) => x.code.startsWith("SETTINGS_ROLE.")).map((x) => x.code),
      SETTINGS_USER: permList.filter((x) => x.code.startsWith("SETTINGS_USER.")).map((x) => x.code),
    };

    for (const menuCode of leafCodes) {
      const menuId = menuIdByCode.get(menuCode);

      const [rmpExist] = await queryInterface.sequelize.query(
        `SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId"=:roleId AND "MenuId"=:menuId LIMIT 1`,
        { replacements: { roleId: adminRoleId, menuId } }
      );

      let rmpId;
      if (rmpExist.length === 0) {
        await queryInterface.bulkInsert("role_menu_permissions", [
          {
            RoleId: adminRoleId,
            MenuId: menuId,
            RMP_CreatedBy: "seed",
            RMP_CreatedAt: now,
            RMP_UpdatedBy: "seed",
            RMP_UpdatedAt: now,
          },
        ]);

        const [created] = await queryInterface.sequelize.query(
          `SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId"=:roleId AND "MenuId"=:menuId LIMIT 1`,
          { replacements: { roleId: adminRoleId, menuId } }
        );
        rmpId = created[0].RMP_Id;
      } else {
        rmpId = rmpExist[0].RMP_Id;
        await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpId });
      }

      const items = group[menuCode].map((code) => ({
        RMP_Id: rmpId,
        P_Id: pIdByCode.get(code),
      }));

      await queryInterface.bulkInsert("role_menu_permission_items", items);
    }
  },

  async down(queryInterface) {
    // remove mappings first
    await queryInterface.bulkDelete("role_menu_permission_items", null, {});
    await queryInterface.bulkDelete("role_menu_permissions", null, {});
    await queryInterface.bulkDelete("user_menu_permission_items", null, {});
    await queryInterface.bulkDelete("user_menu_permissions", null, {});

    // delete user u1
    await queryInterface.bulkDelete("users", { U_Username: "u1" }, {});

    // delete permissions
    await queryInterface.bulkDelete(
      "permissions",
      {
        P_Code: [
          "SETTINGS_MENU.VIEW",
          "SETTINGS_MENU.CREATE",
          "SETTINGS_MENU.EDIT",
          "SETTINGS_MENU.DELETE",
          "SETTINGS_ROLE.VIEW",
          "SETTINGS_ROLE.CREATE",
          "SETTINGS_ROLE.EDIT",
          "SETTINGS_ROLE.DELETE",
          "SETTINGS_USER.VIEW",
          "SETTINGS_USER.CREATE",
          "SETTINGS_USER.EDIT",
          "SETTINGS_USER.DELETE",
        ],
      },
      {}
    );

    // delete menus
    await queryInterface.bulkDelete(
      "menus",
      { M_Code: ["SETTINGS_MENU", "SETTINGS_ROLE", "SETTINGS_USER", "SETTINGS", "SYSTEM_MODULES"] },
      {}
    );

    // keep role ADMIN (optional)
    // await queryInterface.bulkDelete("roles", { R_Code: "ADMIN" }, {});
  },
};
