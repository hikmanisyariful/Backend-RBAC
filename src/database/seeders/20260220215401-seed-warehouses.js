"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const branches = await queryInterface.sequelize.query(
      `SELECT "BR_Id","BR_Code" FROM "branches" ORDER BY "BR_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!branches.length) throw new Error("No branches found. Seed branches first.");

    const rows = [];
    // buat 2 warehouse per branch sampai minimal 10 row
    for (let i = 0; i < branches.length && rows.length < 10; i++) {
      const br = branches[i];
      rows.push({
        BR_Id: br.BR_Id,
        WH_Code: `WH-${String(i + 1).padStart(2, "0")}-A`,
        WH_Name: `Warehouse ${br.BR_Code} A`,
        WH_IsTransit: true,
        WH_CreatedBy: "seed",
        WH_CreatedAt: now,
        WH_UpdatedBy: "seed",
        WH_UpdatedAt: now,
      });
      if (rows.length >= 10) break;
      rows.push({
        BR_Id: br.BR_Id,
        WH_Code: `WH-${String(i + 1).padStart(2, "0")}-B`,
        WH_Name: `Warehouse ${br.BR_Code} B`,
        WH_IsTransit: false,
        WH_CreatedBy: "seed",
        WH_CreatedAt: now,
        WH_UpdatedBy: "seed",
        WH_UpdatedAt: now,
      });
    }

    await queryInterface.bulkInsert("warehouses", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("warehouses", null, {});
  },
};