import mongoose from "mongoose";

const chatSchema = mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "User",
      },
    ],

    latestMessage: {
      type: mongoose.Schema.ObjectId,
      ref: "Message",
    },

    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },

    hasMessage: {
      type: Boolean,
      default: false,
    },
  },

  { timestamps: true },
);

const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
export default Chat;
