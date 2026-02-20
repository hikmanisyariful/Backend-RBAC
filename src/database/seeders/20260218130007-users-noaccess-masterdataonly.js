"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // ======== cek kolom opsional (biar aman terhadap migration bertahap) ========
    const rolesTable = await queryInterface.describeTable("roles");
    const usersTable = await queryInterface.describeTable("users");

    const hasRoleActive = !!rolesTable.R_Active;
    const hasUserPasswordHash = !!usersTable.U_PasswordHash;

    // ========= Helper: insert role if not exists =========
    async function insertRoleIfNotExists(role) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "R_Id" FROM roles WHERE "R_Code"=:code LIMIT 1`,
        { replacements: { code: role.R_Code } }
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("roles", [role]);
      }
    }

    // ========= Helper: insert user if not exists =========
    async function insertUserIfNotExists(user) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "U_Id" FROM users WHERE "U_Username"=:username LIMIT 1`,
        { replacements: { username: user.U_Username } }
      );
      if (exists.length === 0) {
        await queryInterface.bulkInsert("users", [user]);
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

    // ========= 1) Upsert roles =========
    await insertRoleIfNotExists({
      R_Code: "NO_ACCESS",
      R_Name: "No Access",
      R_Description: "User has no menu access",
      R_IsDefault: false,
      ...(hasRoleActive ? { R_Active: true } : {}),
      R_CreatedBy: "seed",
      R_CreatedAt: now,
      R_UpdatedBy: "seed",
      R_UpdatedAt: now,
    });

    await insertRoleIfNotExists({
      R_Code: "MASTER_DATA_ONLY",
      R_Name: "Master Data Only",
      R_Description: "User can access Master Data menus only",
      R_IsDefault: false,
      ...(hasRoleActive ? { R_Active: true } : {}),
      R_CreatedBy: "seed",
      R_CreatedAt: now,
      R_UpdatedBy: "seed",
      R_UpdatedAt: now,
    });

    // ========= 2) Get role ids =========
    const [roleRows] = await queryInterface.sequelize.query(
      `SELECT "R_Id","R_Code" FROM roles WHERE "R_Code" IN ('NO_ACCESS','MASTER_DATA_ONLY')`
    );
    const roleIdByCode = new Map(roleRows.map((r) => [r.R_Code, r.R_Id]));

    const noAccessRoleId = roleIdByCode.get("NO_ACCESS");
    const masterDataRoleId = roleIdByCode.get("MASTER_DATA_ONLY");

    if (!noAccessRoleId || !masterDataRoleId) {
      throw new Error("Role seed failed: NO_ACCESS or MASTER_DATA_ONLY not found.");
    }

    // ========= 3) Ensure required menus exist (master data + leafs) =========
    const neededMenuCodes = ["MASTER_DATA", "BUSINESS_UNIT", "BRANCH", "VESSEL"];

    const [menuRows] = await queryInterface.sequelize.query(
      `SELECT "M_Id","M_Code" FROM menus WHERE "M_Code" IN (:codes)`,
      { replacements: { codes: neededMenuCodes } }
    );
    const menuIdByCode = new Map(menuRows.map((m) => [m.M_Code, m.M_Id]));

    const missing = neededMenuCodes.filter((c) => !menuIdByCode.get(c));
    if (missing.length) {
      throw new Error(
        `Missing menus: ${missing.join(", ")}. Run menu seeder (System Modules/Master Data) first.`
      );
    }

    // ========= 4) Ensure minimal permissions exist (VIEW only) =========
    const permList = [
      { code: "BUSINESS_UNIT.VIEW", name: "View", desc: "View business unit" },
      { code: "BRANCH.VIEW", name: "View", desc: "View branch" },
      { code: "VESSEL.VIEW", name: "View", desc: "View vessel" },
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

    // ========= 5) Grant MASTER_DATA_ONLY role to leaf menus =========
    // Catatan: kita grant ke leaf menus, supaya UI bisa render tree Master Data dari child yang accessible.
    const leafCodes = ["BUSINESS_UNIT", "BRANCH", "VESSEL"];
    const grantMap = {
      BUSINESS_UNIT: ["BUSINESS_UNIT.VIEW"],
      BRANCH: ["BRANCH.VIEW"],
      VESSEL: ["VESSEL.VIEW"],
    };

    for (const menuCode of leafCodes) {
      const menuId = menuIdByCode.get(menuCode);
      if (!menuId) continue;

      // upsert header role_menu_permissions
      const [rmpExist] = await queryInterface.sequelize.query(
        `SELECT "RMP_Id" FROM role_menu_permissions
         WHERE "RoleId"=:roleId AND "MenuId"=:menuId
         LIMIT 1`,
        { replacements: { roleId: masterDataRoleId, menuId } }
      );

      let rmpId;
      if (rmpExist.length === 0) {
        await queryInterface.bulkInsert("role_menu_permissions", [
          {
            RoleId: masterDataRoleId,
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
          { replacements: { roleId: masterDataRoleId, menuId } }
        );
        rmpId = created[0].RMP_Id;
      } else {
        rmpId = rmpExist[0].RMP_Id;
        // idempotent: clear old items then reinsert
        await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpId });
      }

      const items = (grantMap[menuCode] || [])
        .map((code) => ({
          RMP_Id: rmpId,
          P_Id: pIdByCode.get(code),
        }))
        .filter((x) => !!x.P_Id);

      if (items.length) {
        await queryInterface.bulkInsert("role_menu_permission_items", items);
      }
    }

    // ========= 6) Insert users =========
    // User A: tidak punya menu (role NO_ACCESS)
    await insertUserIfNotExists({
      U_Username: "user.noaccess",
      U_Email: "noaccess@example.com",
      U_FullName: "User No Access",
      U_PhoneNumber: null,
      U_KeycloakId: "",
      U_Active: true,
      U_RoleId: noAccessRoleId,
      U_BusinessUnit: "",
      ...(hasUserPasswordHash ? { U_PasswordHash: null } : {}),
      U_CreatedBy: "seed",
      U_CreatedAt: now,
      U_UpdatedBy: "seed",
      U_UpdatedAt: now,
    });

    // User B: hanya akses Master Data (role MASTER_DATA_ONLY)
    await insertUserIfNotExists({
      U_Username: "user.masterdata",
      U_Email: "masterdata@example.com",
      U_FullName: "User Master Data",
      U_PhoneNumber: null,
      U_KeycloakId: "",
      U_Active: true,
      U_RoleId: masterDataRoleId,
      U_BusinessUnit: "",
      ...(hasUserPasswordHash ? { U_PasswordHash: null } : {}),
      U_CreatedBy: "seed",
      U_CreatedAt: now,
      U_UpdatedBy: "seed",
      U_UpdatedAt: now,
    });

    // NOTE:
    // - Kita TIDAK mengisi user_menu_permissions di seeder ini,
    //   karena requirement kamu murni "berpengaruh pada role dan permission".
    // - Jika nanti mau override user tertentu (misal tambah 1 menu di luar role),
    //   baru pakai tabel user_menu_permissions + items.
  },

  async down(queryInterface) {
    // ambil user ids
    const [userRows] = await queryInterface.sequelize.query(
      `SELECT "U_Id","U_Username" FROM users WHERE "U_Username" IN ('user.noaccess','user.masterdata')`
    );
    const userIdByUsername = new Map(userRows.map((u) => [u.U_Username, u.U_Id]));

    // hapus user overrides (kalau suatu saat pernah dibuat)
    const ids = ["user.noaccess", "user.masterdata"]
      .map((u) => userIdByUsername.get(u))
      .filter(Boolean);

    if (ids.length) {
      await queryInterface.sequelize.query(`
        DELETE FROM user_menu_permission_items
        WHERE "UMP_Id" IN (SELECT "UMP_Id" FROM user_menu_permissions WHERE "U_Id" IN (${ids.join(",")}));
      `);

      await queryInterface.bulkDelete("user_menu_permissions", { U_Id: ids });
    }

    // delete users
    await queryInterface.bulkDelete("users", {
      U_Username: ["user.noaccess", "user.masterdata"],
    });

    // hapus role permission mapping untuk MASTER_DATA_ONLY (header+items)
    await queryInterface.sequelize.query(`
      DELETE FROM role_menu_permission_items
      WHERE "RMP_Id" IN (
        SELECT "RMP_Id" FROM role_menu_permissions
        WHERE "RoleId" IN (SELECT "R_Id" FROM roles WHERE "R_Code"='MASTER_DATA_ONLY')
      );
    `);

    await queryInterface.sequelize.query(`
      DELETE FROM role_menu_permissions
      WHERE "RoleId" IN (SELECT "R_Id" FROM roles WHERE "R_Code"='MASTER_DATA_ONLY');
    `);

    // delete roles
    await queryInterface.bulkDelete("roles", {
      R_Code: ["NO_ACCESS", "MASTER_DATA_ONLY"],
    });

    // NOTE: permissions & menus tidak dihapus di down,
    // karena biasanya itu shared/global.
  },
};