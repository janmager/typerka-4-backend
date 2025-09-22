import express from "express";
import { checkAdminUser } from "../controllers/adminController.js";
import { getAllBets, updateBetStatus, getBetDetails } from "../controllers/betsController.js";

const router = express.Router();

// Middleware to check admin permissions for all admin bets routes
router.use(checkAdminUser);

// GET /api/admin/bets - Get all bets with pagination and filtering
router.get("/", getAllBets);

// GET /api/admin/bets/:bet_id - Get bet details
router.get("/:bet_id", getBetDetails);

// PUT /api/admin/bets/:bet_id/status - Update bet status
router.put("/:bet_id/status", updateBetStatus);

export default router;

