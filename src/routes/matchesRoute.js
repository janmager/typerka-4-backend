import express from "express";
import { getMatchesForActiveTournament, getAllUserMatches } from "../controllers/matchesController.js";

const router = express.Router();

// Public endpoints for users (require user_id in query)
router.get("/", getMatchesForActiveTournament); // /api/matches?user_id=...&limit=&before=
router.get("/get-all", getAllUserMatches); // /api/matches/get-all?user_id=...&limit=&before=

export default router;


