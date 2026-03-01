"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ambil vessels
    const vessels = await queryInterface.sequelize.query(
      `SELECT "VS_Id","VS_Name" FROM "vessels" ORDER BY "VS_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // ambil business units untuk isi BusinessUnitCode/Name
    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Code","BU_Name" FROM "business_units" ORDER BY "BU_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!vessels?.length)
      throw new Error("No vessels found. Run seed-vessels first.");
    if (!bus?.length)
      throw new Error("No business_units found. Run seed-business-units first.");

    const rows = [];

    // 2 mapping per vessel, pilih BU berdasarkan index vessel agar nyebar merata
    for (let i = 0; i < vessels.length; i++) {
      const v = vessels[i];

      for (let j = 0; j < 2; j++) {
        const bu = bus[(i * 2 + j) % bus.length];

        rows.push({
          VS_Id: v.VS_Id,
          VSM_BusinessUnitCode: bu.BU_Code,
          VSM_BusinessUnitName: bu.BU_Name,
          VSM_SAPCode: `SAP-${bu.BU_Code}-${String(v.VS_Id).padStart(3, "0")}-${j + 1}`,
          VSM_CreatedAt: now,
          VSM_UpdatedAt: now,
        });
      }
    }

    await queryInterface.bulkInsert("vessel_sap_code_mappings", rows);
  },

  async down(queryInterface, Sequelize) {
    // Aman: hanya hapus data yang format SAPCode-nya dari seeder ini
    await queryInterface.bulkDelete(
      "vessel_sap_code_mappings",
      {
        VSM_SAPCode: {
          [Sequelize.Op.like]: "SAP-%",
        },
      },
      {}
    );
  },
};