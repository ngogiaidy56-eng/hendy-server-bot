import { randomBytes } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

const ADMIN_TICKET_TTL_MS = 60_000;
const adminTickets = new Map();
let channels = null;

export function createAdminWsTicket() {
  const now = Date.now();
  for (const [ticket, issuedAt] of adminTickets) {
    if (now - issuedAt > ADMIN_TICKET_TTL_MS) adminTickets.delete(ticket);
  }
  const ticket = randomBytes(32).toString("base64url");
  adminTickets.set(ticket, now);
  return { ticket, expiresInSeconds: ADMIN_TICKET_TTL_MS / 1000 };
}

function consumeAdminWsTicket(ticket) {
  if (!ticket) return false;
  const issuedAt = adminTickets.get(ticket);
  adminTickets.delete(ticket);
  return Boolean(issuedAt && Date.now() - issuedAt <= ADMIN_TICKET_TTL_MS);
}

function sendJson(socket, event) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function broadcastTo(channel, event) {
  if (!channels) return;
  for (const socket of channels.clients) {
    if (socket.readyState === WebSocket.OPEN && socket.channel === channel) {
      sendJson(socket, event);
    }
  }
}

export function broadcastMenuConfig(config) {
  const event = { type: "menu:config", payload: config, sentAt: new Date().toISOString() };
  broadcastTo("menu", event);
  broadcastTo("admin", event);
}

export function broadcastConfigStatus(status) {
  broadcastTo("admin", {
    type: "config:status",
    payload: status,
    sentAt: new Date().toISOString(),
  });
}

/**
 * Render has one public HTTP listener; this WebSocket server upgrades that
 * listener on /ws/menu (public sanitized menu only) and /ws/config (one-use
 * administrator ticket). No long-lived admin credential travels in a URL.
 */
export function attachConfigRealtime(server, { loadMenuConfig, loadConfigStatus }) {
  if (channels) throw new Error("Config realtime service is already attached.");

  channels = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
    perMessageDeflate: false,
  });

  server.on("upgrade", (request, socket, head) => {
    let url;
    try {
      url = new URL(request.url || "/", "http://localhost");
    } catch {
      socket.destroy();
      return;
    }

    if (url.pathname !== "/ws/menu" && url.pathname !== "/ws/config") {
      socket.destroy();
      return;
    }

    let channel = "menu";
    if (url.pathname === "/ws/config") {
      const origin = request.headers.origin;
      const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
        .split(",").map((item) => item.trim()).filter(Boolean);
      const renderOrigin = (process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
      let sameHost = false;
      try {
        sameHost = Boolean(origin && new URL(origin).host === (request.headers.host || ""));
      } catch {
        sameHost = false;
      }
      if (origin && process.env.NODE_ENV === "production" &&
          !sameHost && origin !== renderOrigin && !allowedOrigins.includes(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      if (!consumeAdminWsTicket(url.searchParams.get("ticket"))) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      channel = "admin";
    }

    channels.handleUpgrade(request, socket, head, (webSocket) => {
      webSocket.channel = channel;
      channels.emit("connection", webSocket, request);
    });
  });

  channels.on("connection", async (socket) => {
    sendJson(socket, { type: "connection:ready", payload: { channel: socket.channel } });

    const sendSnapshot = async () => {
      try {
        const menuConfig = await loadMenuConfig();
        sendJson(socket, { type: "menu:config", payload: menuConfig, sentAt: new Date().toISOString() });
      } catch (error) {
        sendJson(socket, { type: "stream:error", payload: { message: error.message } });
      }

      if (socket.channel === "admin") {
        try {
          const status = await loadConfigStatus();
          sendJson(socket, { type: "config:status", payload: status, sentAt: new Date().toISOString() });
        } catch (error) {
          sendJson(socket, { type: "stream:error", payload: { message: error.message } });
        }
      }
    };

    await sendSnapshot();

    let isAlive = true;
    socket.on("pong", () => {
      isAlive = true;
    });
    const heartbeat = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (!isAlive) {
        socket.terminate();
        return;
      }
      isAlive = false;
      socket.ping();
    }, 25_000);

    let refresh = null;
    if (socket.channel === "admin") {
      refresh = setInterval(async () => {
        try {
          broadcastConfigStatus(await loadConfigStatus());
        } catch (error) {
          sendJson(socket, { type: "stream:error", payload: { message: error.message } });
        }
      }, 30_000);
    }

    socket.on("close", () => {
      clearInterval(heartbeat);
      if (refresh) clearInterval(refresh);
    });
    socket.on("error", () => {
      clearInterval(heartbeat);
      if (refresh) clearInterval(refresh);
    });
  });

  return channels;
}
