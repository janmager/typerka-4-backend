import express from "express"
import { createUser, getUser } from "../controllers/usersController.js";

const router = express.Router();

router.post("/createUser", createUser);
router.post("/getUser", getUser);

export default router;