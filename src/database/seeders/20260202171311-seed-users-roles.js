"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    /**
     * 1) Ensure ADMIN role (guaranteed get id)
     */
    const [existing] = await queryInterface.sequelize.query(
      `SELECT "R_Id" FROM roles WHERE "R_Code"='ADMIN' LIMIT 1`
    );

    let adminRoleId = existing?.[0]?.R_Id;

    if (!adminRoleId) {
      // Insert and return id (Postgres)
      const [inserted] = await queryInterface.sequelize.query(
        `
        INSERT INTO roles
          ("R_Code","R_Name","R_Description","R_IsDefault",
           "R_CreatedBy","R_CreatedAt","R_UpdatedBy","R_UpdatedAt")
        VALUES
          ('ADMIN','Administrator','Full access', true,
           'seed', :now, 'seed', :now)
        RETURNING "R_Id"
        `,
        { replacements: { now } }
      );

      adminRoleId = inserted?.[0]?.R_Id;
    }

    if (!adminRoleId) {
      throw new Error(
        `ADMIN role id not found after insert. Check table/column names: roles("R_Id","R_Code",...).`
      );
    }

    /**
     * 2) Optional user1
     */
    const [user1Exists] = await queryInterface.sequelize.query(
      `SELECT "U_Id" FROM users WHERE "U_Username"='user1' LIMIT 1`
    );

    if (user1Exists.length === 0) {
      await queryInterface.bulkInsert("users", [
        {
          U_Username: "user1",
          U_Email: "user1@example.com",
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

    /**
     * 3) Grant ADMIN to all leaf menus
     */
    const [leafMenus] = await queryInterface.sequelize.query(
      `SELECT "M_Id","M_Code" FROM menus WHERE "M_MenuType"='SUBMENU'`
    );

    const leafCodes = leafMenus.map((m) => m.M_Code);
    if (leafCodes.length === 0) return;

    const actions = ["VIEW", "VIEW_DETAIL", "CREATE", "UPDATE", "DELETE"];
    const permCodes = leafCodes.flatMap((c) => actions.map((a) => `${c}.${a}`));

    const [permRows] = await queryInterface.sequelize.query(
      `SELECT "P_Id","P_Code" FROM permissions WHERE "P_Code" IN (:codes)`,
      { replacements: { codes: permCodes } }
    );

    const pIdByCode = new Map(permRows.map((p) => [p.P_Code, p.P_Id]));

    for (const m of leafMenus) {
      const menuId = m.M_Id;
      const menuCode = m.M_Code;

      const [rmpExist] = await queryInterface.sequelize.query(
        `SELECT "RMP_Id" FROM role_menu_permissions
         WHERE "RoleId"=:roleId AND "MenuId"=:menuId LIMIT 1`,
        { replacements: { roleId: adminRoleId, menuId } }
      );

      let rmpId = rmpExist?.[0]?.RMP_Id;

      if (!rmpId) {
        const [created] = await queryInterface.sequelize.query(
          `
          INSERT INTO role_menu_permissions
            ("RoleId","MenuId","RMP_CreatedBy","RMP_CreatedAt","RMP_UpdatedBy","RMP_UpdatedAt")
          VALUES
            (:roleId,:menuId,'seed',:now,'seed',:now)
          RETURNING "RMP_Id"
          `,
          { replacements: { roleId: adminRoleId, menuId, now } }
        );
        rmpId = created?.[0]?.RMP_Id;
      } else {
        await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpId });
      }

      const items = actions
        .map((a) => `${menuCode}.${a}`)
        .map((code) => ({ RMP_Id: rmpId, P_Id: pIdByCode.get(code) }))
        .filter((x) => !!x.P_Id);

      if (items.length) {
        await queryInterface.bulkInsert("role_menu_permission_items", items);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("users", { U_Username: "user1" });

    const [roleAdmin] = await queryInterface.sequelize.query(
      `SELECT "R_Id" FROM roles WHERE "R_Code"='ADMIN' LIMIT 1`
    );
    const adminRoleId = roleAdmin?.[0]?.R_Id;
    if (!adminRoleId) return;

    const [rmpRows] = await queryInterface.sequelize.query(
      `SELECT "RMP_Id" FROM role_menu_permissions WHERE "RoleId"=:roleId`,
      { replacements: { roleId: adminRoleId } }
    );
    const rmpIds = rmpRows.map((r) => r.RMP_Id);

    if (rmpIds.length) {
      await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpIds });
      await queryInterface.bulkDelete("role_menu_permissions", { RMP_Id: rmpIds });
    }

    // optional: keep role
    // await queryInterface.bulkDelete("roles", { R_Code: "ADMIN" });
  },
};