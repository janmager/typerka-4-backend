import express from "express";
import { checkAdminUser } from "../controllers/adminController.js";
import { 
    processApiFixtures,
    fetchAndProcessFixtures,
    getTeamByApiId,
    getMatchByApiFixtureId
} from "../controllers/apiIntegrationController.js";

const router = express.Router();

// Middleware to check admin permissions for all admin routes
router.use(checkAdminUser);

// POST /api/admin/api/process-fixtures - Process API fixtures response
router.post("/api/process-fixtures", processApiFixtures);

// POST /api/admin/api/fetch-fixtures - Fetch fixtures from API Sports and process them
router.post("/api/fetch-fixtures", fetchAndProcessFixtures);

// GET /api/admin/api/teams/:api_team_id - Get team by API team ID
router.get("/api/teams/:api_team_id", getTeamByApiId);

// GET /api/admin/api/matches/:api_fixture_id - Get match by API fixture ID
router.get("/api/matches/:api_fixture_id", getMatchByApiFixtureId);

export default router;
