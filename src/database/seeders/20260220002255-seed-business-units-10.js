"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const rows = [
      {
        BU_Code: "FKSMA",
        BU_Name: "FKS Multi Agro",
        BU_Active: true,
        BU_CreatedBy: "seed",
        BU_CreatedAt: now,
        BU_UpdatedBy: "seed",
        BU_UpdatedAt: now,
      },
      {
        BU_Code: "NPLOG",
        BU_Name: "Nusa Prima Logistik",
        BU_Active: true,
        BU_CreatedBy: "seed",
        BU_CreatedAt: now,
        BU_UpdatedBy: "seed",
        BU_UpdatedAt: now,
      },
      {
        BU_Code: "SGT2",
        BU_Name: "Sentral Grain terminal",
        BU_Active: true,
        BU_CreatedBy: "seed",
        BU_CreatedAt: now,
        BU_UpdatedBy: "seed",
        BU_UpdatedAt: now,
      },
      {
        BU_Code: "SGT3",
        BU_Name: "Sentral Gudang Terminal",
        BU_Active: true,
        BU_CreatedBy: "seed",
        BU_CreatedAt: now,
        BU_UpdatedBy: "seed",
        BU_UpdatedAt: now,
      },
    ];

    await queryInterface.bulkInsert("business_units", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      "business_units",
      {
        BU_Code: ["FKSMA", "NPLOG", "SGT2", "SGT3"],
      },
      {},
    );
  },
};