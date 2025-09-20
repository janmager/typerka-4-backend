import express from "express";
import { addActivity, getActivities } from "../controllers/activitiesController.js";

const router = express.Router();

router.post("/", addActivity);
router.get("/", getActivities);

export default router;


