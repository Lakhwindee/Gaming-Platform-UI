import http from "http";
import { WebSocketServer } from "ws";
import app from "./app";
import { startGameEngine, handleConnection } from "./lib/gameEngine";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT: "${rawPort}"`);

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/api/ws" });
wss.on("connection", handleConnection);

startGameEngine(wss);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`WebSocket ready on ws://localhost:${port}/api/ws`);
});
