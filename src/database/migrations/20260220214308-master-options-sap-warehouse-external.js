"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * A) SAP Code Options
     * - groups: FKSMA SAP, NPLOG SAP, SGT2 SAP, ...
     * - items: BJ-SMA, ARG-SBM, ...
     */
    await queryInterface.createTable("sap_code_option_groups", {
      SCG_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      SCG_Code: { type: Sequelize.STRING(100), allowNull: false, unique: true },

      SCG_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      SCG_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      SCG_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      SCG_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.createTable("sap_code_option_items", {
      SCI_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      SCG_Id: { type: Sequelize.BIGINT, allowNull: false }, // FK => groups
      SCI_SAPCode: { type: Sequelize.STRING(80), allowNull: false },

      SCI_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      SCI_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("sap_code_option_items", {
      fields: ["SCG_Id"],
      type: "foreign key",
      name: "fk_sci_scg",
      references: { table: "sap_code_option_groups", field: "SCG_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("sap_code_option_items", {
      fields: ["SCG_Id", "SCI_SAPCode"],
      type: "unique",
      name: "uq_sci_group_sapcode",
    });

    await queryInterface.addIndex("sap_code_option_items", ["SCG_Id"], { name: "idx_sci_scg_id" });

    /**
     * C) External Mapping Keys
     * dropdown: ["KBS-SGT2", ...]
     */
    await queryInterface.createTable("external_mapping_keys", {
      EMK_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      EMK_Key: { type: Sequelize.STRING(100), allowNull: false, unique: true },

      EMK_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      EMK_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("external_mapping_keys");
    await queryInterface.dropTable("sap_code_option_items");
    await queryInterface.dropTable("sap_code_option_groups");
  },
};