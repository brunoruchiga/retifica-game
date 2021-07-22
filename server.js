console.log('\n\n\n\n\n\n\n\n\n\n//////////////////////////////////////////')
console.log('Server running')

const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT);

app.use(express.static('public'));

let socket = require('socket.io');
let io = socket(server, {
  pingTimeout: 30*60*1000
});
io.sockets.on('connection', handleConnection);

let globalClients = [];
let rooms = {};

function handleConnection(socket) {
  console.log('New connection: ' + socket.id);
  io.to(socket.id).emit('newSocketConnection');

  globalClients.push(new Client(socket));

  socket.on('requestToJoinRoom', joinNewUserToRoom);

  function joinNewUserToRoom(data) {
    if(!rooms[data.room]) {
      rooms[data.room] = new Room(data.room);
    }
    socket.join(data.room);
    rooms[data.room].handleRequestToJoinRoomByUsername(data.username, socket);

    socket.to(data.room).on('requestNewGame', ()=>{rooms[data.room].startNewGame();});
    socket.to(data.room).on('sendAnswer', ()=>{rooms[data.room].handleAnswerSent();});
    socket.to(data.room).on('chatMessageSent', ()=>{rooms[data.room].handleChatMessage();});
    socket.to(data.room).on('disconnect', (reason)=>{rooms[data.room].handleDisconnection(reason, socket)});

    io.to(socket.id).emit('userJoinedGame', {
      room: data.room,
      gameState:rooms[data.room].gameState
    });
    io.to(data.room).emit('activeUsersListUpdated', rooms[data.room].getListOfActiveUsernames());
  }
}

function Client(socket) {
  this.username = '';
  this.socket = socket;
  this.answer = [];
}

function GameState() {
  this.state = 'waiting';
  this.roundInfo = undefined;
  this.results = undefined;
};

function Room(room) {
  this.room = room;
  this.clients = [];
  this.gameState  = new GameState();

  this.handleRequestToJoinRoomByUsername = function(username, socket) {
    //Try to find username already in list
    let user = this.findUserByUsername(username);
    //If username was found already in list...
    if(user) {
      if(user.socket == undefined) { //...If there is no socket, attribute this socket to the same user
        user.socket = socket;
      } else {
        let differentUsernameGenerated = username;
        let counter = 2;
        while(this.findUserByUsername(differentUsernameGenerated + counter)) {
          counter++;
        }
        this.changeUsername(differentUsernameGenerated + counter, socket);
      }
    } else {
      //If username is not in list, attribute username to this socket
      user = this.createUserByUsername(username, socket);
      user.socket = socket;
    }
    this.clients.push(user);
    console.log('New user joined game: ' + username + ' ' + socket.id);
  }

  this.findUserByUsername = function(username) {
    for(let i = 0; i < this.clients.length; i++) {
      if(this.clients[i].username == username) {
        return this.clients[i];
      }
    }
    return undefined;
  }

  this.createUserByUsername = function(newUsername, socket) {
    let user = this.getUser(socket.id);
    if(!user) {
      user = new Client(socket);
    }
    user.username = newUsername;
    io.to(socket.id).emit('usernameConfirmed', newUsername);
    return user;
  }

  this.startNewGame = function() {
    this.gameState.state = 'playing';
    this.serverTimer = -1;
    this.timerSetTimeoutFunction = undefined;

    for(let i = 0; i < this.clients.length; i++) {
      this.clients[i].answers = [];
    }

    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let randomLetter = alphabet.charAt(Math.floor(Math.random()*alphabet.length));
    let totalTime = 60;
    let activeCategoriesThisRound = [
      'Nome de idoso',
      'Lugar que chorei',
      'Sabor de miojo',
      'Presente criativo',
      'Artista ruim'
    ];

    this.gameState.roundInfo = {
      randomLetter: randomLetter,
      categories: activeCategoriesThisRound,
      totalTime: totalTime
    }
    io.to(this.room).emit('gameStarted', this.gameState.roundInfo);

    console.log(this.gameState.roundInfo);

    this.initializeTimer(totalTime);
  }

  this.initializeTimer = function(initialTime) {
    clearTimeout(this.timerSetTimeoutFunction);
    this.serverTimer = initialTime;
    this.updateTimer();
  }
  this.updateTimer = function() {
    if(this.serverTimer > 0) {
      this.serverTimer = this.serverTimer - 1;
      this.timerSetTimeoutFunction = setTimeout(()=>{this.updateTimer()}, 1000);
      io.to(this.room).emit('tickSecond', {timeCurrentValue: this.serverTimer});
    } else {
      this.gameState.state = 'results';
      io.to(this.room).emit('serverTimerExpired', this.getAnswersForAllCategories());
      console.log('Timer expired!');
      console.log(this.getAnswersForAllCategories());
    }
  }

  this.getAnswersForAllCategories = function() {
    let answersForAllCategories = [];
    for(let categoryIndex = 0; categoryIndex < this.gameState.roundInfo.categories.length; categoryIndex++) {
      let categoryAnswer = {
        category: this.gameState.roundInfo.categories[categoryIndex],
        answers: []
      }
      answersForAllCategories.push(categoryAnswer);
      for(let clientIndex = 0; clientIndex < this.clients.length; clientIndex++) {
        if(this.clients[clientIndex].answers) {
          for(let i = 0; i < this.clients[clientIndex].answers.length; i++) {
            if(this.clients[clientIndex].answers[i].question == this.gameState.roundInfo.categories[categoryIndex]) {
              let answer = {
                answerString: this.clients[clientIndex].answers[i].answerString,
                authorUsername: this.clients[clientIndex].username
              }
              answersForAllCategories[categoryIndex].answers.push(answer);
            }
          }
        }
      }
    }
    return answersForAllCategories;
  }

  this.getListOfActiveUsernames = function() {
    let activeUsernames = [];
    for(let i = 0; i < this.clients.length; i++) {
      if(this.clients[i].socket) {
        activeUsernames.push(this.clients[i].username);
      }
    }
    return activeUsernames;
  }

  this.handleDisconnection = function(reason, socket) {
    console.log('Disconnected: ' + socket.id + ' ('+reason+')');
    for(let i = 0; i < this.clients.length; i++) {
      if(this.clients[i].socket != undefined) {
        if(this.clients[i].socket.id == socket.id) {
          this.clients[i].socket = undefined;
          break;
        }
      }
    }
    io.emit('activeUsersListUpdated', this.getListOfActiveUsernames());
  }

  this.handleAnswerSent = function(data) {
    let user = this.getUser(socket.id);
    if(user) {
      if(user.answers) {
        user.answers.push(data);
      }
    }
  }

  this.getUser = function(id) {
    for(let i = 0; i < this.clients.length; i++) {
      if(this.clients[i].socket != undefined) {
        if(id == this.clients[i].socket.id) {
          return this.clients[i];
        }
      }
    }
    return undefined;
  }

  this.handleChatMessage = function(data) {
    let message = this.getUser(socket.id).username + ': ' + data;
    io.emit('chatMessageSent', message);
    //io.sockets.emit('message', data);
    console.log('Chat message sent:', socket.id, message);
  }
}
