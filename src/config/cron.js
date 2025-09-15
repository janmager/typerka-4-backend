import cron from "cron";
import https from "https";
import { API_URL } from "./db.js";

// for active state render server (going to sleep after 15min of disactive)
export const wakeupJob = new cron.CronJob("*/14 * * * *", function () {
  const now = new Date();
  const gmtPlus2 = new Date(now.getTime() + (2 * 60 * 60 * 1000)); // GMT+2
  const timeString = `[${gmtPlus2.getHours().toString().padStart(2, '0')}:${gmtPlus2.getMinutes().toString().padStart(2, '0')} ${gmtPlus2.getDate().toString().padStart(2, '0')}.${(gmtPlus2.getMonth() + 1).toString().padStart(2, '0')}.${gmtPlus2.getFullYear()}]`;
  
  https
    .get(API_URL+'/api/health', (res) => {
      if (res.statusCode === 200) console.log(`✅ [CRON] ${timeString} wakeupJob successfully.`);
      else console.log("GET request failed", res.statusCode);
    })
    .on("error", (e) => console.error("Error while sending request", e));
});