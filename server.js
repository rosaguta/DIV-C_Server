// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In production, set this to your frontend origin
    methods: ['GET', 'POST']
  }
});

const chatRooms = {}

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Triggered when a peer hits the join room button
  socket.on('join', (roomName) => {
    const { rooms } = io.sockets.adapter;
    const room = rooms.get(roomName);

    // room == undefined when no such room exists
    if (room === undefined) {
      socket.join(roomName);
      chatRooms[roomName] = chatRooms[roomName] || [];
      socket.emit('created');
    } else if (room.size === 1) {
      // room.size == 1 when one person is inside the room
      socket.join(roomName);
      socket.emit('joined');
    } else {
      // when there are already two people inside the room
      socket.emit('full');
    }
    console.log(rooms);
  });

  // Triggered when the person who joined the room is ready to communicate
  socket.on('ready', (roomName) => {
    socket.broadcast.to(roomName).emit('ready'); // Informs the other peer in the room
  });

  // Triggered when server gets an icecandidate from a peer in the room
  socket.on('ice-candidate', (candidate, roomName) => {
    // Log the ICE candidate for debugging
    console.log('ICE candidate received:', candidate);
    
    // Forward the ICE candidate to other peers in the room
    socket.broadcast.to(roomName).emit('ice-candidate', candidate);
  });

  // Triggered when server gets an offer from a peer in the room
  socket.on('offer', (offer, roomName) => {
    socket.broadcast.to(roomName).emit('offer', offer); // Sends Offer to the other peer in the room
  });

  // Triggered when server gets an answer from a peer in the room
  socket.on('answer', (answer, roomName) => {
    socket.broadcast.to(roomName).emit('answer', answer); // Sends Answer to the other peer in the room
  });
  // Triggered when a user sends a message
  socket.on('message', (message, roomName) => {
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }
    chatRooms[roomName].push(message);
    console.log(chatRooms[roomName])
    socket.broadcast.to(roomName).emit('message', chatRooms[roomName]);
  });

  socket.on('leave', (roomName) => {
    socket.leave(roomName);
    socket.broadcast.to(roomName).emit('leave');
  });
});

// Add a basic route for testing
app.get('/', (req, res) => {
  res.send('Socket.IO server is running');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});