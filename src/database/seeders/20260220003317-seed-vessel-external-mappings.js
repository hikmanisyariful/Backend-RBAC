"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const vessels = await queryInterface.sequelize.query(
      `SELECT "VS_Id" FROM "vessels" ORDER BY "VS_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!vessels.length) throw new Error("No vessels found. Run seed-vessels first.");

    const rows = vessels.map((v, i) => ({
      VS_Id: v.VS_Id,

      VEM_ExternalSystemCode: i % 2 === 0 ? "EXTSYS-A" : "EXTSYS-B",
      VEM_ExternalName: i % 2 === 0 ? "External System A" : "External System B",
      VEM_ExternalCode: `EXT-${String(i + 1).padStart(4, "0")}`,

      VEM_WarehouseCode: `WH-${String((i % 5) + 1).padStart(2, "0")}`,
      VEM_WarehouseName: `Warehouse ${(i % 5) + 1}`,

      VEM_CreatedAt: now,
      VEM_UpdatedAt: now,
    }));

    await queryInterface.bulkInsert("vessel_external_code_mappings", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("vessel_external_code_mappings", null, {});
  },
};