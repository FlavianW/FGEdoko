import { Server } from "socket.io";
import type { RequestEvent } from "@sveltejs/kit";

let currentTrack = "/music/chanson1.mp3"; // Musique par défaut
let startTime = Date.now(); // Timestamp de début

const io = new Server();

export function GET({ request }: RequestEvent) {
  if (request.headers.get("upgrade") === "websocket") {
    io.on("connection", (socket) => {
      socket.emit("state", { track: currentTrack, startTime });

      socket.on("changeTrack", (data) => {
        currentTrack = data.track;
        startTime = Date.now();
        io.emit("state", { track: currentTrack, startTime });
      });
    });

    return new Response(null, {
      status: 101,
      headers: {
        "Upgrade": "websocket"
      }
    });
  }

  return new Response("WebSocket required", { status: 400 });
}
