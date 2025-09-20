import express from "express";
import { checkAdminUser } from "../controllers/adminController.js";
import { 
    getAllTeams, 
    addTeam, 
    updateTeam, 
    deleteTeam,
    getTeamById,
    addTeamFromApi,
    getTeamByApiId
} from "../controllers/teamsController.js";

const router = express.Router();

// Middleware to check admin permissions for all admin routes
router.use(checkAdminUser);

// GET /api/admin/teams - Get all teams (admin only)
router.get("/teams", getAllTeams);

// GET /api/admin/teams/:team_id - Get team by ID
router.get("/teams/:team_id", getTeamById);

// POST /api/admin/teams - Add new team
router.post("/teams", addTeam);

// PUT /api/admin/teams/:team_id - Update team
router.put("/teams/:team_id", updateTeam);

// DELETE /api/admin/teams/:team_id - Delete team
router.delete("/teams/:team_id", deleteTeam);

// POST /api/admin/teams/api - Add team from API response
router.post("/teams/api", addTeamFromApi);

// GET /api/admin/teams/api/:api_team_id - Get team by API team ID
router.get("/teams/api/:api_team_id", getTeamByApiId);

export default router;
