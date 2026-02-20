"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  async up(queryInterface) {
    // pastikan kolom ada (karena kamu punya migration add U_PasswordHash)
    const usersTable = await queryInterface.describeTable("users");
    if (!usersTable.U_PasswordHash) {
      throw new Error(
        'Column "U_PasswordHash" not found. Run migration add U_PasswordHash first.'
      );
    }

    // === password default (ubah kalau perlu) ===
    const pwNoAccess = "password123";
    const pwMasterData = "password123";

    const hashNoAccess = await bcrypt.hash(pwNoAccess, 10);
    const hashMasterData = await bcrypt.hash(pwMasterData, 10);

    // update password user.noaccess
    await queryInterface.sequelize.query(
      `UPDATE users
       SET "U_PasswordHash"=:hash,
           "U_UpdatedBy"='seed',
           "U_UpdatedAt"=NOW()
       WHERE "U_Username"='user.noaccess'`,
      { replacements: { hash: hashNoAccess } }
    );

    // update password user.masterdata
    await queryInterface.sequelize.query(
      `UPDATE users
       SET "U_PasswordHash"=:hash,
           "U_UpdatedBy"='seed',
           "U_UpdatedAt"=NOW()
       WHERE "U_Username"='user.masterdata'`,
      { replacements: { hash: hashMasterData } }
    );
  },

  async down() {
    // no-op
    // kalau mau rollback password jadi null, bisa isi:
    // UPDATE users SET "U_PasswordHash"=NULL WHERE "U_Username" IN (...)
  },
};