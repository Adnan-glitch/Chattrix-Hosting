import mongoose from "mongoose";
import Chat from "./Chat.js";

const messageSchema = mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },

    chat: {
      type: mongoose.Schema.ObjectId,
      ref: "Chat",
    },

    content: {
      type: String,
      trim: true,
    },

    delivered: {
      type: Boolean,
      default: false,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
export default Message;