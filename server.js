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

const MAX_CLIENTS_PER_ROOM = 10; // Maximum number of clients per room
const chatRooms = {}; // Store chat messages for each room
const roomParticipants = {}; // Store participants data for each room

// Socket.IO handlers
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Triggered when a peer hits the join room button
  socket.on('join', (roomName) => {
    const { rooms } = io.sockets.adapter;
    const room = rooms.get(roomName);
    
    console.log('Room details:', {
      roomName,
      roomExists: room !== undefined,
      roomSize: room ? room.size : 0
    });

    // Initialize room structures if they don't exist
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }
    
    if (!roomParticipants[roomName]) {
      roomParticipants[roomName] = {};
    }

    // Check if room is full
    if (room && room.size >= MAX_CLIENTS_PER_ROOM) {
      socket.emit('full');
      return;
    }

    // Add participant data
    roomParticipants[roomName][socket.id] = {
      id: socket.id,
      username: `User-${socket.id.substr(0, 5)}`
    };

    // Join the room
    socket.join(roomName);

    // If room didn't exist, this user is the first one
    if (room === undefined || room.size === 1) {
      socket.emit('created');
    } else {
      // Room already exists, get existing participants
      const existingParticipants = [];
      
      // Get all socket IDs in the room except the current one
      const socketsInRoom = Array.from(room).filter(id => id !== socket.id);
      
      // Create list of existing participants
      socketsInRoom.forEach(socketId => {
        if (roomParticipants[roomName][socketId]) {
          existingParticipants.push(roomParticipants[roomName][socketId]);
        }
      });

      // Send existing participants list to the new user
      socket.emit('user-list', existingParticipants);
      
      // Notify the new user they've joined
      socket.emit('joined');
      // Notify existing participants about the new user
      socket.to(roomName).emit('user-joined', {
        id: socket.id,
        username: roomParticipants[roomName][socket.id].username
      });
    }

    console.log('Updated room participants:', roomParticipants[roomName]);
  });

  // Triggered when a user is ready with their media
  socket.on('ready', (roomName) => {
    console.log(`User ${socket.id} is ready in room ${roomName}`);
    socket.to(roomName).emit('ready', socket.id);
  });

  // Triggered when server gets an icecandidate from a peer in the room
  socket.on('ice-candidate', (candidateData, roomName) => {
    console.log(`ICE candidate from ${socket.id} to ${candidateData.targetId}`);
    
    // Forward the ICE candidate to the specific peer
    if (candidateData.targetId) {
      // Direct to specific peer
      io.to(candidateData.targetId).emit('ice-candidate', {
        candidate: candidateData.candidate,
        from: socket.id
      });
    } else {
      // Broadcast to all peers in room (backward compatibility)
      socket.to(roomName).emit('ice-candidate', candidateData.candidate, socket.id);
    }
  });

  // Triggered when server gets an offer from a peer in the room
  socket.on('offer', (offerData, roomName) => {
    console.log(`Offer from ${socket.id} to ${offerData.targetId}`);
    
    // Send offer to specific peer
    io.to(offerData.targetId).emit('offer', {
      offer: offerData.offer,
      from: socket.id
    });
  });

  // Triggered when server gets an answer from a peer in the room
  socket.on('answer', (answerData, roomName) => {
    console.log(`Answer from ${socket.id} to ${answerData.targetId}`);
    
    // Send answer to specific peer
    io.to(answerData.targetId).emit('answer', {
      answer: answerData.answer,
      from: socket.id
    });
  });

  // Triggered when a user sends a message
  socket.on('message', (message, roomName) => {
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }
    
    const formattedMessage = `${roomParticipants[roomName]?.[socket.id]?.username || socket.id}: ${message}`;
    chatRooms[roomName].push(formattedMessage);
    
    console.log(`New message in ${roomName}: ${formattedMessage}`);
    
    // Broadcast message to everyone in the room including sender
    io.in(roomName).emit('message', chatRooms[roomName]);
  });

  // Get all messages for a room
  socket.on('messages', (roomName) => {
    if (!chatRooms[roomName]) {
      chatRooms[roomName] = [];
    }
    
    console.log(`Sending messages for room ${roomName}`);
    socket.emit('message', chatRooms[roomName]);
  });

  // Leave room
  socket.on('leave', (roomName) => {
    handleDisconnect(socket, roomName);
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    
    // Find all rooms this socket was in
    for (const roomName in roomParticipants) {
      if (roomParticipants[roomName][socket.id]) {
        handleDisconnect(socket, roomName);
      }
    }
  });

  // Helper function to handle user leaving a room
  function handleDisconnect(socket, roomName) {
    console.log(`User ${socket.id} leaving room ${roomName}`);
    
    // Remove from room participants
    if (roomParticipants[roomName] && roomParticipants[roomName][socket.id]) {
      delete roomParticipants[roomName][socket.id];
      
      // If room is now empty, clean up
      if (Object.keys(roomParticipants[roomName]).length === 0) {
        delete roomParticipants[roomName];
        // Note: We're keeping chat history, but you could delete it here too
        // delete chatRooms[roomName];
      }
    }
    
    // Leave the socket.io room
    socket.leave(roomName);
    
    // Notify others that this user has left
    socket.to(roomName).emit('user-left', socket.id);
  }
});

// Add a basic route for testing
app.get('/', (req, res) => {
  res.send('Socket.IO server is running');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});