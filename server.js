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

  socket.on('messageSent', handleMessage)
  socket.on('requestNewUsername', setUsername)

  function handleMessage(data) {
    console.log(socket.id, data);
    data.socketId = socket.id;
    data.socketIdIndex = clients.indexOf(socket.id);
    let message = getUser(socket.id).username + ': ' + data;
    io.emit('messageSent', message);
    //io.sockets.emit('message', data);
  }

  function setUsername(data) {
    console.log(data)
    console.log(socket.id)
    // console.log(clients)
    // data.socketId = socket.id;
    // data.socketIdIndex = clients.indexOf(socket.id);
    let user = getUser(socket.id);
    user.username = data;
    io.to(socket.id).emit('usernameChanged', user.username);
  }
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
