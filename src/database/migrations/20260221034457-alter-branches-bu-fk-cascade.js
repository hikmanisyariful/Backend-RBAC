"use strict";

module.exports = {
  async up(queryInterface) {
    // 1) drop FK lama
    await queryInterface.removeConstraint("branches", "fk_branches_bu");

    // 2) add FK baru (CASCADE)
    await queryInterface.addConstraint("branches", {
      fields: ["BU_Id"],
      type: "foreign key",
      name: "fk_branches_bu",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface) {
    // rollback: balikin ke RESTRICT
    await queryInterface.removeConstraint("branches", "fk_branches_bu");

    await queryInterface.addConstraint("branches", {
      fields: ["BU_Id"],
      type: "foreign key",
      name: "fk_branches_bu",
      references: { table: "business_units", field: "BU_Id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  },
};