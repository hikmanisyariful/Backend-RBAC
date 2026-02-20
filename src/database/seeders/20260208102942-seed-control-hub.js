"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ========= 1) Get ADMIN role id =========
    const [roleAdmin] = await queryInterface.sequelize.query(
      `SELECT "R_Id" FROM roles WHERE "R_Code"='ADMIN' LIMIT 1`
    );

    if (!roleAdmin?.length) {
      throw new Error(`Role ADMIN not found. Run role seeder first.`);
    }

    const adminRoleId = roleAdmin[0].R_Id;

    // ========= Helper: insert menu if not exists =========
    async function insertMenuIfNotExists(menu) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "M_Id" FROM menus WHERE "M_Code"=:code LIMIT 1`,
        { replacements: { code: menu.M_Code } }
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("menus", [menu]);
      }
    }

    // ========= Helper: insert permission if not exists =========
    async function insertPermissionIfNotExists(perm) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "P_Id" FROM permissions WHERE "P_Code"=:code LIMIT 1`,
        { replacements: { code: perm.code } }
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("permissions", [
          {
            P_Code: perm.code,
            P_Name: perm.name,
            P_Description: perm.desc,
            P_CreatedBy: "seed",
            P_CreatedAt: now,
            P_UpdatedBy: "seed",
            P_UpdatedAt: now,
          },
        ]);
      }
    }

    // ========= 2) Insert menus =========
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
      M_Code: "DASHBOARD",
      M_Name: "Dashboard",
      M_ParentId: null, // akan di-update setelah ambil id
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

    await insertMenuIfNotExists({
      M_Code: "NOTIFICATION",
      M_Name: "Notification",
      M_ParentId: null, // akan di-update setelah ambil id
      M_Route: "/notification",
      M_MenuType: "MENU",
      M_Icon: "Bell",
      M_MenuLevel: 2,
      M_OrderPosition: 2,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // ========= 3) Update parent relations =========
    const [menuRows] = await queryInterface.sequelize.query(
      `
      SELECT "M_Id","M_Code" FROM menus
      WHERE "M_Code" IN ('CONTROL_HUB','DASHBOARD','NOTIFICATION')
      `
    );
    const menuIdByCode = new Map(menuRows.map((m) => [m.M_Code, m.M_Id]));
    const controlHubId = menuIdByCode.get("CONTROL_HUB");

    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: controlHubId, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["DASHBOARD", "NOTIFICATION"] }
    );

    // ========= 4) Insert permissions =========
    const permList = [
      { code: "DASHBOARD.VIEW", name: "View", desc: "View dashboard" },
      { code: "NOTIFICATION.VIEW", name: "View", desc: "View notifications" },
    ];

    for (const p of permList) {
      await insertPermissionIfNotExists(p);
    }

    // load permission ids
    const [permRows] = await queryInterface.sequelize.query(
      `SELECT "P_Id","P_Code" FROM permissions WHERE "P_Code" IN (:codes)`,
      { replacements: { codes: permList.map((x) => x.code) } }
    );
    const pIdByCode = new Map(permRows.map((r) => [r.P_Code, r.P_Id]));

    // ========= 5) Grant ADMIN =========
    const leafCodes = ["DASHBOARD", "NOTIFICATION"];
    const grantMap = {
      DASHBOARD: ["DASHBOARD.VIEW"],
      NOTIFICATION: ["NOTIFICATION.VIEW"],
    };

    for (const menuCode of leafCodes) {
      const menuId = menuIdByCode.get(menuCode);
      if (!menuId) continue;

      // upsert header
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
        // idempotent: clear old items then reinsert
        await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpId });
      }

      const items = (grantMap[menuCode] || []).map((code) => ({
        RMP_Id: rmpId,
        P_Id: pIdByCode.get(code),
      }));

      if (items.length) {
        await queryInterface.bulkInsert("role_menu_permission_items", items);
      }
    }
  },

  async down(queryInterface) {
    // delete mapping items first
    await queryInterface.sequelize.query(`
      DELETE FROM role_menu_permission_items
      WHERE "RMP_Id" IN (
        SELECT "RMP_Id" FROM role_menu_permissions
        WHERE "MenuId" IN (SELECT "M_Id" FROM menus WHERE "M_Code" IN ('DASHBOARD','NOTIFICATION'))
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM role_menu_permissions
      WHERE "MenuId" IN (SELECT "M_Id" FROM menus WHERE "M_Code" IN ('DASHBOARD','NOTIFICATION'));
    `);

    // delete permissions
    await queryInterface.bulkDelete(
      "permissions",
      { P_Code: ["DASHBOARD.VIEW", "NOTIFICATION.VIEW"] },
      {}
    );

    // delete menus (child first then parent)
    await queryInterface.bulkDelete(
      "menus",
      { M_Code: ["DASHBOARD", "NOTIFICATION", "CONTROL_HUB"] },
      {}
    );
  },
};
