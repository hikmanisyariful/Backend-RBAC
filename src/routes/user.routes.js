"use strict";

const router = require("express").Router();
const { authRequired } = require("../middlewares/auth.middleware");
const UserController = require("../controllers/user.controller");

// GET /users?page=1&limit=10&searchTerm=jon&filterColumn={}&orderBy={"fullname":"ASC"}
router.get("/GetPaginationDataList", authRequired, UserController.list);

router.get("/GetSummary", authRequired, UserController.summary);

// GET /users/:id
router.get("/GetById/:id", authRequired, UserController.detail);

// (opsional kalau kamu mau CRUD lengkap)
router.post("/Create", authRequired, UserController.create);
router.put("/Update/:id", authRequired, UserController.update);
router.delete("/Delete/:id", authRequired, UserController.remove);

module.exports = router;