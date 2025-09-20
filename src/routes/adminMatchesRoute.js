import express from "express";
import { checkAdminUser } from "../controllers/adminController.js";
import { 
    getAllMatches, 
    addMatch, 
    updateMatch, 
    deleteMatch,
    getMatchById,
    addMatchFromApi,
    getMatchByApiFixtureId
} from "../controllers/matchesController.js";

const router = express.Router();

// Middleware to check admin permissions for all admin routes
router.use(checkAdminUser);

// GET /api/admin/matches - Get all matches (admin only)
router.get("/matches", getAllMatches);

// GET /api/admin/matches/:match_id - Get match by ID
router.get("/matches/:match_id", getMatchById);

// POST /api/admin/matches - Add new match
router.post("/matches", addMatch);

// PUT /api/admin/matches/:match_id - Update match
router.put("/matches/:match_id", updateMatch);

// DELETE /api/admin/matches/:match_id - Delete match
router.delete("/matches/:match_id", deleteMatch);

// POST /api/admin/matches/api - Add match from API response
router.post("/matches/api", addMatchFromApi);

// GET /api/admin/matches/api/:api_fixture_id - Get match by API fixture ID
router.get("/matches/api/:api_fixture_id", getMatchByApiFixtureId);

export default router;
