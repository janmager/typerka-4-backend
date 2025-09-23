import express from "express";
import { createOrUpdateBet, getUserBets, getUserBetForMatch } from "../controllers/betsController.js";

const router = express.Router();

// POST /api/bets - Create or update bet
router.post("/", createOrUpdateBet);

// GET /api/bets - Get user's bets
router.get("/", getUserBets);

// GET /api/bets/match - Get user's bet for specific match
router.get("/match", getUserBetForMatch);

export default router;

