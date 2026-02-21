"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Id","BU_Code" FROM "business_units" ORDER BY "BU_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const rows = Array.from({ length: 10 }).map((_, i) => {
      const bu = bus[i % bus.length];
      return {
        BU_Id: bu.BU_Id,
        BUSA_FeatureName: `SAP_${bu.BU_Code}_FEATURE_${i + 1}`,
        BUSA_Endpoint: `/sap/${bu.BU_Code.toLowerCase()}/endpoint/${i + 1}`,
        BUSA_CreatedAt: now,
        BUSA_UpdatedAt: now,
      };
    });

    await queryInterface.bulkInsert("business_unit_sap_integrations", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("business_unit_sap_integrations", null, {});
  },
};