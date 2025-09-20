import express from "express";
import { getAllTournaments } from "../controllers/tournamentsController.js";

const router = express.Router();

// GET /api/tournaments - Get all active tournaments (public)
router.get("/", getAllTournaments);

export default router;
