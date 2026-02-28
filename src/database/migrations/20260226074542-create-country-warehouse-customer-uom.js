"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * 0) countries
     */
    await queryInterface.createTable("countries", {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      name: { type: Sequelize.STRING(150), allowNull: false, unique: true },

      created_by: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: "system",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // NOTE: unique: true pada "name" sudah membuat unique index.
    // Kalau tetap mau index biasa (non-unique) untuk query tertentu, biarkan,
    // tapi biasanya ini redundant. Jadi aku hapus supaya tidak dobel.
    // await queryInterface.addIndex("countries", ["name"], { name: "idx_countries_name" });

    /**
     * 1) warehouses
     */
    await queryInterface.createTable("warehouses", {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      branch_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => branches.BR_Id
      business_unit_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => business_units.BU_Id
      country_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => countries.id

      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(150), allowNull: false },
      address: { type: Sequelize.STRING(255), allowNull: false, defaultValue: "" },

      status: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      lat: { type: Sequelize.STRING(50), allowNull: true },
      long: { type: Sequelize.STRING(50), allowNull: true },

      max_capacity: { type: Sequelize.DECIMAL(18, 2), allowNull: true },
      default_ritase: { type: Sequelize.DECIMAL(18, 2), allowNull: true },

      created_by: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // ✅ FK tanpa nama constraint (biar tidak conflict)
    await queryInterface.addConstraint("warehouses", {
      fields: ["branch_id"],
      type: "foreign key",
      references: { table: "branches", field: "BR_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("warehouses", {
      fields: ["business_unit_id"],
      type: "foreign key",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("warehouses", {
      fields: ["country_id"],
      type: "foreign key",
      references: { table: "countries", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("warehouses", ["branch_id"], { name: "idx_warehouses_branch_id" });
    await queryInterface.addIndex("warehouses", ["business_unit_id"], { name: "idx_warehouses_bu_id" });
    await queryInterface.addIndex("warehouses", ["country_id"], { name: "idx_warehouses_country_id" });
    await queryInterface.addIndex("warehouses", ["status"], { name: "idx_warehouses_status" });
    await queryInterface.addIndex("warehouses", ["deleted_at"], { name: "idx_warehouses_deleted_at" });

    /**
     * 2) customers
     */
    await queryInterface.createTable("customers", {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      business_unit_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => business_units.BU_Id
      country_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => countries.id
      user_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => users.U_Id

      sap_code: { type: Sequelize.STRING(80), allowNull: true },
      code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(150), allowNull: false },

      npwp: { type: Sequelize.STRING(50), allowNull: true },
      logo: { type: Sequelize.STRING(255), allowNull: true },

      status_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },

      billing_address: { type: Sequelize.STRING(255), allowNull: true },

      created_by: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    // ✅ FK tanpa nama constraint (biar tidak conflict)
    await queryInterface.addConstraint("customers", {
      fields: ["business_unit_id"],
      type: "foreign key",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("customers", {
      fields: ["country_id"],
      type: "foreign key",
      references: { table: "countries", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("customers", {
      fields: ["user_id"],
      type: "foreign key",
      references: { table: "users", field: "U_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });

    await queryInterface.addIndex("customers", ["business_unit_id"], { name: "idx_customers_bu_id" });
    await queryInterface.addIndex("customers", ["country_id"], { name: "idx_customers_country_id" });
    await queryInterface.addIndex("customers", ["user_id"], { name: "idx_customers_user_id" });
    await queryInterface.addIndex("customers", ["status_active"], { name: "idx_customers_status_active" });
    await queryInterface.addIndex("customers", ["deleted_at"], { name: "idx_customers_deleted_at" });

    /**
     * 3) user_org_mappings
     */
    await queryInterface.createTable("user_org_mappings", {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },

      user_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => users.U_Id
      business_unit_id: { type: Sequelize.BIGINT, allowNull: false }, // FK => business_units.BU_Id

      branch_id: { type: Sequelize.BIGINT, allowNull: true }, // FK => branches.BR_Id
      warehouse_id: { type: Sequelize.BIGINT, allowNull: true }, // FK => warehouses.id
      customer_id: { type: Sequelize.BIGINT, allowNull: true }, // FK => customers.id

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
      created_by: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "system" },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });

    // ✅ FK tanpa nama constraint (biar tidak conflict)
    await queryInterface.addConstraint("user_org_mappings", {
      fields: ["user_id"],
      type: "foreign key",
      references: { table: "users", field: "U_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_org_mappings", {
      fields: ["business_unit_id"],
      type: "foreign key",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_org_mappings", {
      fields: ["branch_id"],
      type: "foreign key",
      references: { table: "branches", field: "BR_Id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_org_mappings", {
      fields: ["warehouse_id"],
      type: "foreign key",
      references: { table: "warehouses", field: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    await queryInterface.addConstraint("user_org_mappings", {
      fields: ["customer_id"],
      type: "foreign key",
      references: { table: "customers", field: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    // ✅ Unique kombinasi mapping: gunakan unique index (tanpa nama constraint manual)
    await queryInterface.addIndex(
      "user_org_mappings",
      ["user_id", "business_unit_id", "branch_id", "warehouse_id", "customer_id"],
      { unique: true, name: "uq_uom_user_bu_branch_wh_cust" }
    );

    await queryInterface.addIndex("user_org_mappings", ["user_id"], { name: "idx_uom_user_id" });
    await queryInterface.addIndex("user_org_mappings", ["business_unit_id"], { name: "idx_uom_bu_id" });
    await queryInterface.addIndex("user_org_mappings", ["branch_id"], { name: "idx_uom_branch_id" });
    await queryInterface.addIndex("user_org_mappings", ["warehouse_id"], { name: "idx_uom_warehouse_id" });
    await queryInterface.addIndex("user_org_mappings", ["customer_id"], { name: "idx_uom_customer_id" });
  },

  async down(queryInterface) {
    // drop child -> parent
    await queryInterface.dropTable("user_org_mappings");
    await queryInterface.dropTable("customers");
    await queryInterface.dropTable("warehouses");
    await queryInterface.dropTable("countries");
  },
};