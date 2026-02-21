"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const rows = Array.from({ length: 10 }).map((_, i) => ({
      BU_Code: `BU-${String(i + 1).padStart(3, "0")}`,
      BU_Name: `Business Unit ${i + 1}`,
      BU_Active: true,
      BU_CreatedBy: "seed",
      BU_CreatedAt: now,
      BU_UpdatedBy: "seed",
      BU_UpdatedAt: now,
    }));

    await queryInterface.bulkInsert("business_units", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("business_units", null, {});
  },
};