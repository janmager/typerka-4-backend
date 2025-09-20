import express from "express";
import { checkAdminUser } from "../controllers/adminController.js";
import { 
    getAllTournamentsAdmin, 
    addTournament, 
    updateTournament, 
    deleteTournament,
    getTournamentJoinsAdmin,
    updateTournamentJoinStatusAdmin
} from "../controllers/tournamentsController.js";

const router = express.Router();

// Middleware to check admin permissions for all admin routes
router.use(checkAdminUser);

// GET /api/admin/tournaments - Get all tournaments (admin only)
router.get("/tournaments", getAllTournamentsAdmin);

// POST /api/admin/tournaments - Add new tournament
router.post("/tournaments", addTournament);

// PUT /api/admin/tournaments/:tournament_id - Update tournament
router.put("/tournaments/:tournament_id", updateTournament);

// Alias: PUT /api/admin/tournament/:tournament_id - Update tournament (singular)
router.put("/tournament/:tournament_id", updateTournament);

// DELETE /api/admin/tournaments/:tournament_id - Delete tournament
router.delete("/tournaments/:tournament_id", deleteTournament);

// Admin: tournament joins
router.get("/tournaments/:tournament_id/joins", getTournamentJoinsAdmin);
router.put("/tournaments/:tournament_id/joins/:join_id", updateTournamentJoinStatusAdmin);

export default router;
