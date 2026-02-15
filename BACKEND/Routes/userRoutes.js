import express from "express";
import { searchUsers } from "../Controllers/userController.js";
import { protect } from "../Middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", protect, searchUsers);

export default router;
