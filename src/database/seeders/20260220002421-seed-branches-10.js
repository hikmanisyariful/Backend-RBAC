"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Id","BU_Code","BU_Name" FROM "business_units" ORDER BY "BU_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const rows = Array.from({ length: 10 }).map((_, i) => {
      const bu = bus[i % bus.length];
      return {
        BU_Id: bu.BU_Id,
        BR_Code: `BR-${String(i + 1).padStart(3, "0")}`,
        BR_Name: `Branch ${i + 1} (${bu.BU_Code})`,
        BR_Active: true,
        BR_IdERP: 100000 + i + 1,
        BR_DocPrefix: `D${i + 1}`,
        BR_CreatedBy: "seed",
        BR_CreatedAt: now,
        BR_UpdatedBy: "seed",
        BR_UpdatedAt: now,
      };
    });

    await queryInterface.bulkInsert("branches", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("branches", null, {});
  },
};