"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Id","BU_Code" FROM "business_units" ORDER BY "BU_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    if (!bus?.length) return;

    const rows = bus.map((bu) => ({
      BU_Id: bu.BU_Id,
      BUSA_FeatureName: `SAP_${bu.BU_Code}_FEATURE`,
      BUSA_Endpoint: `/sap/${String(bu.BU_Code).toLowerCase()}/endpoint`,
      BUSA_CreatedAt: now,
      BUSA_UpdatedAt: now,
    }));

    await queryInterface.bulkInsert("business_unit_sap_integrations", rows);
  },

  async down(queryInterface, Sequelize) {
    // aman: hanya hapus yang sesuai BU_Code yg ada
    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Code" FROM "business_units"`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const codes = (bus ?? []).map((x) => x.BU_Code).filter(Boolean);

    if (!codes.length) {
      await queryInterface.bulkDelete(
        "business_unit_sap_integrations",
        null,
        {},
      );
      return;
    }

    await queryInterface.bulkDelete(
      "business_unit_sap_integrations",
      {
        BUSA_FeatureName: {
          [Sequelize.Op.in]: codes.map((c) => `SAP_${c}_FEATURE`),
        },
      },
      {},
    );
  },
};