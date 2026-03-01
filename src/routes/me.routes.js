const express = require("express");
const router = express.Router();
const { authRequired } = require("../middlewares/auth.middleware");
const { getMyMenu, getProfile } = require("../controllers/me.controller");

router.get("/me/menu", authRequired, getMyMenu);
router.get("/user/profile", authRequired, getProfile);

module.exports = router;