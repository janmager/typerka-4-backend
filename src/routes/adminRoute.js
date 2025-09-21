import express from "express";
import { checkAdminUser, updateLeagueStatus, addLeagueRecord, getAllLeagues, refreshLeague, getApiFootballLogs, getAllUsers, updateUserStatus, getUserDetails } from "../controllers/adminController.js";

const router = express.Router();

// Middleware to check admin permissions for all admin routes
router.use(checkAdminUser);

// POST /api/admin/update-league-status - Update league status, add/remove leagues, set update_times
router.post("/update-league-status", updateLeagueStatus);

// POST /api/admin/add-league - Add new league record
router.post("/add-league", addLeagueRecord);

// GET /api/admin/leagues - Get all leagues (admin only)
router.get("/leagues", getAllLeagues);

// POST /api/admin/leagues/update - Refresh league data (re-fetch teams and matches)
router.post("/leagues/update", refreshLeague);

// GET /api/admin/api-logs - Get API football logs (admin only)
router.get("/api-logs", getApiFootballLogs);

// GET /api/admin/users - Get all users with pagination and filtering
router.get("/users", getAllUsers);

// POST /api/admin/users/update-status - Update user status
router.post("/users/update-status", updateUserStatus);

// GET /api/admin/users/details - Get user details for drawer
router.get("/users/details", getUserDetails);

export default router;
