"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ========= 1) Get ADMIN role id =========
    const [roleAdmin] = await queryInterface.sequelize.query(
      `SELECT "R_Id" FROM roles WHERE "R_Code"='ADMIN' LIMIT 1`,
    );

    if (!roleAdmin?.length) {
      throw new Error(`Role ADMIN not found. Run role seeder first.`);
    }

    const adminRoleId = roleAdmin[0].R_Id;

    // ========= Helper: insert menu if not exists =========
    async function insertMenuIfNotExists(menu) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "M_Id" FROM menus WHERE "M_Code"=:code LIMIT 1`,
        { replacements: { code: menu.M_Code } },
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("menus", [menu]);
      }
    }

    // ========= Helper: insert permission if not exists =========
    async function insertPermissionIfNotExists(perm) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "P_Id" FROM permissions WHERE "P_Code"=:code LIMIT 1`,
        { replacements: { code: perm.code } },
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

    // ========= 2) Insert menus (parentId null dulu) =========
    // GROUP
    await insertMenuIfNotExists({
      M_Code: "SYSTEM_MODULES",
      M_Name: "System Modules",
      M_ParentId: null,
      M_Route: "",
      M_MenuType: "GROUP",
      M_Icon: "Settings",
      M_MenuLevel: 1,
      M_OrderPosition: 2,
      M_Active: true,
      M_IsSelected: false,
      M_CreatedBy: "seed",
      M_CreatedAt: now,
      M_UpdatedBy: "seed",
      M_UpdatedAt: now,
    });

    // MENU level 2
    await insertMenuIfNotExists({
      M_Code: "MASTER_DATA",
      M_Name: "Master Data",
      M_ParentId: null, // nanti di-update ke SYSTEM_MODULES
      M_Route: "/master-data",
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

    // SUB MENU level 3 (leaf)
    await insertMenuIfNotExists({
      M_Code: "BUSINESS_UNIT",
      M_Name: "Business Unit",
      M_ParentId: null, // nanti di-update ke MASTER_DATA
      M_Route: "/master-data/business-unit",
      M_MenuType: "MENU",
      M_Icon: "Building2",
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
      M_Code: "BRANCH",
      M_Name: "Branch",
      M_ParentId: null, // nanti di-update ke MASTER_DATA
      M_Route: "/master-data/branch",
      M_MenuType: "MENU",
      M_Icon: "GitBranch",
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
      M_Code: "VESSEL",
      M_Name: "Vessel",
      M_ParentId: null, // nanti di-update ke MASTER_DATA
      M_Route: "/master-data/vessel",
      M_MenuType: "MENU",
      M_Icon: "Ship",
      M_MenuLevel: 3,
      M_OrderPosition: 3,
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
      WHERE "M_Code" IN ('SYSTEM_MODULES','MASTER_DATA','BUSINESS_UNIT','BRANCH','VESSEL')
      `,
    );

    const menuIdByCode = new Map(menuRows.map((m) => [m.M_Code, m.M_Id]));
    const systemModulesId = menuIdByCode.get("SYSTEM_MODULES");
    const masterDataId = menuIdByCode.get("MASTER_DATA");

    if (!systemModulesId)
      throw new Error("SYSTEM_MODULES menu not found after insert.");
    if (!masterDataId)
      throw new Error("MASTER_DATA menu not found after insert.");

    // MASTER_DATA parent -> SYSTEM_MODULES
    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: systemModulesId, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA" },
    );

    // leaf parent -> MASTER_DATA
    await queryInterface.bulkUpdate(
      "menus",
      { M_ParentId: masterDataId, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: ["BUSINESS_UNIT", "BRANCH", "VESSEL"] },
    );

    // ========= 4) Insert permissions =========
    // Kamu bisa tambah CREATE/EDIT/DELETE kalau sistemmu punya.
    const permList = [
      { code: "BUSINESS_UNIT.VIEW", name: "View", desc: "View business unit" },
      {
        code: "BUSINESS_UNIT.CREATE",
        name: "Create",
        desc: "Create business unit",
      },
      { code: "BUSINESS_UNIT.EDIT", name: "Edit", desc: "Edit business unit" },
      {
        code: "BUSINESS_UNIT.DELETE",
        name: "Delete",
        desc: "Delete business unit",
      },

      { code: "BRANCH.VIEW", name: "View", desc: "View branch" },
      { code: "BRANCH.CREATE", name: "Create", desc: "Create branch" },
      { code: "BRANCH.EDIT", name: "Edit", desc: "Edit branch" },
      { code: "BRANCH.DELETE", name: "Delete", desc: "Delete branch" },

      { code: "VESSEL.VIEW", name: "View", desc: "View vessel" },
      { code: "VESSEL.CREATE", name: "Create", desc: "Create vessel" },
      { code: "VESSEL.EDIT", name: "Edit", desc: "Edit vessel" },
      { code: "VESSEL.DELETE", name: "Delete", desc: "Delete vessel" },
    ];

    for (const p of permList) {
      await insertPermissionIfNotExists(p);
    }

    // load permission ids
    const [permRows] = await queryInterface.sequelize.query(
      `SELECT "P_Id","P_Code" FROM permissions WHERE "P_Code" IN (:codes)`,
      { replacements: { codes: permList.map((x) => x.code) } },
    );
    const pIdByCode = new Map(permRows.map((r) => [r.P_Code, r.P_Id]));

    // ========= 5) Grant ADMIN to leaf menus =========
    const leafCodes = ["BUSINESS_UNIT", "BRANCH", "VESSEL"];

    const grantMap = {
      BUSINESS_UNIT: [
        "BUSINESS_UNIT.VIEW",
        "BUSINESS_UNIT.CREATE",
        "BUSINESS_UNIT.EDIT",
        "BUSINESS_UNIT.DELETE",
      ],
      BRANCH: ["BRANCH.VIEW", "BRANCH.CREATE", "BRANCH.EDIT", "BRANCH.DELETE"],
      VESSEL: ["VESSEL.VIEW", "VESSEL.CREATE", "VESSEL.EDIT", "VESSEL.DELETE"],
    };

    // refresh menu rows (optional; tapi aman)
    const [menuRows2] = await queryInterface.sequelize.query(
      `
      SELECT "M_Id","M_Code" FROM menus
      WHERE "M_Code" IN ('SYSTEM_MODULES','MASTER_DATA','BUSINESS_UNIT','BRANCH','VESSEL')
      `,
    );
    const menuIdByCode2 = new Map(menuRows2.map((m) => [m.M_Code, m.M_Id]));

    for (const menuCode of leafCodes) {
      const menuId = menuIdByCode2.get(menuCode);
      if (!menuId) continue;

      // upsert header
      const [rmpExist] = await queryInterface.sequelize.query(
        `SELECT "RMP_Id" FROM role_menu_permissions
         WHERE "RoleId"=:roleId AND "MenuId"=:menuId
         LIMIT 1`,
        { replacements: { roleId: adminRoleId, menuId } },
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
          `SELECT "RMP_Id" FROM role_menu_permissions
           WHERE "RoleId"=:roleId AND "MenuId"=:menuId
           LIMIT 1`,
          { replacements: { roleId: adminRoleId, menuId } },
        );

        rmpId = created[0].RMP_Id;
      } else {
        rmpId = rmpExist[0].RMP_Id;

        // idempotent: clear old items then reinsert
        await queryInterface.bulkDelete("role_menu_permission_items", {
          RMP_Id: rmpId,
        });
      }

      const items = (grantMap[menuCode] || [])
        .map((code) => ({
          RMP_Id: rmpId,
          P_Id: pIdByCode.get(code),
        }))
        .filter((x) => !!x.P_Id); // safety

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
        WHERE "MenuId" IN (
          SELECT "M_Id" FROM menus WHERE "M_Code" IN ('BUSINESS_UNIT','BRANCH','VESSEL')
        )
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM role_menu_permissions
      WHERE "MenuId" IN (
        SELECT "M_Id" FROM menus WHERE "M_Code" IN ('BUSINESS_UNIT','BRANCH','VESSEL')
      );
    `);

    // delete permissions
    await queryInterface.bulkDelete(
      "permissions",
      {
        P_Code: [
          "BUSINESS_UNIT.VIEW",
          "BUSINESS_UNIT.CREATE",
          "BUSINESS_UNIT.EDIT",
          "BUSINESS_UNIT.DELETE",
          "BRANCH.VIEW",
          "BRANCH.CREATE",
          "BRANCH.EDIT",
          "BRANCH.DELETE",
          "VESSEL.VIEW",
          "VESSEL.CREATE",
          "VESSEL.EDIT",
          "VESSEL.DELETE",
        ],
      },
      {},
    );

    // delete menus (child first then parent)
    await queryInterface.bulkDelete(
      "menus",
      {
        M_Code: [
          "BUSINESS_UNIT",
          "BRANCH",
          "VESSEL",
          "MASTER_DATA",
          "SYSTEM_MODULES",
        ],
      },
      {},
    );
  },
};
