import { loadConfig } from '../config.js';
import { DashboardDatabase } from './database.js';
const config = loadConfig();
const database = new DashboardDatabase(config.dbPath);
database.close();
console.log('SahaPul database migrations applied successfully.');
