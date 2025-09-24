import express from "express";
import { createOrUpdateBet, getUserBets, getUserBetForMatch, getTournamentParticipantsBets } from "../controllers/betsController.js";

const router = express.Router();

// POST /api/bets - Create or update bet
router.post("/", createOrUpdateBet);

// GET /api/bets - Get user's bets
router.get("/", getUserBets);

// GET /api/bets/match - Get user's bet for specific match
router.get("/match", getUserBetForMatch);

// GET /api/bets/tournament-participants - Get tournament participants' bets for a match
router.get("/tournament-participants", getTournamentParticipantsBets);

export default router;

