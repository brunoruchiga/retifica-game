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

let serverTimer;

function handleConnection(socket) {
  console.log('New connection:' + socket.id);
  io.to(socket.id).emit('newSocketConnection');

  addNewClient(socket);

  socket.on('chatMessageSent', handleChatMessage);
  socket.on('requestToJoinGame', joinNewUserToGame);
  socket.on('requestNewGame', startNewGame);
  socket.on('disconnect', (reason) => handleDisconnection(socket));

  function joinNewUserToGame(username) {
    //Try to find username already in list
    let user = findUserByUsername(username);
    //If username was found already in list...
    if(user) {
      if(user.socket == undefined) { //...If there is no socket, attribute this socket to the same user
        user.socket = socket;
      } else {
        let differentUsernameGenerated = username;
        let counter = 2;
        while(findUserByUsername(differentUsernameGenerated + counter)) {
          counter++;
        }
        changeUsername(differentUsernameGenerated + counter);
      }
    } else {
    //If username is not in list, attribute username to this socket
      changeUsername(username);
    }

    io.to(socket.id).emit('userJoinedGame', );
    io.emit('activeUsersListUpdated', getListOfActiveUsernames());
    console.log('New user joined game: ' + username + ' ' + socket.id);
  }

  function changeUsername(newUsername) {
    let user = getUser(socket.id);
    if(user) {
      user.username = newUsername;
    }
    io.to(socket.id).emit('usernameChanged', newUsername);
  }

  function handleChatMessage(data) {
    data.socketId = socket.id;
    data.socketIdIndex = clients.indexOf(socket.id);
    let message = getUser(socket.id).username + ': ' + data;
    io.emit('chatMessageSent', message);
    //io.sockets.emit('message', data);
    console.log('Chat message sent:', socket.id, message);
  }
}

function handleDisconnection(disconnectedSocket) {
  console.log('Disconnected: ' + disconnectedSocket.id);
  for(let i = 0; i < clients.length; i++) {
    if(clients[i].socket != undefined) {
      if(clients[i].socket.id == disconnectedSocket.id) {
        // clients.splice(i, 1);
        clients[i].socket = undefined;
        break;
      }
    }
  }
  io.emit('activeUsersListUpdated', getListOfActiveUsernames());
}

function addNewClient(socket) {
  let newClient = {
    username: '',
    socket: socket
  }
  clients.push(newClient);
}

function getUser(id) {
  for(let i = 0; i < clients.length; i++) {
    if(clients[i].socket != undefined) {
      if(id == clients[i].socket.id) {
        return clients[i];
      }
    }
  }
  return undefined;
}

function getListOfActiveUsernames() {
  let activeUsernames = [];
  for(let i = 0; i < clients.length; i++) {
    if(clients[i].socket) {
      activeUsernames.push(clients[i].username);
    }
  }
  return activeUsernames;
}

function findUserByUsername(username) {
  for(let i = 0; i < clients.length; i++) {
    if(clients[i].username == username) {
      return clients[i];
    }
  }
  return undefined;
}

function startNewGame() {
  let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomLetter = alphabet.charAt(Math.floor(Math.random()*alphabet.length));
  let totalTime = 30;
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
    categories: categories,
    totalTime: totalTime
  }
  io.emit('gameStarted', gameRoundInfo);

  console.log(gameRoundInfo);

  initializeTimer(totalTime);
}

function initializeTimer(initialTime) {
  serverTimer = initialTime;
  updateTimer();
}
function updateTimer() {
  if(serverTimer > 0) {
    serverTimer = serverTimer - 1;
    setTimeout(updateTimer, 1000);
  } else {
    io.emit('serverTimerExpired');
    console.log('Timer expired!');
  }
}
