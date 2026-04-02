"use client";

import { io } from "socket.io-client";
import { SERVER_URL } from "./config";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket"]
    });
  }

  return socket;
}
