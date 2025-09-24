import express from "express";
import { getAllTournaments, joinTournament, getTournamentParticipants, getActiveTournament, setActiveTournament, getUserTournamentStatus } from "../controllers/tournamentsController.js";

const router = express.Router();

// GET /api/tournaments - Get all active tournaments (public)
router.get("/", getAllTournaments);
// POST /api/tournaments/join - join tournament
router.post("/join", joinTournament);
// GET /api/tournaments/:tournament_id/participants - list participants
router.get("/:tournament_id/participants", getTournamentParticipants);
// GET /api/tournaments/active?user_id=... - get active tournament details for user
router.get("/active", getActiveTournament);
// POST /api/tournaments/active - set active tournament for user
router.post("/active", setActiveTournament);
// GET /api/tournaments/user-status?user_id=... - get user's tournament join status
router.get("/user-status", getUserTournamentStatus);

export default router;
