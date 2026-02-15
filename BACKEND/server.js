import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./Config/db.js";

// models
import Message from "./Models/Message.js";
import Chat from "./Models/Chat.js";

// routes
import authRoutes from "./Routes/authRoutes.js";
import chatRoutes from "./Routes/chatRoutes.js";
import messageRoutes from "./Routes/messageRoutes.js";
import userRoutes from "./Routes/userRoutes.js";

dotenv.config();

/* ------------------ APP SETUP ------------------ */
const app = express();
app.use(cors({
  origin: "https://chattrix-frontend-chi.vercel.app",
  credentials: true
}));
app.use(express.json());

/* ------------------ DATABASE ------------------ */
connectDB();

/* ------------------ ROUTES ------------------ */
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/message", messageRoutes);
app.use("/api/v1/user", userRoutes);

/* ------------------ SERVER ------------------ */
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

/* ------------------ SOCKET STATE ------------------ */
const onlineUsers = new Map();
const lastSeenMap = new Map();

/* ------------------ SOCKET LOGIC ------------------ */
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  /* ===== USER ONLINE ===== */
  socket.on("user-online", (userId) => {
    socket.userId = userId;

    // 🔥 user specific room
    socket.join(userId);

    onlineUsers.set(userId, socket.id);
    lastSeenMap.delete(userId);

    io.emit("online-users", {
      online: Array.from(onlineUsers.keys()),
      lastSeen: Object.fromEntries(lastSeenMap),
    });
  });

  /* ===== JOIN CHAT ROOM ===== */
  socket.on("join-chat", (chatId) => {
    socket.join(chatId);
  });

  /* ===== TYPING ===== */
  socket.on("typing", ({ chatId }) => {
    socket.to(chatId).emit("typing", { chatId });
  });

  socket.on("stop-typing", ({ chatId }) => {
    socket.to(chatId).emit("stop-typing", { chatId });
  });

  /* ===== SEND MESSAGE ===== */
  socket.on("send-message", async ({ chatId, message }) => {
    if (!chatId || !message || !message._id) return;

    try {
      const chat = await Chat.findById(chatId);

      if (!chat) return;

      // 🔥 Send to receiver user room (IMPORTANT FIX)
      chat.users.forEach((u) => {
        const uid = u.toString();

        if (uid !== message.sender._id.toString()) {
          io.to(uid).emit("receive-message", message);
        }
      });

      // delivered update
      await Message.findByIdAndUpdate(message._id, {
        delivered: true,
      });

      // notify sender delivered
      io.to(message.sender._id.toString()).emit("message-delivered", {
        messageId: message._id,
      });

      // unread increment
      chat.users.forEach((u) => {
        const uid = u.toString();

        if (uid !== message.sender._id.toString()) {
          const prev = chat.unreadCounts?.get(uid) || 0;
          chat.unreadCounts.set(uid, prev + 1);
        }
      });

      await chat.save();
    } catch (err) {
      console.error("Send-message error:", err);
    }
  });

  /* ===== MARK SEEN ===== */
  socket.on("mark-seen", async (chatId) => {
    if (!socket.userId) return;

    try {
      await Message.updateMany(
        {
          chat: chatId,
          sender: { $ne: socket.userId },
          seen: false,
        },
        { seen: true },
      );

      const chat = await Chat.findById(chatId);

      if (chat) {
        chat.unreadCounts.set(socket.userId.toString(), 0);
        await chat.save();

        // 🔥 notify sender
        chat.users.forEach((u) => {
          const uid = u.toString();
          if (uid !== socket.userId.toString()) {
            io.to(uid).emit("message-seen", { chatId });
          }
        });
      }
    } catch (err) {
      console.error("Seen error:", err);
    }
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      lastSeenMap.set(socket.userId, Date.now());

      io.emit("online-users", {
        online: Array.from(onlineUsers.keys()),
        lastSeen: Object.fromEntries(lastSeenMap),
      });
    }
  });
});

/* ------------------ LISTEN ------------------ */
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
