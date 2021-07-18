console.log('Server running')

const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT);

app.use(express.static('public'));

let socket = require('socket.io');
let io = socket(server);
io.sockets.on('connection', handleConnection);

let clients = [];

function handleConnection(socket) {
  console.log('New connection:' + socket.id);

  addNewUser(socket);

  socket.on('messageSent', handleMessage);
  socket.on('requestNewUsername', setUsername);
  socket.on('requestNewGame', startNewGame);

  io.on('connection', (socket) => {
    socket.on("disconnect", (reason) => {
      handleDisconnection(socket);
    });
  });


  function handleMessage(data) {
    console.log(socket.id, data);
    data.socketId = socket.id;
    data.socketIdIndex = clients.indexOf(socket.id);
    let message = getUser(socket.id).username + ': ' + data;
    io.emit('messageSent', message);
    //io.sockets.emit('message', data);
  }

  function setUsername(data) {
    console.log(data);
    console.log(socket.id);
    // console.log(clients);
    // data.socketId = socket.id;
    // data.socketIdIndex = clients.indexOf(socket.id);
    let user = getUser(socket.id);
    user.username = data;
    io.to(socket.id).emit('usernameChanged', user.username);
    io.emit('activeUsersListUpdated', getListOfActiveUsernames());
  }
}

function handleDisconnection(disconnectedSocket) {
  console.log('Disconnected: ' + disconnectedSocket.id);
  for(let i = 0; i < clients.length; i++) {
    if(clients[i].socket.id == disconnectedSocket.id) {
      clients.splice(i, 1);
      break;
    }
  }
  io.emit('activeUsersListUpdated', getListOfActiveUsernames());
}

function addNewUser(socket) {
  let newClient = {
    username: '',
    socket: socket
  }
  clients.push(newClient);
}

function getUser(id) {
  for(let i = 0; i < clients.length; i++) {
    if(id == clients[i].socket.id) {
      return clients[i];
    }
  }
  return undefined;
}

function getListOfActiveUsernames() {
  let activeUsernames = [];
  for(let i = 0; i < clients.length; i++) {
    if(clients[i].username != '') {
      activeUsernames.push(clients[i].username);
    }
  }
  return activeUsernames;
}

function startNewGame() {
  let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomLetter = alphabet.charAt(Math.floor(Math.random()*alphabet.length));
  let categories = [
    'Nome',
    'Fruta, Verdura ou Legume',
    'Animal',
    'Cidade, Estado ou País',
    'Comida',
    'Objeto',
    'Filme ou Série'
  ];

  let gameRoundInfo = {
    randomLetter: randomLetter,
    categories: categories
  }

  io.emit('gameStarted', gameRoundInfo);

  console.log(gameRoundInfo);

  //Iniciar timer
}
