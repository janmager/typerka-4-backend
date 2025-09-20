import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import rateLimiter from "./middleware/rateLimiter.js";
import { wakeupJob } from "./config/cron.js";
import { initializeDatabase } from "./config/db.js";
import usersRoute from "./routes/usersRoute.js";
import mailingRoute from "./routes/mailingRoute.js";
import adminRoute from "./routes/adminRoute.js";
import adminTournamentsRoute from "./routes/adminTournamentsRoute.js";
import adminTeamsRoute from "./routes/adminTeamsRoute.js";
import adminMatchesRoute from "./routes/adminMatchesRoute.js";
import apiIntegrationRoute from "./routes/apiIntegrationRoute.js";
import tournamentsRoute from "./routes/tournamentsRoute.js";

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(rateLimiter);

let test = false;

// cron jobs
if (process.env.NODE_ENV === "production" || test) {
    wakeupJob.start();
}

const PORT = process.env.PORT || 5001;

// Initialize database
initializeDatabase().catch(console.error);

// Routes
app.use("/api/users", usersRoute);
app.use("/api/mailing", mailingRoute);
app.use("/api/admin", adminRoute);
app.use("/api/admin", adminTournamentsRoute);
app.use("/api/admin", adminTeamsRoute);
app.use("/api/admin", adminMatchesRoute);
app.use("/api/admin", apiIntegrationRoute);
app.use("/api/tournaments", tournamentsRoute);

app.get("/api/health", (req, res) => {
    res.send("API is working fine.");
});

app.listen(PORT, () => {
    console.log("Server is up and running on PORT: ", PORT);
});