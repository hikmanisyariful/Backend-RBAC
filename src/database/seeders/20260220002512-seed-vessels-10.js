"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const rows = Array.from({ length: 10 }).map((_, i) => ({
      VS_Imo: `IMO${String(9000000 + i + 1)}`,
      VS_Name: `Vessel ${i + 1}`,
      VS_Type: i % 2 === 0 ? "BULK" : "TANKER",
      VS_Category: i % 2 === 0 ? "INBOUND" : "OUTBOUND",
      VS_Weight: (10000 + i * 500).toFixed(2),
      VS_MaxCapacity: (20000 + i * 800).toFixed(2),
      VS_Active: true,
      VS_CreatedBy: "seed",
      VS_CreatedAt: now,
      VS_UpdatedBy: "seed",
      VS_UpdatedAt: now,
    }));

    await queryInterface.bulkInsert("vessels", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("vessels", null, {});
  },
};