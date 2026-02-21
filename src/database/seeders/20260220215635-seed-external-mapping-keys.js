"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("external_mapping_keys", [
      { EMK_Key: "KBS-SGT2", EMK_CreatedAt: now, EMK_UpdatedAt: now },
      { EMK_Key: "KBS-SGT3", EMK_CreatedAt: now, EMK_UpdatedAt: now },
      { EMK_Key: "KBS-FKSMA", EMK_CreatedAt: now, EMK_UpdatedAt: now },
      { EMK_Key: "KBS-NPLOG", EMK_CreatedAt: now, EMK_UpdatedAt: now },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("external_mapping_keys", null, {});
  },
};