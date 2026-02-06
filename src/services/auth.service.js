const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { sequelize } = require("../config/db");
const { ok, fail } = require("../utils/response");
const { signAccessToken, signRefreshToken } = require("../utils/jwt");

function toUnixSeconds(dateMs) {
  return Math.floor(dateMs / 1000);
}

async function login(body) {
  const username = body?.UserName?.trim();
  const password = body?.Password;

  if (!username || !password) {
    return fail("UserName and Password required", 400);
  }

  // 1) ambil user + role
  const [rows] = await sequelize.query(
    `
    SELECT 
      u."U_Id",
      u."U_Username",
      u."U_Email",
      u."U_FullName",
      u."U_Active",
      u."U_PasswordHash",
      r."R_Code" AS "RoleCode"
    FROM users u
    JOIN roles r ON r."R_Id" = u."U_RoleId"
    WHERE u."U_Username" = :username
    LIMIT 1
    `,
    { replacements: { username } }
  );

  if (!rows.length) return fail("Invalid username or password", 401);

  const user = rows[0];
  if (!user.U_Active) return fail("User is inactive", 403);
  if (!user.U_PasswordHash) return fail("User has no password set", 400);

  // 2) cek password
  const match = await bcrypt.compare(password, user.U_PasswordHash);
  if (!match) return fail("Invalid username or password", 401);

  // 3) generate token
  const accessToken = signAccessToken({
    sub: String(user.U_Id),
    username: user.U_Username,
    role: user.RoleCode,
  });

  const refreshToken = signRefreshToken({
    sub: String(user.U_Id),
  });

  // 4) expired unix seconds (biar cocok dengan NextAuth logic kamu)
  const nowSec = toUnixSeconds(Date.now());
  const accessExpSec = nowSec + 15 * 60; // 15 menit
  const refreshExpSec = nowSec + 7 * 24 * 60 * 60; // 7 hari

  // 5) bentuk response sesuai yang NextAuth authorize() kamu harapkan
  const payload = {
    Record: {
      UserData: {
        Id: user.U_Id,
        Email: user.U_Email,
        FullName: user.U_FullName,
        Roles: { RoleCode: user.RoleCode },
      },
      AccessToken: accessToken,
      RefreshToken: refreshToken,
      Expired: String(accessExpSec),
      ExpiredRefresh: String(refreshExpSec),
    },
  };

  return ok(payload, `Hi ${user.U_Username}, Welcome`, 200);
}

async function refreshTokenSession(refreshToken) {
  if (!refreshToken || typeof refreshToken !== "string") {
    return { status: 400, json: { message: "refreshToken query is required" } };
  }

  // 1) verify refresh token
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    return { status: 401, json: { message: "Invalid or expired refresh token" } };
  }

  const userId = decoded?.sub;
  if (!userId) {
    return { status: 401, json: { message: "Invalid token payload" } };
  }

  // 2) fetch user + role
  const [rows] = await sequelize.query(
    `
    SELECT 
      u."U_Id", u."U_Username", u."U_Active",
      r."R_Code" AS "RoleCode"
    FROM users u
    JOIN roles r ON r."R_Id" = u."U_RoleId"
    WHERE u."U_Id" = :userId
    LIMIT 1
    `,
    { replacements: { userId: Number(userId) } }
  );

  if (!rows.length) {
    return { status: 401, json: { message: "User not found" } };
  }

  const user = rows[0];
  if (!user.U_Active) {
    return { status: 403, json: { message: "User is inactive" } };
  }

  // 3) issue new tokens (rotating)
  const access_token = signAccessToken({
    sub: String(user.U_Id),
    username: user.U_Username,
    role: user.RoleCode,
  });

  const refresh_token = signRefreshToken({ sub: String(user.U_Id) });

  // 4) expires_in (seconds from now) - match FE expectation
  const expires_in = 15 * 60; // 15 min
  const refresh_expires_in = 7 * 24 * 60 * 60; // 7 days

  return {
    status: 200,
    json: {
      access_token,
      refresh_token,
      expires_in,
      refresh_expires_in,
      token_type: "Bearer",
      role: user.RoleCode,
    },
  };
}


module.exports = { login, refreshTokenSession };
