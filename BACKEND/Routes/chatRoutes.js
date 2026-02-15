import express from "express";
import { protect } from "../Middlewares/authMiddleware.js";
import { accessChat, fetchChats } from "../Controllers/chatController.js";

const router = express.Router();
router.post("/", protect, accessChat);
router.get("/", protect, fetchChats);

export default router;
