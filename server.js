const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const createServer = require('./createServer');


(async ()=>{
  const {server} = createServer();

  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  process.on('SIGINT', async ()=>{
    process.exit(0) //gracefull exit
  })
})()

// Add a basic route for testing
// app.get('/', (req, res) => {
//   res.send('Socket.IO server is running');
// });
