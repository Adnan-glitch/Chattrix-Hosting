import mongoose from "mongoose";
import Chat from "../Models/Chat.js";

export const accessChat = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User Id required" });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot chat with yourself" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // check existing chat
    let chat = await Chat.findOne({
      users: { $all: [req.user._id, userId] },
    }).populate("users", "-password");

    if (chat) {
      return res.status(200).json(chat); // ✅ direct return
    }

    // create new chat
    const newChat = await Chat.create({
      users: [req.user._id, userId],
    });

    const fullChat = await Chat.findById(newChat._id).populate(
      "users",
      "-password",
    );

    res.status(201).json(fullChat); // ✅ direct return
  } catch (error) {
    console.error("Access Chat Error:", error);
    res.status(500).json({ message: "Failed to access chat" });
  }
};

export const fetchChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      users: { $in: [req.user._id] },
      latestMessage: { $exists: true, $ne: null }, // 👈 important line
    })
      .populate("users", "-password")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "firstName lastName email",
        },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error) {
    console.error("Fetch Chats Error:", error);
    res.status(500).json({ message: "Failed to fetch chats" });
  }
};
