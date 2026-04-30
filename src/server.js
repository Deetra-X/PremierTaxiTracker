import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import http from "node:http";

const START_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

await connectDb();

const app = createApp();

function listenOnce(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

const server = http.createServer(app);

let port = START_PORT;
for (let i = 0; i < 20; i++) {
  try {
    // eslint-disable-next-line no-await-in-loop
    await listenOnce(server, port);
    // eslint-disable-next-line no-console
    console.log(`API listening on port ${port}`);
    break;
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      port += 1;
      continue;
    }
    throw err;
  }
}

