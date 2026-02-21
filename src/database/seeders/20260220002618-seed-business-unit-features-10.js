"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const rows = Array.from({ length: 10 }).map((_, i) => ({
      BUF_Code: `FEATURE-${String(i + 1).padStart(3, "0")}`,
      BUF_Name: `Feature ${i + 1}`,
      BUF_CreatedAt: now,
      BUF_UpdatedAt: now,
    }));

    await queryInterface.bulkInsert("business_unit_features", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("business_unit_features", null, {});
  },
};