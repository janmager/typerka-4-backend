import express from "express"
import { checkAuthUser, createUser, getUser, confirmAccount, resetPassword, requestResetPassword, changePassword, editProfile, deleteAccount, editAvatar } from "../controllers/usersController.js";

const router = express.Router();

// GET endpoints for retrieving data
router.get("/getUser", getUser);
router.get("/checkAuthUser", checkAuthUser);

// POST endpoints for creating resources
router.post("/createUser", createUser);
router.post("/requestResetPassword", requestResetPassword);

// PUT endpoints for updating resources
router.put("/confirmAccount", confirmAccount);
router.put("/resetPassword", resetPassword);
router.put("/changePassword", changePassword);
router.put("/editProfile", editProfile);
router.put("/editAvatar", editAvatar);

// DELETE endpoints for removing resources
router.delete("/deleteAccount", deleteAccount);

export default router;