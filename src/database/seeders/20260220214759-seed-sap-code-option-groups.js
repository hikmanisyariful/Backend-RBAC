"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("sap_code_option_groups", [
      { SCG_Code: "FKSMA SAP", SCG_CreatedBy: "seed", SCG_CreatedAt: now, SCG_UpdatedBy: "seed", SCG_UpdatedAt: now },
      { SCG_Code: "NPLOG SAP", SCG_CreatedBy: "seed", SCG_CreatedAt: now, SCG_UpdatedBy: "seed", SCG_UpdatedAt: now },
      { SCG_Code: "SGT2 SAP",  SCG_CreatedBy: "seed", SCG_CreatedAt: now, SCG_UpdatedBy: "seed", SCG_UpdatedAt: now },
      { SCG_Code: "SGT3 SAP",  SCG_CreatedBy: "seed", SCG_CreatedAt: now, SCG_UpdatedBy: "seed", SCG_UpdatedAt: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("sap_code_option_groups", null, {});
  },
};