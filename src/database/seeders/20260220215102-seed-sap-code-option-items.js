"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    // ambil BU (buat nentuin jumlah BU)
    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Code" FROM "business_units" ORDER BY "BU_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!bus?.length)
      throw new Error('No business_units found. Run seed-business-units first.');

    // ambil group untuk lookup SCG_Id
    const groups = await queryInterface.sequelize.query(
      `SELECT "SCG_Id","SCG_Code" FROM "sap_code_option_groups" ORDER BY "SCG_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!groups?.length)
      throw new Error(
        'No sap_code_option_groups found. Run seed-sap-code-option-groups first.'
      );

    const byGroupCode = new Map(groups.map((g) => [g.SCG_Code, g.SCG_Id]));

    const PER_BU = 2; // <-- mau berapa item per BU

    const rows = [];
    for (const bu of bus) {
      const buCode = String(bu.BU_Code).trim();
      const groupCode = `${buCode} SAP`;
      const scgId = byGroupCode.get(groupCode);

      if (!scgId) {
        // kalau group belum ada, skip biar seeder tetap jalan
        continue;
      }

      for (let i = 1; i <= PER_BU; i++) {
        rows.push({
          SCG_Id: scgId,
          SCI_SAPCode: `${buCode}-${String(i).padStart(2, "0")}`,
          SCI_CreatedAt: now,
          SCI_UpdatedAt: now,
        });
      }
    }

    if (!rows.length) return;

    await queryInterface.bulkInsert("sap_code_option_items", rows);
  },

  async down(queryInterface, Sequelize) {
    // hapus hanya yang dibuat berdasarkan BU yang ada
    const bus = await queryInterface.sequelize.query(
      `SELECT "BU_Code" FROM "business_units"`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const codes = (bus ?? []).map((x) => String(x.BU_Code).trim()).filter(Boolean);
    if (!codes.length) {
      await queryInterface.bulkDelete("sap_code_option_items", null, {});
      return;
    }

    const seededSapCodes = codes.flatMap((c) => [`${c}-01`, `${c}-02`]);

    await queryInterface.bulkDelete(
      "sap_code_option_items",
      {
        SCI_SAPCode: {
          [Sequelize.Op.in]: seededSapCodes,
        },
      },
      {},
    );
  },
};