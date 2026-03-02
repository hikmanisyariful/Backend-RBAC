"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    /**
     * =========================================
     * Helpers
     * =========================================
     */
    async function getMenuIdByCode(code) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT "M_Id" FROM menus WHERE "M_Code"=:code LIMIT 1`,
        { replacements: { code } }
      );
      return rows?.[0]?.M_Id ?? null;
    }

    async function insertMenuIfNotExists(menu) {
      const existingId = await getMenuIdByCode(menu.M_Code);
      if (!existingId) {
        await queryInterface.bulkInsert("menus", [menu]);
      }
    }

    async function updateMenuParent(code, parentId) {
      await queryInterface.bulkUpdate(
        "menus",
        { M_ParentId: parentId, M_UpdatedBy: "seed", M_UpdatedAt: now },
        { M_Code: code }
      );
    }

    async function upsertPermission(p) {
      const [exists] = await queryInterface.sequelize.query(
        `SELECT "P_Id" FROM permissions WHERE "P_Code"=:code LIMIT 1`,
        { replacements: { code: p.P_Code } }
      );

      if (exists.length === 0) {
        await queryInterface.bulkInsert("permissions", [
          {
            ...p,
            P_CreatedBy: "seed",
            P_CreatedAt: now,
            P_UpdatedBy: "seed",
            P_UpdatedAt: now,
          },
        ]);
      } else {
        // optional: keep description/name updated when rerun
        await queryInterface.bulkUpdate(
          "permissions",
          {
            P_Name: p.P_Name,
            P_Description: p.P_Description,
            P_UpdatedBy: "seed",
            P_UpdatedAt: now,
          },
          { P_Code: p.P_Code }
        );
      }
    }

    /**
     * =========================================
     * 1) Define menu tree
     * - GROUP: top module
     * - MENU: intermediate node
     * - SUBMENU: leaf/screen (permission attached)
     * =========================================
     */
    const menus = [
      // ===== TOP GROUPS =====
      {
        M_Code: "CONTROLHUB",
        M_Name: "ControlHub",
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
      },
      {
        M_Code: "TRANSACTION",
        M_Name: "Transaction",
        M_ParentId: null,
        M_Route: "",
        M_MenuType: "GROUP",
        M_Icon: "",
        M_MenuLevel: 1,
        M_OrderPosition: 2,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "MASTER_DATA",
        M_Name: "Master Data",
        M_ParentId: null,
        M_Route: "",
        M_MenuType: "GROUP",
        M_Icon: "",
        M_MenuLevel: 1,
        M_OrderPosition: 3,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "SYSTEM_MODULES",
        M_Name: "System Modules",
        M_ParentId: null,
        M_Route: "",
        M_MenuType: "GROUP",
        M_Icon: "",
        M_MenuLevel: 1,
        M_OrderPosition: 4,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },

      // ===== CONTROLHUB =====
      {
        M_Code: "CONTROLHUB_DASHBOARD",
        M_Name: "Dashboard",
        M_ParentId: null, // set later
        M_Route: "/controlhub/dashboard",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 1,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "CONTROLHUB_MONITORING",
        M_Name: "Monitoring",
        M_ParentId: null, // set later
        M_Route: "",
        M_MenuType: "MENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 2,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "CONTROLHUB_TRAFFIC_MONITORING",
        M_Name: "Traffic Monitoring",
        M_ParentId: null, // set later
        M_Route: "/controlhub/monitoring/traffic-monitoring",
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
      },
      {
        M_Code: "CONTROLHUB_ALERT_MONITORING",
        M_Name: "Alert Monitoring",
        M_ParentId: null, // set later
        M_Route: "/controlhub/monitoring/alert-monitoring",
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
      },
      {
        M_Code: "CONTROLHUB_VESSEL_DISCHARGING",
        M_Name: "Vessel Discharging",
        M_ParentId: null, // set later
        M_Route: "/controlhub/monitoring/vessel-discharging",
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
      },
      {
        M_Code: "CONTROLHUB_NOTIFICATION",
        M_Name: "Notification",
        M_ParentId: null, // set later
        M_Route: "/controlhub/notification",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 3,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "CONTROLHUB_APPROVAL",
        M_Name: "Approval",
        M_ParentId: null, // set later
        M_Route: "/controlhub/approval",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 4,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },

      // ===== TRANSACTION =====
      {
        M_Code: "TRANSACTION_REFERENCE_DOCUMENT",
        M_Name: "Reference Document",
        M_ParentId: null, // set later
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
      },
      {
        M_Code: "TRANSACTION_REF_INBOUND",
        M_Name: "Inbound",
        M_ParentId: null, // set later
        M_Route: "/transaction/reference-document/inbound",
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
      },
      {
        M_Code: "TRANSACTION_MANIFEST_DOCUMENT",
        M_Name: "Manifest Document",
        M_ParentId: null, // set later
        M_Route: "/transaction/reference-document/manifest-document",
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
      },
      // Transaction leaf screens
      {
        M_Code: "TRANSACTION_REWORK",
        M_Name: "Rework",
        M_ParentId: null,
        M_Route: "/transaction/rework",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 2,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "TRANSACTION_VESSEL_LINE_UP",
        M_Name: "Vessel Line Up",
        M_ParentId: null,
        M_Route: "/transaction/vessel-line-up",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 3,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "TRANSACTION_DISCHARGE",
        M_Name: "Discharge",
        M_ParentId: null,
        M_Route: "/transaction/discharge",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 4,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "TRANSACTION_INBOUND",
        M_Name: "Inbound",
        M_ParentId: null,
        M_Route: "/transaction/inbound",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 5,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "TRANSACTION_OUTBOUND",
        M_Name: "Outbound",
        M_ParentId: null,
        M_Route: "/transaction/outbound",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 6,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "TRANSACTION_REALIZATION_SUMMARY",
        M_Name: "Realization Summary",
        M_ParentId: null,
        M_Route: "/transaction/realization-summary",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 7,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      {
        M_Code: "TRANSACTION_PRO_RATE",
        M_Name: "Pro Rate",
        M_ParentId: null,
        M_Route: "/transaction/pro-rate",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 8,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },

      // ===== MASTER DATA =====
      {
        M_Code: "MASTER_DATA_BUSINESS_UNIT",
        M_Name: "Business Unit",
        M_ParentId: null,
        M_Route: "/master-data/business-unit",
        M_MenuType: "SUBMENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 1,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },

      {
        M_Code: "MASTER_DATA_STORAGE",
        M_Name: "Storage",
        M_ParentId: null,
        M_Route: "",
        M_MenuType: "MENU",
        M_Icon: "",
        M_MenuLevel: 2,
        M_OrderPosition: 2,
        M_Active: true,
        M_IsSelected: false,
        M_CreatedBy: "seed",
        M_CreatedAt: now,
        M_UpdatedBy: "seed",
        M_UpdatedAt: now,
      },
      { M_Code: "MASTER_DATA_STORAGE_BRANCH", M_Name: "Branch", M_ParentId: null, M_Route: "/master-data/storage/branch", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_STORAGE_WAREHOUSE", M_Name: "Warehouse", M_ParentId: null, M_Route: "/master-data/storage/warehouse", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_STORAGE_LOCATION", M_Name: "Storage Location", M_ParentId: null, M_Route: "/master-data/storage/storage-location", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 3, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_LOADING_POINT", M_Name: "Loading Point", M_ParentId: null, M_Route: "/master-data/storage/loading-point", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 4, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "MASTER_DATA_PORT", M_Name: "Port", M_ParentId: null, M_Route: "/master-data/port", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 3, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_VESSEL", M_Name: "Vessel", M_ParentId: null, M_Route: "/master-data/vessel", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 4, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_TRANSPORTER", M_Name: "Transporter", M_ParentId: null, M_Route: "/master-data/transporter", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 5, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_CUSTOMER", M_Name: "Customer", M_ParentId: null, M_Route: "/master-data/customer", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 6, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "MASTER_DATA_PRODUCT", M_Name: "Product", M_ParentId: null, M_Route: "", M_MenuType: "MENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 7, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_PRODUCT_PRODUCT", M_Name: "Product", M_ParentId: null, M_Route: "/master-data/product/product", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_PRODUCT_UOM", M_Name: "UOM", M_ParentId: null, M_Route: "/master-data/product/uom", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_PRODUCT_BRAND", M_Name: "Brand", M_ParentId: null, M_Route: "/master-data/product/brand", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 3, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "MASTER_DATA_TOOLS", M_Name: "Tools", M_ParentId: null, M_Route: "", M_MenuType: "MENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 8, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_TOOLS_EQUIPMENT", M_Name: "Equipment", M_ParentId: null, M_Route: "/master-data/tools/equipment", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_TOOLS_SENSOR", M_Name: "Sensor", M_ParentId: null, M_Route: "/master-data/tools/sensor", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "MASTER_DATA_CHARGES", M_Name: "Charges", M_ParentId: null, M_Route: "", M_MenuType: "MENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 9, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_BOP_WEIGHT_CHARGE", M_Name: "BOP Weight Charge", M_ParentId: null, M_Route: "/master-data/charges/bop-weight-charge", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "MASTER_DATA_BOP_CHARGE_SETTING", M_Name: "BOP Charge Setting", M_ParentId: null, M_Route: "/master-data/charges/bop-charge-setting", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "MASTER_DATA_OFFLOADING_ACTIVITY", M_Name: "Offloading Activity", M_ParentId: null, M_Route: "/master-data/offloading-activity", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 10, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      // ===== SYSTEM MODULES =====
      { M_Code: "SYSTEM_REPORT", M_Name: "Report", M_ParentId: null, M_Route: "/system-modules/report", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "SYSTEM_UTILITIES", M_Name: "Utilities", M_ParentId: null, M_Route: "/system-modules/utilities", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "SYSTEM_USER_PERMISSION", M_Name: "User Permission", M_ParentId: null, M_Route: "", M_MenuType: "MENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 3, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "SYSTEM_ROLE_MANAGEMENT", M_Name: "Role Management", M_ParentId: null, M_Route: "/system-modules/user-permission/role-management", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "SYSTEM_USER_MANAGEMENT", M_Name: "User Management", M_ParentId: null, M_Route: "/system-modules/user-permission/user-management", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },

      { M_Code: "SYSTEM_CONFIGURATION", M_Name: "Configuration", M_ParentId: null, M_Route: "", M_MenuType: "MENU", M_Icon: "", M_MenuLevel: 2, M_OrderPosition: 4, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "SYSTEM_CONFIG_MENU", M_Name: "Menu", M_ParentId: null, M_Route: "/system-modules/configuration/menu", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 1, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
      { M_Code: "SYSTEM_CONFIG_APPROVAL_SCHEME", M_Name: "Approval Scheme", M_ParentId: null, M_Route: "/system-modules/configuration/approval-scheme", M_MenuType: "SUBMENU", M_Icon: "", M_MenuLevel: 3, M_OrderPosition: 2, M_Active: true, M_IsSelected: false, M_CreatedBy: "seed", M_CreatedAt: now, M_UpdatedBy: "seed", M_UpdatedAt: now },
    ];

    /**
     * =========================================
     * 2) Insert menus (idempotent)
     * =========================================
     */
    for (const m of menus) await insertMenuIfNotExists(m);

    /**
     * =========================================
     * 3) Fix parent relations (idempotent)
     * =========================================
     */
    const id = {
      CONTROLHUB: await getMenuIdByCode("CONTROLHUB"),
      TRANSACTION: await getMenuIdByCode("TRANSACTION"),
      MASTER_DATA: await getMenuIdByCode("MASTER_DATA"),
      SYSTEM_MODULES: await getMenuIdByCode("SYSTEM_MODULES"),

      CONTROLHUB_MONITORING: await getMenuIdByCode("CONTROLHUB_MONITORING"),
      TRANSACTION_REFERENCE_DOCUMENT: await getMenuIdByCode("TRANSACTION_REFERENCE_DOCUMENT"),
      MASTER_DATA_STORAGE: await getMenuIdByCode("MASTER_DATA_STORAGE"),
      MASTER_DATA_PRODUCT: await getMenuIdByCode("MASTER_DATA_PRODUCT"),
      MASTER_DATA_TOOLS: await getMenuIdByCode("MASTER_DATA_TOOLS"),
      MASTER_DATA_CHARGES: await getMenuIdByCode("MASTER_DATA_CHARGES"),
      SYSTEM_USER_PERMISSION: await getMenuIdByCode("SYSTEM_USER_PERMISSION"),
      SYSTEM_CONFIGURATION: await getMenuIdByCode("SYSTEM_CONFIGURATION"),
    };

    // ControlHub children
    await updateMenuParent("CONTROLHUB_DASHBOARD", id.CONTROLHUB);
    await updateMenuParent("CONTROLHUB_MONITORING", id.CONTROLHUB);
    await updateMenuParent("CONTROLHUB_NOTIFICATION", id.CONTROLHUB);
    await updateMenuParent("CONTROLHUB_APPROVAL", id.CONTROLHUB);

    await updateMenuParent("CONTROLHUB_TRAFFIC_MONITORING", id.CONTROLHUB_MONITORING);
    await updateMenuParent("CONTROLHUB_ALERT_MONITORING", id.CONTROLHUB_MONITORING);
    await updateMenuParent("CONTROLHUB_VESSEL_DISCHARGING", id.CONTROLHUB_MONITORING);

    // Transaction children
    await updateMenuParent("TRANSACTION_REFERENCE_DOCUMENT", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_REWORK", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_VESSEL_LINE_UP", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_DISCHARGE", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_INBOUND", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_OUTBOUND", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_REALIZATION_SUMMARY", id.TRANSACTION);
    await updateMenuParent("TRANSACTION_PRO_RATE", id.TRANSACTION);

    await updateMenuParent("TRANSACTION_REF_INBOUND", id.TRANSACTION_REFERENCE_DOCUMENT);
    await updateMenuParent("TRANSACTION_MANIFEST_DOCUMENT", id.TRANSACTION_REFERENCE_DOCUMENT);

    // Master Data children
    await updateMenuParent("MASTER_DATA_BUSINESS_UNIT", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_STORAGE", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_PORT", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_VESSEL", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_TRANSPORTER", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_CUSTOMER", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_PRODUCT", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_TOOLS", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_CHARGES", id.MASTER_DATA);
    await updateMenuParent("MASTER_DATA_OFFLOADING_ACTIVITY", id.MASTER_DATA);

    await updateMenuParent("MASTER_DATA_STORAGE_BRANCH", id.MASTER_DATA_STORAGE);
    await updateMenuParent("MASTER_DATA_STORAGE_WAREHOUSE", id.MASTER_DATA_STORAGE);
    await updateMenuParent("MASTER_DATA_STORAGE_LOCATION", id.MASTER_DATA_STORAGE);
    await updateMenuParent("MASTER_DATA_LOADING_POINT", id.MASTER_DATA_STORAGE);

    await updateMenuParent("MASTER_DATA_PRODUCT_PRODUCT", id.MASTER_DATA_PRODUCT);
    await updateMenuParent("MASTER_DATA_PRODUCT_UOM", id.MASTER_DATA_PRODUCT);
    await updateMenuParent("MASTER_DATA_PRODUCT_BRAND", id.MASTER_DATA_PRODUCT);

    await updateMenuParent("MASTER_DATA_TOOLS_EQUIPMENT", id.MASTER_DATA_TOOLS);
    await updateMenuParent("MASTER_DATA_TOOLS_SENSOR", id.MASTER_DATA_TOOLS);

    await updateMenuParent("MASTER_DATA_BOP_WEIGHT_CHARGE", id.MASTER_DATA_CHARGES);
    await updateMenuParent("MASTER_DATA_BOP_CHARGE_SETTING", id.MASTER_DATA_CHARGES);

    // System Modules children
    await updateMenuParent("SYSTEM_REPORT", id.SYSTEM_MODULES);
    await updateMenuParent("SYSTEM_UTILITIES", id.SYSTEM_MODULES);
    await updateMenuParent("SYSTEM_USER_PERMISSION", id.SYSTEM_MODULES);
    await updateMenuParent("SYSTEM_CONFIGURATION", id.SYSTEM_MODULES);

    await updateMenuParent("SYSTEM_ROLE_MANAGEMENT", id.SYSTEM_USER_PERMISSION);
    await updateMenuParent("SYSTEM_USER_MANAGEMENT", id.SYSTEM_USER_PERMISSION);

    await updateMenuParent("SYSTEM_CONFIG_MENU", id.SYSTEM_CONFIGURATION);
    await updateMenuParent("SYSTEM_CONFIG_APPROVAL_SCHEME", id.SYSTEM_CONFIGURATION);

    /**
     * =========================================
     * 4) Permissions for leaf menus only
     * - actions: VIEW, VIEW_DETAIL, CREATE, UPDATE, DELETE
     * =========================================
     */
    const actions = [
      { key: "VIEW", label: "View", desc: "View list/page" },
      { key: "VIEW_DETAIL", label: "View Detail", desc: "View detail data" },
      { key: "CREATE", label: "Create", desc: "Create data" },
      { key: "UPDATE", label: "Update", desc: "Update data" },
      { key: "DELETE", label: "Delete", desc: "Delete data" },
    ];

    // leaf = screens (SUBMENU)
    const leafMenuCodes = menus
      .filter((m) => m.M_MenuType === "SUBMENU")
      .map((m) => m.M_Code);

    const permissionCodes = [];

    for (const menuCode of leafMenuCodes) {
      for (const a of actions) {
        const P_Code = `${menuCode}.${a.key}`;
        permissionCodes.push(P_Code);

        await upsertPermission({
          P_Code,
          P_Name: a.label,
          P_Description: `${a.desc} for ${menuCode}`,
        });
      }
    }

    // Optional: if you need return/usage, keep permissionCodes
  },

  async down(queryInterface) {
    /**
     * IMPORTANT:
     * - delete mapping tables FIRST (FK)
     * - then permissions
     * - then menus
     */
    const menuCodes = [
      "CONTROLHUB",
      "TRANSACTION",
      "MASTER_DATA",
      "SYSTEM_MODULES",

      "CONTROLHUB_DASHBOARD",
      "CONTROLHUB_MONITORING",
      "CONTROLHUB_TRAFFIC_MONITORING",
      "CONTROLHUB_ALERT_MONITORING",
      "CONTROLHUB_VESSEL_DISCHARGING",
      "CONTROLHUB_NOTIFICATION",
      "CONTROLHUB_APPROVAL",

      "TRANSACTION_REFERENCE_DOCUMENT",
      "TRANSACTION_REF_INBOUND",
      "TRANSACTION_MANIFEST_DOCUMENT",
      "TRANSACTION_REWORK",
      "TRANSACTION_VESSEL_LINE_UP",
      "TRANSACTION_DISCHARGE",
      "TRANSACTION_INBOUND",
      "TRANSACTION_OUTBOUND",
      "TRANSACTION_REALIZATION_SUMMARY",
      "TRANSACTION_PRO_RATE",

      "MASTER_DATA_BUSINESS_UNIT",
      "MASTER_DATA_STORAGE",
      "MASTER_DATA_STORAGE_BRANCH",
      "MASTER_DATA_STORAGE_WAREHOUSE",
      "MASTER_DATA_STORAGE_LOCATION",
      "MASTER_DATA_LOADING_POINT",
      "MASTER_DATA_PORT",
      "MASTER_DATA_VESSEL",
      "MASTER_DATA_TRANSPORTER",
      "MASTER_DATA_CUSTOMER",
      "MASTER_DATA_PRODUCT",
      "MASTER_DATA_PRODUCT_PRODUCT",
      "MASTER_DATA_PRODUCT_UOM",
      "MASTER_DATA_PRODUCT_BRAND",
      "MASTER_DATA_TOOLS",
      "MASTER_DATA_TOOLS_EQUIPMENT",
      "MASTER_DATA_TOOLS_SENSOR",
      "MASTER_DATA_CHARGES",
      "MASTER_DATA_BOP_WEIGHT_CHARGE",
      "MASTER_DATA_BOP_CHARGE_SETTING",
      "MASTER_DATA_OFFLOADING_ACTIVITY",

      "SYSTEM_REPORT",
      "SYSTEM_UTILITIES",
      "SYSTEM_USER_PERMISSION",
      "SYSTEM_ROLE_MANAGEMENT",
      "SYSTEM_USER_MANAGEMENT",
      "SYSTEM_CONFIGURATION",
      "SYSTEM_CONFIG_MENU",
      "SYSTEM_CONFIG_APPROVAL_SCHEME",
    ];

    const [menuRows] = await queryInterface.sequelize.query(
      `SELECT "M_Id","M_Code" FROM menus WHERE "M_Code" IN (:codes)`,
      { replacements: { codes: menuCodes } }
    );
    const menuIds = menuRows.map((m) => m.M_Id);

    // find permissions by prefix menuCode.
    const [permRows] = await queryInterface.sequelize.query(
      `SELECT "P_Id","P_Code" FROM permissions
       WHERE (${menuCodes.map((c) => `"P_Code" LIKE '${c}.%'`).join(" OR ")})`
    );
    const permIds = permRows.map((p) => p.P_Id);

    // Remove role/user mappings (scoped)
    // role_menu_permission_items via RMPs for these menus
    const [rmpRows] = await queryInterface.sequelize.query(
      `SELECT "RMP_Id" FROM role_menu_permissions WHERE "MenuId" IN (:menuIds)`,
      { replacements: { menuIds } }
    );
    const rmpIds = rmpRows.map((r) => r.RMP_Id);

    if (rmpIds.length) {
      await queryInterface.bulkDelete("role_menu_permission_items", { RMP_Id: rmpIds });
      await queryInterface.bulkDelete("role_menu_permissions", { RMP_Id: rmpIds });
    }

    const [umpRows] = await queryInterface.sequelize.query(
      `SELECT "UMP_Id" FROM user_menu_permissions WHERE "MenuId" IN (:menuIds)`,
      { replacements: { menuIds } }
    );
    const umpIds = umpRows.map((r) => r.UMP_Id);

    if (umpIds.length) {
      await queryInterface.bulkDelete("user_menu_permission_items", { UMP_Id: umpIds });
      await queryInterface.bulkDelete("user_menu_permissions", { UMP_Id: umpIds });
    }

    // Delete permissions (scoped)
    if (permIds.length) {
      await queryInterface.bulkDelete("permissions", { P_Id: permIds });
    }

    // Delete menus (scoped)
    await queryInterface.bulkDelete("menus", { M_Code: menuCodes });
  },
};