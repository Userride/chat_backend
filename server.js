const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const colors = require("colors");
const socketIO = require("socket.io");
const cors = require("cors");

// Load environment variables
dotenv.config();

// Connect to the database
connectDB();

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000",  // Local development
  "https://chatapp1-black.vercel.app", // Production frontend
];

// Enable CORS for Express API
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS Error: Origin ${origin} not allowed`);
        callback(new Error("CORS not allowed"), false);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Required for authentication (cookies, etc.)
  })
);

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// Deployment setup
const __dirname1 = path.resolve();
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running...");
  });
}

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

// Start the server
const server = app.listen(
  PORT,
  console.log(`Server running on PORT ${PORT}...`.yellow.bold)
);

// Socket.io setup
const io = socketIO(server, {
  pingTimeout: 60000,
  cors: {
    origin: allowedOrigins, // Allow both localhost & production frontend
    methods: ["GET", "POST"],
    credentials: true, // Required for authentication (cookies, etc.)
  },
});

io.on("connection", (socket) => {
  console.log("Connected to Socket.IO");

  // Setup user socket
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    console.log(`User ${userData._id} connected`);
    socket.emit("connected");
  });

  // User joins a chat room
  socket.on("join chat", (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  // Typing notifications
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  // Handle new message
  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat?.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;
      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected from Socket.IO");
  });

  // Clean up when user leaves a chat
  socket.on("leave chat", (room) => {
    socket.leave(room);
    console.log(`User left room: ${room}`);
  });
});
