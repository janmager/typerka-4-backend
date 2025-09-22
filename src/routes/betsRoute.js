import express from "express";
import { createOrUpdateBet, getUserBets } from "../controllers/betsController.js";

const router = express.Router();

// POST /api/bets - Create or update bet
router.post("/", createOrUpdateBet);

// GET /api/bets - Get user's bets
router.get("/", getUserBets);

export default router;
