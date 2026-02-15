import express from "express";
import { protect } from "../Middlewares/authMiddleware.js";

import {
  sendMessage,
  getMessages,
  deleteMessage,
} from "../Controllers/messageController.js";

const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:chatId", protect, getMessages);
router.delete("/:id", protect, deleteMessage);

export default router;
