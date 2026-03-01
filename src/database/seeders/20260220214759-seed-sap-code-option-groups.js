"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Code" FROM "business_units" ORDER BY "BU_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT },
    );

    if (!bus?.length)
      throw new Error(
        "No business_units found. Run seed-business-units first.",
      );

    const rows = bus.map((bu) => ({
      SCG_Code: `${bu.BU_Code} SAP`,
      SCG_CreatedBy: "seed",
      SCG_CreatedAt: now,
      SCG_UpdatedBy: "seed",
      SCG_UpdatedAt: now,
    }));

    await queryInterface.bulkInsert("sap_code_option_groups", rows);
  },

  async down(queryInterface, Sequelize) {
    // aman: hanya hapus yang dibuat seeder ini
    await queryInterface.bulkDelete(
      "sap_code_option_groups",
      { SCG_CreatedBy: "seed" },
      {},
    );
  },
};