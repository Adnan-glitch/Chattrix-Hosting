import Message from "../Models/Message.js";
import Chat from "../Models/Chat.js";
import mongoose from "mongoose";
export const sendMessage = async (req, res) => {
  try {
    const { content, chatId } = req.body;

    if (!content || !chatId) {
      return res.status(400).json({
        success: false,
        message: "content and chatId required",
      });
    }

    const message = await Message.create({
      sender: req.user._id,
      content,
      chat: chatId,
    });

    const fullMessage = await Message.findById(message._id)
      .populate("sender", "firstName lastName email")
      .populate({
        path: "chat",
        populate: {
          path: "latestMessage",
          populate: {
            path: "sender",
            select: "firstName lastName email",
          },
        },
      });

    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: message._id,
      hashMessage: true,
    });

    res.status(201).json(fullMessage);
  } catch (error) {
    console.error("Send Message Error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
};

// fetch all messages
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;

    // validate chatId
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chatId" });
    }

    const messages = await Message.find({ chat: chatId }).populate(
      "sender",
      "firstName lastName email",
    );

    res.status(200).json(messages);
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const chatId = message.chat;

    // Delete the message
    await message.deleteOne();

    // Find latest remaining message
    const latestMessage = await Message.findOne({ chat: chatId })
      .sort({ createdAt: -1 })
      .populate("sender", "firstName lastName email");

    // Update chat.latestMessage
    await Chat.findByIdAndUpdate(chatId, {
      latestMessage: latestMessage ? latestMessage._id : null,
    });

    res.status(200).json({
      message: "Message deleted",
      messageId: message._id,
      latestMessage,
    });
  } catch (error) {
    console.error("Delete Message Error:", error);
    res.status(500).json({ message: "Failed to delete message" });
  }
};
