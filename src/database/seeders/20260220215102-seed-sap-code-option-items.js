"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const groups = await queryInterface.sequelize.query(
      `SELECT "SCG_Id","SCG_Code" FROM "sap_code_option_groups" ORDER BY "SCG_Id" ASC`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const byCode = new Map(groups.map((g) => [g.SCG_Code, g.SCG_Id]));

    const rows = [
      // FKSMA SAP
      { SCG_Id: byCode.get("FKSMA SAP"), SCI_SAPCode: "BJ-SMA", SCI_CreatedAt: now, SCI_UpdatedAt: now },
      { SCG_Id: byCode.get("FKSMA SAP"), SCI_SAPCode: "BJ-SMB", SCI_CreatedAt: now, SCI_UpdatedAt: now },

      // NPLOG SAP
      { SCG_Id: byCode.get("NPLOG SAP"), SCI_SAPCode: "ARG-SBM", SCI_CreatedAt: now, SCI_UpdatedAt: now },

      // SGT2 SAP
      { SCG_Id: byCode.get("SGT2 SAP"), SCI_SAPCode: "ARG", SCI_CreatedAt: now, SCI_UpdatedAt: now },
      { SCG_Id: byCode.get("SGT2 SAP"), SCI_SAPCode: "ARG-2", SCI_CreatedAt: now, SCI_UpdatedAt: now },

      // SGT3 SAP
      { SCG_Id: byCode.get("SGT3 SAP"), SCI_SAPCode: "ARG", SCI_CreatedAt: now, SCI_UpdatedAt: now },
      { SCG_Id: byCode.get("SGT3 SAP"), SCI_SAPCode: "ARG-3", SCI_CreatedAt: now, SCI_UpdatedAt: now },
    ].filter((r) => r.SCG_Id); // safety

    await queryInterface.bulkInsert("sap_code_option_items", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("sap_code_option_items", null, {});
  },
};