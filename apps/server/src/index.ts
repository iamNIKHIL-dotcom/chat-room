import { randomBytes } from "crypto";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: string;
  timestamp: Date;
}

interface RoomData {
  users: Set<string>;
  messages: Message[];
  lastActive: number;
}

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "https://chat-room-web-nikhil01s-projects.vercel.app/", "https://chat-room-web-six.vercel.app/", "https://chat-room-web-git-main-nikhil01s-projects.vercel.app/"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Room and user tracking maps
const rooms = new Map<string, RoomData>();
const userMap = new Map<string, string>(); // userId -> socketId

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("set-user-id", (userId: string) => {
    userMap.set(userId, socket.id);
    console.log("User ID set:", userId);
  });

  socket.on("create-room", () => {
    try {
      const roomCode = randomBytes(3).toString("hex").toUpperCase();
      console.log("Room created:", roomCode);

      rooms.set(roomCode, {
        users: new Set<string>(),
        messages: [],
        lastActive: Date.now(),
      });

      socket.emit("room-created", roomCode);
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", "Failed to create room");
    }
  });

  socket.on("join-room", (data) => {
    const parsedData = JSON.parse(data);
    const roomCode = parsedData.roomId;

    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    socket.join(roomCode);
    room.users.add(socket.id);
    room.lastActive = Date.now();

    socket.emit("joined-room", {
      roomCode,
      messages: room.messages,
    });

    io.to(roomCode).emit("user-joined", room.users.size);
  });

  socket.on("send-message", ({ roomCode, message, userId, name }) => {
    const room = rooms.get(roomCode);
    if (room) {
      room.lastActive = Date.now();

      const messageData: Message = {
        id: randomBytes(4).toString("hex"),
        content: message,
        senderId: userId,
        sender: name,
        timestamp: new Date(),
      };

      room.messages.push(messageData);
      io.to(roomCode).emit("new-message", messageData);
    }
  });

  socket.on("leave-room", (roomCode: string) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.users.has(socket.id)) {
      room.users.delete(socket.id);
      socket.leave(roomCode);

      io.to(roomCode).emit("user-left", room.users.size);

      if (room.users.size === 0) {
        console.log(`Deleting room ${roomCode} because it's now empty`);
        rooms.delete(roomCode);
      }
    }
  });

  socket.on("disconnect", () => {
    const disconnectedSocketId = socket.id;

    rooms.forEach((room, roomCode) => {
      if (room.users.has(disconnectedSocketId)) {
          io.to(roomCode).emit("user-left", room.users.size);
          //when single user is there  on refreshing socket deleting room,
          //asuming no user is there in room so
          //this is fix--
          // Delay the deletion check by 10 seconds
          setTimeout(() => {
            room.users.delete(disconnectedSocketId);
          const currentRoom = rooms.get(roomCode);
          if (currentRoom && currentRoom.users.size === 0) {
            console.log(`Deleting empty room after delay: ${roomCode}`);
            rooms.delete(roomCode);
          }
        }, 10000); // 10 seconds
      }
    });

    // Clean up user map
    for (const [userId, sid] of userMap.entries()) {
      if (sid === socket.id) {
        userMap.delete(userId);
        break;
      }
    }
  });
});

// Periodic cleanup
setInterval(
  () => {
    const now = Date.now();
    rooms.forEach((room, roomCode) => {
      if (room.users.size === 0 && now - room.lastActive > 1800000) {
        console.log(`Cleaning up inactive room: ${roomCode}`);
        rooms.delete(roomCode);
      }
    });
  },
  1000 * 60 * 30
);

// Server error handling
httpServer.on("error", (error) => {
  console.error("Server error:", error);
});

httpServer.listen(4000, () => {
  console.log("Server running on port 4000");
});
