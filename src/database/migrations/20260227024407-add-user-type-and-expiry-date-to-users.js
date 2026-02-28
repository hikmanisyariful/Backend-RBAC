"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "U_UserType", {
      type: Sequelize.STRING(50),
      allowNull: true,
      // defaultValue: "user", // opsional
    });

    await queryInterface.addColumn("users", "U_ExpiryDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("users", "U_ExpiryDate");
    await queryInterface.removeColumn("users", "U_UserType");
  },
};