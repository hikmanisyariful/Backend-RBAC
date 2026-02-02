"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) menus
    await queryInterface.createTable("menus", {
      M_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      M_Code: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      M_Name: { type: Sequelize.STRING(150), allowNull: false },
      M_ParentId: { type: Sequelize.BIGINT, allowNull: true },
      M_Route: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "" },
      M_MenuType: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "MENU" },
      M_Icon: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "" },
      M_MenuLevel: { type: Sequelize.INTEGER, allowNull: false },
      M_OrderPosition: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      M_Active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      M_IsSelected: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      M_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      M_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      M_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      M_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("menus", {
      fields: ["M_ParentId"],
      type: "foreign key",
      name: "fk_menus_parent",
      references: { table: "menus", field: "M_Id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    // 2) permissions
    await queryInterface.createTable("permissions", {
      P_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      P_Code: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      P_Name: { type: Sequelize.STRING(150), allowNull: false },
      P_Description: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "" },
      P_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      P_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      P_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      P_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    // 3) roles
    await queryInterface.createTable("roles", {
      R_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      R_Code: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      R_Name: { type: Sequelize.STRING(150), allowNull: false },
      R_Description: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "" },
      R_IsDefault: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      R_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      R_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      R_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      R_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    // 4) users (1 user 1 role)
    await queryInterface.createTable("users", {
      U_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      U_Username: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      U_Email: { type: Sequelize.STRING(150), allowNull: false, unique: true },
      U_FullName: { type: Sequelize.STRING(150), allowNull: false },
      U_PhoneNumber: { type: Sequelize.STRING(30), allowNull: true },
      U_KeycloakId: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "" },
      U_Active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      U_RoleId: { type: Sequelize.BIGINT, allowNull: false }, // FK roles.R_Id
      U_BusinessUnit: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "" },

      U_CreatedBy: { type: Sequelize.STRING(100), allowNull: true },
      U_CreatedAt: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal("NOW()") },
      U_UpdatedBy: { type: Sequelize.STRING(100), allowNull: true },
      U_UpdatedAt: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("users", {
      fields: ["U_RoleId"],
      type: "foreign key",
      name: "fk_users_roleid",
      references: { table: "roles", field: "R_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    // 5) role_menu_permissions (header)
    await queryInterface.createTable("role_menu_permissions", {
      RMP_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      RoleId: { type: Sequelize.BIGINT, allowNull: false },
      MenuId: { type: Sequelize.BIGINT, allowNull: false },
      RMP_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      RMP_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      RMP_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      RMP_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("role_menu_permissions", {
      fields: ["RoleId"],
      type: "foreign key",
      name: "fk_rmp_roleid",
      references: { table: "roles", field: "R_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("role_menu_permissions", {
      fields: ["MenuId"],
      type: "foreign key",
      name: "fk_rmp_menuid",
      references: { table: "menus", field: "M_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("role_menu_permissions", {
      fields: ["RoleId", "MenuId"],
      type: "unique",
      name: "uq_rmp_role_menu",
    });

    // 6) role_menu_permission_items (detail)
    await queryInterface.createTable("role_menu_permission_items", {
      RMPI_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      RMP_Id: { type: Sequelize.BIGINT, allowNull: false },
      P_Id: { type: Sequelize.BIGINT, allowNull: false },
    });

    await queryInterface.addConstraint("role_menu_permission_items", {
      fields: ["RMP_Id"],
      type: "foreign key",
      name: "fk_rmpi_rmp",
      references: { table: "role_menu_permissions", field: "RMP_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("role_menu_permission_items", {
      fields: ["P_Id"],
      type: "foreign key",
      name: "fk_rmpi_perm",
      references: { table: "permissions", field: "P_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("role_menu_permission_items", {
      fields: ["RMP_Id", "P_Id"],
      type: "unique",
      name: "uq_rmpi_rmp_pid",
    });

    // 7) user_menu_permissions (override header)
    await queryInterface.createTable("user_menu_permissions", {
      UMP_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      U_Id: { type: Sequelize.BIGINT, allowNull: false },
      MenuId: { type: Sequelize.BIGINT, allowNull: false },
      UMP_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      UMP_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      UMP_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      UMP_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("user_menu_permissions", {
      fields: ["U_Id"],
      type: "foreign key",
      name: "fk_ump_user",
      references: { table: "users", field: "U_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_menu_permissions", {
      fields: ["MenuId"],
      type: "foreign key",
      name: "fk_ump_menuid",
      references: { table: "menus", field: "M_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_menu_permissions", {
      fields: ["U_Id", "MenuId"],
      type: "unique",
      name: "uq_ump_user_menu",
    });

    // 8) user_menu_permission_items (override detail)
    await queryInterface.createTable("user_menu_permission_items", {
      UMPI_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      UMP_Id: { type: Sequelize.BIGINT, allowNull: false },
      P_Id: { type: Sequelize.BIGINT, allowNull: false },
    });

    await queryInterface.addConstraint("user_menu_permission_items", {
      fields: ["UMP_Id"],
      type: "foreign key",
      name: "fk_umpi_ump",
      references: { table: "user_menu_permissions", field: "UMP_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_menu_permission_items", {
      fields: ["P_Id"],
      type: "foreign key",
      name: "fk_umpi_perm",
      references: { table: "permissions", field: "P_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_menu_permission_items", {
      fields: ["UMP_Id", "P_Id"],
      type: "unique",
      name: "uq_umpi_ump_pid",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_menu_permission_items");
    await queryInterface.dropTable("user_menu_permissions");
    await queryInterface.dropTable("role_menu_permission_items");
    await queryInterface.dropTable("role_menu_permissions");
    await queryInterface.dropTable("users");
    await queryInterface.dropTable("roles");
    await queryInterface.dropTable("permissions");
    await queryInterface.dropTable("menus");
  },
};
