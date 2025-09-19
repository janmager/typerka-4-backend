import express from "express"
import { checkAuthUser, createUser, getUser, confirmAccount, resetPassword, requestResetPassword, changePassword, editProfile, deleteAccount } from "../controllers/usersController.js";

const router = express.Router();

router.post("/getUser", getUser);
router.post("/checkAuthUser", checkAuthUser);
router.post("/createUser", createUser);
router.post("/confirmAccount", confirmAccount);
router.post("/resetPassword", resetPassword);
router.post("/requestResetPassword", requestResetPassword);
router.post("/changePassword", changePassword);
router.post("/editProfile", editProfile);
router.post("/deleteAccount", deleteAccount);

export default router;