import dotenv from 'dotenv';

import { Config } from './types';
dotenv.config();
export const config: Config = {
message: process.env.NEW_YEAR_MESSAGE || "Happy New Year 2026! 🎉",
targetDate: process.env.TARGET_DATE || "2026-01-01",
targetTime: process.env.TARGET_TIME || "00:00",
sessionPath: process.env.SESSION_PATH || "./.wwebjs_auth",
logLevel: process.env.LOG_LEVEL || "info",
logFile: process.env.LOG_FILE || "./logs/bot.log",
testMode: process.env.TEST_MODE === "true" || process.argv.includes('--test'),
testDelaySeconds: parseInt(process.env.TEST_DELAY_SECONDS || "30", 10)
};