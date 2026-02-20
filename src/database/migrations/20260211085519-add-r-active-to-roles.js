"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // tambah kolom R_Active
    await queryInterface.addColumn("roles", "R_Active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    // (opsional) kalau data lama ada yang NULL, normalisasi
    await queryInterface.sequelize.query(
      `UPDATE roles SET "R_Active" = true WHERE "R_Active" IS NULL`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("roles", "R_Active");
  },
};
