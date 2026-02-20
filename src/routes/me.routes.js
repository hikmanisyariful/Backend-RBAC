const express = require("express");
const router = express.Router();
const { authRequired } = require("../middlewares/auth.middleware");
const { getMyMenu } = require("../controllers/me.controller");

router.get("/me/menu", authRequired, getMyMenu);

module.exports = router;