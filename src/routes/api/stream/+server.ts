import type { RequestEvent } from "@sveltejs/kit";

export function GET() {
    return new Response("WebSocket server running on ws://localhost:3001/ws/", { status: 200 });
}
