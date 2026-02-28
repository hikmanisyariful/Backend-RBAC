"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware");
const UserController = require("../controllers/user.controller");

// GET /users?page=1&limit=10&searchTerm=jon&filterColumn={}&orderBy={"fullname":"ASC"}
router.get("/", authRequired, UserController.list);

router.get("/summary", authRequired, UserController.summary);

// GET /users/:id
router.get("/:id", authRequired, UserController.detail);

// (opsional kalau kamu mau CRUD lengkap)
router.post("/", authRequired, UserController.create);
router.put("/:id", authRequired, UserController.update);
router.delete("/:id", authRequired, UserController.remove);

module.exports = router;