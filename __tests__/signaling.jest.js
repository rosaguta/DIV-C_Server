const createServer = require("../createServer");
const { io: Client } = require("socket.io-client");

describe("signaling service", () => {
  let io, server;
  let clientSocket1, clientSocket2;
  let port;

  beforeAll((done) => {
    ({ server, io } = createServer());
    server.listen(() => {
      port = server.address().port;
      done();
    });
  });

  afterEach(() => {
    if (clientSocket1 && clientSocket1.connected) clientSocket1.disconnect();
    if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
  });

  afterAll((done) => {
    if (io) io.close();
    if (server) server.close(done);
  });

  test("client connects successfully", (done) => {
    clientSocket1 = Client(`http://localhost:${port}`);
    clientSocket1.on("connect", () => {
      expect(clientSocket1.connected).toBe(true);
      done();
    });
  });

  test("first user joins a room and receives 'created'", (done) => {
    clientSocket1 = Client(`http://localhost:${port}`);
    clientSocket1.on("connect", () => {
      clientSocket1.emit("join", "test-room");
    });

    clientSocket1.on("created", () => {
      done();
    });
  });

  test("second user joins and receives 'user-list' and 'joined'", (done) => {
    let eventsReceived = 0;

    clientSocket1 = Client(`http://localhost:${port}`);
    clientSocket2 = Client(`http://localhost:${port}`);

    clientSocket1.on("connect", () => {
      clientSocket1.emit("join", "room-2");
    });

    clientSocket2.on("connect", () => {
      clientSocket2.emit("join", "room-2");
    });

    clientSocket2.on("user-list", (list) => {
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(1);
      eventsReceived++;
    });

    clientSocket2.on("joined", () => {
      eventsReceived++;
      if (eventsReceived === 2) done();
    });
  });

  test("second user receives 'user-joined' when new user joins", (done) => {
    clientSocket1 = Client(`http://localhost:${port}`);
    clientSocket2 = Client(`http://localhost:${port}`);

    clientSocket1.on("connect", () => {
      clientSocket1.emit("join", "room-3");

      clientSocket2.on("connect", () => {
        clientSocket2.emit("join", "room-3");
      });

      clientSocket1.on("user-joined", (data) => {
        expect(data).toHaveProperty("id");
        expect(data).toHaveProperty("username");
        done();
      });
    });
  });

  test("room emits 'full' if max clients exceeded", (done) => {
    const MAX = 10;
    const clients = [];

    const connectClient = (i) => {
      const client = Client(`http://localhost:${port}`);
      clients.push(client);
      client.on("connect", () => {
        client.emit("join", "full-room");

        if (i === MAX) {
          client.on("full", () => {
            clients.forEach(c => c.disconnect());
            done();
          });
        }
      });
    };

    for (let i = 0; i <= MAX; i++) connectClient(i);
  });

  test("client leaving emits 'user-left'", (done) => {
    clientSocket1 = Client(`http://localhost:${port}`);
    clientSocket2 = Client(`http://localhost:${port}`);
    let clientSocket2ID = ""
    clientSocket1.on("connect", () => {
      clientSocket1.emit("join", "leaving-room");

      clientSocket2.on("connect", () => {
        clientSocket2.emit("join", "leaving-room");
        clientSocket2ID = clientSocket2.id

        clientSocket1.on("user-joined", () => {
          clientSocket2.emit('leave', 'leaving-room')
          clientSocket2.disconnect(); 
        });

        clientSocket1.on("user-left", (id) => {
          expect(id).toBe(clientSocket2ID);
          done();
        });
      });
    });
  });
});
