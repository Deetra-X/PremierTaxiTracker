import dotenv from "dotenv";

import { connectDb, disconnectDb } from "../src/config/db.js";

dotenv.config();

await connectDb();
// eslint-disable-next-line no-console
console.log("DATABASE_URL connection ok");
await disconnectDb();

