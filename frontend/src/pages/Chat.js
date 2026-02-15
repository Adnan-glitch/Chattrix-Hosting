import { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import socket from "../socket";

function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [lastSeen, setLastSeen] = useState({});
  const [typingChats, setTypingChats] = useState({});
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const typingTimeoutRef = useRef(null);
  const bottomRef = useRef(null);

  /* ================= HELPERS ================= */

  const formatTime = (date) =>
    date
      ? new Date(date).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const getSenderId = (msg) => (msg?.sender?._id ? msg.sender._id : msg.sender);

  const getOtherUser = (chat) => {
    if (!chat?.users) return null;
    return chat.users.find((u) => u._id !== user._id);
  };

  const getFullName = (u) =>
    u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "";

  const handleLogout = () => {
    socket.disconnect();
    logout();
    navigate("/");
  };

  const deleteMessageHandler = async (messageId) => {
    try {
      const { data } = await api.delete(`/message/${messageId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      setMessages((prev) => prev.filter((m) => m._id !== messageId));

      // Update sidebar latest message
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === selectedChat._id
            ? { ...chat, latestMessage: data.latestMessage || null }
            : chat,
        ),
      );
    } catch (error) {
      console.log(error);
    }
  };

  /* ================= AUTH ================= */

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  /* ================= FETCH CHATS ================= */

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const { data } = await api.get("/chat", {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setChats(data);
    };

    fetchChats();
  }, [user]);

  const fetchMessages = async (chatId) => {
    try {
      const { data } = await api.get(`/message/${chatId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setMessages(data || []);
    } catch (err) {
      console.log("Fetch message error:", err);
    }
  };

  /* ================= SEARCH USERS ================= */

  useEffect(() => {
    const fetchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const { data } = await api.get(`/user?search=${searchQuery}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setSearchResults(data);
      } catch (err) {
        console.log("Search error:", err);
      }
    };

    const delay = setTimeout(fetchUsers, 400);
    return () => clearTimeout(delay);
  }, [searchQuery, user.token]);

  /* ================= ONLINE USERS ================= */

  useEffect(() => {
    if (user?._id) socket.emit("user-online", user._id);
  }, [user?._id]);

  useEffect(() => {
    socket.on("online-users", ({ online, lastSeen }) => {
      setOnlineUsers(online || []);
      setLastSeen(lastSeen || {});
    });

    return () => socket.off("online-users");
  }, []);

  /* ================= RECEIVE MESSAGE ================= */

  useEffect(() => {
    socket.on("receive-message", (message) => {
      const chatId =
        typeof message.chat === "string" ? message.chat : message.chat?._id;

      setChats((prev) => {
        const updated = prev.map((chat) =>
          chat._id === chatId ? { ...chat, latestMessage: message } : chat,
        );

        const target = updated.find((c) => c._id === chatId);
        const rest = updated.filter((c) => c._id !== chatId);

        return target ? [target, ...rest] : updated;
      });

      if (selectedChat?._id === chatId) {
        setMessages((prev) => [...prev, message]);
      }

      setTypingChats((prev) => ({ ...prev, [chatId]: false }));
    });

    return () => socket.off("receive-message");
  }, [selectedChat?._id]);

  /* ================= TYPING ================= */

  useEffect(() => {
    socket.on("typing", ({ chatId, userId }) => {
      if (userId === user._id) return;
      setTypingChats((prev) => ({ ...prev, [chatId]: true }));
    });

    socket.on("stop-typing", ({ chatId }) => {
      setTypingChats((prev) => ({ ...prev, [chatId]: false }));
    });

    return () => {
      socket.off("typing");
      socket.off("stop-typing");
    };
  }, [user?._id]);

  const handleTyping = (value) => {
    setNewMessage(value);
    if (!selectedChat) return;

    socket.emit("typing", {
      chatId: selectedChat._id,
      userId: user._id,
    });

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", {
        chatId: selectedChat._id,
        userId: user._id,
      });
    }, 1500);
  };

  /* ================= OPEN CHAT ================= */

  const openChat = async (chat) => {
    if (!chat?.users) return;
    setSelectedChat(chat);
    await fetchMessages(chat._id);
    socket.emit("join-chat", chat._id);
  };

  /* ================= SCROLL ================= */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ================= SEND MESSAGE ================= */

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const { data } = await api.post(
      "/message",
      { content: newMessage, chatId: selectedChat._id },
      { headers: { Authorization: `Bearer ${user.token}` } },
    );

    setMessages((prev) => [...prev, data]);
    setNewMessage("");

    socket.emit("send-message", {
      chatId: selectedChat._id,
      message: data,
    });
  };

  /* ================= START CHAT FROM SEARCH ================= */

  const startChat = async (userId) => {
    try {
      const { data } = await api.post(
        "/chat",
        { userId },
        { headers: { Authorization: `Bearer ${user.token}` } },
      );

      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);

      setSelectedChat(data);
      await fetchMessages(data._id);
      socket.emit("join-chat", data._id);
    } catch (err) {
      console.log(err);
    }
  };

  /* ================= RENDER ================= */

  return (
    <div className="h-screen flex bg-bg text-white overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`${
          selectedChat ? "hidden sm:flex" : "flex"
        } w-full sm:w-1/3 flex-col border-r border-borderColor bg-surface`}
      >
        <div className="p-4 border-b border-borderColor flex justify-between items-center">
          <h2 className="text-lg font-semibold">Chats</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
            >
              +
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-500 px-3 py-1 rounded-lg text-xs"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {chats.map((chat) => {
            const otherUser = getOtherUser(chat);
            const lastMsg = chat.latestMessage;

            return (
              <div
                key={chat._id}
                onClick={() => openChat(chat)}
                className="p-3 rounded-xl hover:bg-borderColor cursor-pointer"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {getFullName(otherUser)}
                  </span>
                  {lastMsg && (
                    <span className="text-xs text-textMuted">
                      {formatTime(lastMsg.createdAt)}
                    </span>
                  )}
                </div>

                <p className="text-sm truncate text-textMuted">
                  {typingChats[chat._id]
                    ? "Typing..."
                    : lastMsg
                      ? getSenderId(lastMsg) === user._id
                        ? `You: ${lastMsg.content}`
                        : lastMsg.content
                      : "No messages yet"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT ROOM */}
      <div
        className={`${
          selectedChat ? "flex" : "hidden sm:flex"
        } flex-1 flex-col min-w-0`}
      >
        {selectedChat && (
          <>
            <div className="p-4 border-b border-borderColor flex items-center gap-3">
              <button
                onClick={() => setSelectedChat(null)}
                className="sm:hidden"
              >
                ←
              </button>

              <div>
                <h3 className="font-semibold">
                  {getFullName(getOtherUser(selectedChat))}
                </h3>
                <p className="text-xs text-textMuted">
                  {typingChats[selectedChat._id]
                    ? "Typing..."
                    : onlineUsers.includes(getOtherUser(selectedChat)?._id)
                      ? "Online"
                      : lastSeen[getOtherUser(selectedChat)?._id]
                        ? `Last seen at ${formatTime(
                            lastSeen[getOtherUser(selectedChat)?._id],
                          )}`
                        : "Offline"}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {messages.map((msg) => {
                const isMe = getSenderId(msg) === user._id;

                return (
                  <div
                    key={msg._id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    onDoubleClick={() => isMe && deleteMessageHandler(msg._id)}
                  >
                    <div
                      className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] break-words ${
                        isMe
                          ? "bg-primary text-white rounded-br-none"
                          : "bg-[#1f2937] rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                      <div className="text-[10px] opacity-70 mt-1 text-right">
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={sendMessage}
              className="p-4 border-t border-borderColor flex gap-2"
            >
              <input
                value={newMessage}
                onChange={(e) => handleTyping(e.target.value)}
                className="flex-1 bg-surface rounded-full px-4 py-2"
                placeholder="Type a message…"
              />
              <button className="bg-primary px-4 py-2 rounded-full">
                Send
              </button>
            </form>
          </>
        )}
      </div>

      {/* SEARCH MODAL */}
      {showSearch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-surface w-full max-w-md rounded-2xl p-6 relative">
            <button
              onClick={() => setShowSearch(false)}
              className="absolute top-3 right-3"
            >
              ✕
            </button>

            <h3 className="text-lg font-semibold mb-4">Start New Chat</h3>

            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-3 rounded-lg bg-bg border border-borderColor"
            />

            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
              {searchResults.map((u) => (
                <div
                  key={u._id}
                  onClick={() => startChat(u._id)}
                  className="p-2 rounded-lg hover:bg-borderColor cursor-pointer"
                >
                  {getFullName(u)}
                </div>
              ))}

              {searchResults.length === 0 && searchQuery && (
                <p className="text-sm text-textMuted">No users found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chat;

// import { useState, useEffect, useRef } from "react";
// import api from "../services/api";
// import { useNavigate } from "react-router-dom";
// import { useAuth } from "../context/AuthContext";
// import socket from "../socket";

// function Chat() {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const [chats, setChats] = useState([]);
//   const [selectedChat, setSelectedChat] = useState(null);
//   const [messages, setMessages] = useState([]);
//   const [newMessage, setNewMessage] = useState("");
//   const [onlineUsers, setOnlineUsers] = useState([]);
//   const [lastSeen, setLastSeen] = useState({});
//   const [typingChats, setTypingChats] = useState({});
//   const [showSearch, setShowSearch] = useState(false);
//   const [searchQuery, setSearchQuery] = useState("");
//   const [searchResults, setSearchResults] = useState([]);

//   const typingTimeoutRef = useRef(null);
//   const bottomRef = useRef(null);

//   /* ================= HELPERS ================= */

//   const formatTime = (date) =>
//     date
//       ? new Date(date).toLocaleTimeString([], {
//           hour: "2-digit",
//           minute: "2-digit",
//         })
//       : "";

//   const getSenderId = (msg) => (msg?.sender?._id ? msg.sender._id : msg.sender);

//   const getOtherUser = (chat) => {
//     if (!chat?.users) return null;
//     return chat.users.find((u) => u._id !== user._id);
//   };

//   const getFullName = (u) =>
//     u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "";

//   const handleLogout = () => {
//     socket.disconnect();
//     logout();
//     navigate("/");
//   };

//   const deleteMessageHandler = async (messageId) => {
//     try {
//       const { data } = await api.delete(`/message/${messageId}`, {
//         headers: { Authorization: `Bearer ${user.token}` },
//       });

//       setMessages((prev) => prev.filter((m) => m._id !== messageId));

//       // Update sidebar latest message
//       setChats((prev) =>
//         prev.map((chat) =>
//           chat._id === selectedChat._id
//             ? { ...chat, latestMessage: data.latestMessage || null }
//             : chat,
//         ),
//       );
//     } catch (error) {
//       console.log(error);
//     }
//   };

//   /* ================= AUTH ================= */

//   useEffect(() => {
//     if (!user) navigate("/");
//   }, [user, navigate]);

//   /* ================= FETCH CHATS ================= */

//   useEffect(() => {
//     if (!user) return;

//     const fetchChats = async () => {
//       const { data } = await api.get("/chat", {
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       setChats(data);
//     };

//     fetchChats();
//   }, [user]);

//   const fetchMessages = async (chatId) => {
//     try {
//       const { data } = await api.get(`/message/${chatId}`, {
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       setMessages(data || []);
//     } catch (err) {
//       console.log("Fetch message error:", err);
//     }
//   };

//   /* ================= SEARCH USERS ================= */

//   useEffect(() => {
//     const fetchUsers = async () => {
//       if (!searchQuery.trim()) {
//         setSearchResults([]);
//         return;
//       }

//       try {
//         const { data } = await api.get(`/user?search=${searchQuery}`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         setSearchResults(data);
//       } catch (err) {
//         console.log("Search error:", err);
//       }
//     };

//     const delay = setTimeout(fetchUsers, 400);
//     return () => clearTimeout(delay);
//   }, [searchQuery, user.token]);

//   /* ================= ONLINE USERS ================= */

//   useEffect(() => {
//     if (user?._id) socket.emit("user-online", user._id);
//   }, [user?._id]);

//   useEffect(() => {
//     socket.on("online-users", ({ online, lastSeen }) => {
//       setOnlineUsers(online || []);
//       setLastSeen(lastSeen || {});
//     });

//     return () => socket.off("online-users");
//   }, []);

//   /* ================= RECEIVE MESSAGE ================= */

//   useEffect(() => {
//     socket.on("receive-message", (message) => {
//       const chatId =
//         typeof message.chat === "string" ? message.chat : message.chat?._id;

//       setChats((prev) => {
//         const updated = prev.map((chat) =>
//           chat._id === chatId ? { ...chat, latestMessage: message } : chat,
//         );

//         const target = updated.find((c) => c._id === chatId);
//         const rest = updated.filter((c) => c._id !== chatId);

//         return target ? [target, ...rest] : updated;
//       });

//       if (selectedChat?._id === chatId) {
//         setMessages((prev) => [...prev, message]);
//       }

//       setTypingChats((prev) => ({ ...prev, [chatId]: false }));
//     });

//     return () => socket.off("receive-message");
//   }, [selectedChat?._id]);

//   /* ================= TYPING ================= */

//   useEffect(() => {
//     socket.on("typing", ({ chatId, userId }) => {
//       if (userId === user._id) return;
//       setTypingChats((prev) => ({ ...prev, [chatId]: true }));
//     });

//     socket.on("stop-typing", ({ chatId }) => {
//       setTypingChats((prev) => ({ ...prev, [chatId]: false }));
//     });

//     return () => {
//       socket.off("typing");
//       socket.off("stop-typing");
//     };
//   }, [user?._id]);

//   const handleTyping = (value) => {
//     setNewMessage(value);
//     if (!selectedChat) return;

//     socket.emit("typing", {
//       chatId: selectedChat._id,
//       userId: user._id,
//     });

//     clearTimeout(typingTimeoutRef.current);

//     typingTimeoutRef.current = setTimeout(() => {
//       socket.emit("stop-typing", {
//         chatId: selectedChat._id,
//         userId: user._id,
//       });
//     }, 1500);
//   };

//   /* ================= OPEN CHAT ================= */

//   const openChat = async (chat) => {
//     if (!chat?.users) return;
//     setSelectedChat(chat);
//     await fetchMessages(chat._id);
//     socket.emit("join-chat", chat._id);
//   };

//   /* ================= SCROLL ================= */

//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ================= SEND MESSAGE ================= */

//   const sendMessage = async (e) => {
//     e.preventDefault();
//     if (!newMessage.trim() || !selectedChat) return;

//     const { data } = await api.post(
//       "/message",
//       { content: newMessage, chatId: selectedChat._id },
//       { headers: { Authorization: `Bearer ${user.token}` } },
//     );

//     setMessages((prev) => [...prev, data]);
//     setNewMessage("");

//     socket.emit("send-message", {
//       chatId: selectedChat._id,
//       message: data,
//     });
//   };

//   /* ================= START CHAT FROM SEARCH ================= */

//   const startChat = async (userId) => {
//     try {
//       const { data } = await api.post(
//         "/chat",
//         { userId },
//         { headers: { Authorization: `Bearer ${user.token}` } },
//       );

//       setShowSearch(false);
//       setSearchQuery("");
//       setSearchResults([]);

//       setSelectedChat(data);
//       await fetchMessages(data._id);
//       socket.emit("join-chat", data._id);
//     } catch (err) {
//       console.log(err);
//     }
//   };

//   /* ================= RENDER ================= */

//   return (
//     <div className="h-screen flex bg-bg text-white overflow-hidden">
//       {/* SIDEBAR */}
//       <div
//         className={`${
//           selectedChat ? "hidden sm:flex" : "flex"
//         } w-full sm:w-1/3 flex-col border-r border-borderColor bg-surface`}
//       >
//         <div className="p-4 border-b border-borderColor flex justify-between items-center">
//           <h2 className="text-lg font-semibold">Chats</h2>
//           <div className="flex gap-2">
//             <button
//               onClick={() => setShowSearch(true)}
//               className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
//             >
//               +
//             </button>
//             <button
//               onClick={handleLogout}
//               className="bg-red-500 px-3 py-1 rounded-lg text-xs"
//             >
//               Logout
//             </button>
//           </div>
//         </div>

//         <div className="flex-1 overflow-y-auto p-4 space-y-2">
//           {chats.map((chat) => {
//             const otherUser = getOtherUser(chat);
//             const lastMsg = chat.latestMessage;

//             return (
//               <div
//                 key={chat._id}
//                 onClick={() => openChat(chat)}
//                 className="p-3 rounded-xl hover:bg-borderColor cursor-pointer"
//               >
//                 <div className="flex justify-between">
//                   <span className="font-semibold">
//                     {getFullName(otherUser)}
//                   </span>
//                   {lastMsg && (
//                     <span className="text-xs text-textMuted">
//                       {formatTime(lastMsg.createdAt)}
//                     </span>
//                   )}
//                 </div>

//                 <p className="text-sm truncate text-textMuted mt-1">
//                   {typingChats[chat._id]
//                     ? "Typing..."
//                     : lastMsg
//                       ? lastMsg.content
//                       : "No messages yet"}
//                 </p>
//               </div>
//             );
//           })}
//         </div>
//       </div>

//       {/* CHAT ROOM */}
//       <div
//         className={`${
//           selectedChat ? "flex" : "hidden sm:flex"
//         } flex-1 flex-col min-w-0`}
//       >
//         {selectedChat && (
//           <>
//             <div className="p-4 border-b border-borderColor flex items-center gap-3">
//               <button
//                 onClick={() => setSelectedChat(null)}
//                 className="sm:hidden"
//               >
//                 ←
//               </button>

//               <div>
//                 <h3 className="font-semibold">
//                   {getFullName(getOtherUser(selectedChat))}
//                 </h3>
//                 <p className="text-xs text-textMuted">
//                   {typingChats[selectedChat._id]
//                     ? "Typing..."
//                     : onlineUsers.includes(getOtherUser(selectedChat)?._id)
//                       ? "Online"
//                       : lastSeen[getOtherUser(selectedChat)?._id]
//                         ? `Last seen at ${formatTime(
//                             lastSeen[getOtherUser(selectedChat)?._id],
//                           )}`
//                         : "Offline"}
//                 </p>
//               </div>
//             </div>

//             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
//               {messages.map((msg) => {
//                 const isMe = getSenderId(msg) === user._id;

//                 return (
//                   <div
//                     key={msg._id}
//                     className={`flex ${isMe ? "justify-end" : "justify-start"}`}
//                     onDoubleClick={() => isMe && deleteMessageHandler(msg._id)}
//                   >
//                     <div
//                       className={`px-4 py-2 rounded-2xl text-sm max-w-[80%] break-words ${
//                         isMe
//                           ? "bg-primary text-white rounded-br-none"
//                           : "bg-[#1f2937] rounded-bl-none"
//                       }`}
//                     >
//                       {msg.content}
//                       <div className="text-[10px] opacity-70 mt-1 text-right">
//                         {formatTime(msg.createdAt)}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//               <div ref={bottomRef} />
//             </div>

//             <form
//               onSubmit={sendMessage}
//               className="p-4 border-t border-borderColor flex gap-2"
//             >
//               <input
//                 value={newMessage}
//                 onChange={(e) => handleTyping(e.target.value)}
//                 className="flex-1 bg-surface rounded-full px-4 py-2"
//                 placeholder="Type a message…"
//               />
//               <button className="bg-primary px-4 py-2 rounded-full">
//                 Send
//               </button>
//             </form>
//           </>
//         )}
//       </div>

//       {/* SEARCH MODAL */}
//       {showSearch && (
//         <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
//           <div className="bg-surface w-full max-w-md rounded-2xl p-6 relative">
//             <button
//               onClick={() => setShowSearch(false)}
//               className="absolute top-3 right-3"
//             >
//               ✕
//             </button>

//             <h3 className="text-lg font-semibold mb-4">Start New Chat</h3>

//             <input
//               type="text"
//               placeholder="Search users..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               className="w-full p-3 rounded-lg bg-bg border border-borderColor"
//             />

//             <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
//               {searchResults.map((u) => (
//                 <div
//                   key={u._id}
//                   onClick={() => startChat(u._id)}
//                   className="p-2 rounded-lg hover:bg-borderColor cursor-pointer"
//                 >
//                   {getFullName(u)}
//                 </div>
//               ))}

//               {searchResults.length === 0 && searchQuery && (
//                 <p className="text-sm text-textMuted">No users found</p>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// export default Chat;
