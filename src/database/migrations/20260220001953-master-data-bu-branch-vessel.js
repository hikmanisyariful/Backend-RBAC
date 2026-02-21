"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * 1) business_units
     */
    await queryInterface.createTable("business_units", {
      BU_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      BU_Code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      BU_Name: { type: Sequelize.STRING(150), allowNull: false },
      BU_Active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      BU_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      BU_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      BU_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      BU_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    /**
     * 2) branches (relasi ke business_units)
     */
    await queryInterface.createTable("branches", {
      BR_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      BU_Id: { type: Sequelize.BIGINT, allowNull: false }, // FK => business_units.BU_Id

      BR_Code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      BR_Name: { type: Sequelize.STRING(150), allowNull: false },
      BR_Active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      // mengikuti kebutuhan FE
      BR_IdERP: { type: Sequelize.BIGINT, allowNull: true },
      BR_DocPrefix: { type: Sequelize.STRING(20), allowNull: true },

      BR_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      BR_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      BR_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      BR_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("branches", {
      fields: ["BU_Id"],
      type: "foreign key",
      name: "fk_branches_bu",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("branches", ["BU_Id"], { name: "idx_branches_bu_id" });

    /**
     * 3) business_unit_features  (untuk endpoint /business-unit/features)
     */
    await queryInterface.createTable("business_unit_features", {
      BUF_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      BUF_Code: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      BUF_Name: { type: Sequelize.STRING(150), allowNull: false },

      BUF_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      BUF_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    /**
     * 4) business_unit_sap_integrations (BU punya array SAPIntegrations)
     * FE payload: { featureName, endpoint }
     */
    await queryInterface.createTable("business_unit_sap_integrations", {
      BUSA_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      BU_Id: { type: Sequelize.BIGINT, allowNull: false },

      BUSA_FeatureName: { type: Sequelize.STRING(150), allowNull: false },
      BUSA_Endpoint: { type: Sequelize.STRING(255), allowNull: false },

      BUSA_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      BUSA_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("business_unit_sap_integrations", {
      fields: ["BU_Id"],
      type: "foreign key",
      name: "fk_busa_bu",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("business_unit_sap_integrations", ["BU_Id"], {
      name: "idx_busa_bu_id",
    });

    /**
     * 5) vessels
     */
    await queryInterface.createTable("vessels", {
      VS_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      VS_Imo: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      VS_Name: { type: Sequelize.STRING(150), allowNull: false },
      VS_Type: { type: Sequelize.STRING(80), allowNull: false },
      VS_Category: { type: Sequelize.STRING(80), allowNull: false },

      VS_Weight: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
      VS_MaxCapacity: { type: Sequelize.DECIMAL(18, 2), allowNull: true },

      VS_Active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      VS_CreatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      VS_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      VS_UpdatedBy: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      VS_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    /**
     * 6) vessel_sap_code_mappings (array SapCodeMappings)
     */
    await queryInterface.createTable("vessel_sap_code_mappings", {
      VSM_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      VS_Id: { type: Sequelize.BIGINT, allowNull: false },

      VSM_BusinessUnitCode: { type: Sequelize.STRING(50), allowNull: false },
      VSM_BusinessUnitName: { type: Sequelize.STRING(150), allowNull: false },
      VSM_SAPCode: { type: Sequelize.STRING(80), allowNull: false },

      VSM_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      VSM_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("vessel_sap_code_mappings", {
      fields: ["VS_Id"],
      type: "foreign key",
      name: "fk_vsm_vessel",
      references: { table: "vessels", field: "VS_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("vessel_sap_code_mappings", ["VS_Id"], { name: "idx_vsm_vs_id" });

    /**
     * 7) vessel_external_code_mappings (array ExternalCodeMappings)
     */
    await queryInterface.createTable("vessel_external_code_mappings", {
      VEM_Id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      VS_Id: { type: Sequelize.BIGINT, allowNull: false },

      VEM_ExternalSystemCode: { type: Sequelize.STRING(80), allowNull: false },
      VEM_ExternalName: { type: Sequelize.STRING(150), allowNull: false },
      VEM_ExternalCode: { type: Sequelize.STRING(80), allowNull: false },
      VEM_WarehouseCode: { type: Sequelize.STRING(80), allowNull: false },
      VEM_WarehouseName: { type: Sequelize.STRING(150), allowNull: false },

      VEM_CreatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      VEM_UpdatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    await queryInterface.addConstraint("vessel_external_code_mappings", {
      fields: ["VS_Id"],
      type: "foreign key",
      name: "fk_vem_vessel",
      references: { table: "vessels", field: "VS_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("vessel_external_code_mappings", ["VS_Id"], { name: "idx_vem_vs_id" });
  },

  async down(queryInterface) {
    // reverse order (FK children dulu)
    await queryInterface.dropTable("vessel_external_code_mappings");
    await queryInterface.dropTable("vessel_sap_code_mappings");
    await queryInterface.dropTable("vessels");

    await queryInterface.dropTable("business_unit_sap_integrations");
    await queryInterface.dropTable("business_unit_features");

    await queryInterface.dropTable("branches");
    await queryInterface.dropTable("business_units");
  },
};
