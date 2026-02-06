"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash("password123", 10);
    await queryInterface.sequelize.query(
      `UPDATE users SET "U_PasswordHash"=:hash WHERE "U_Username"='u1'`,
      { replacements: { hash } }
    );
  },
  async down() {
    // no-op
  },
};

