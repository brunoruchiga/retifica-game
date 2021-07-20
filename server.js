console.log('Server running')

const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT);

app.use(express.static('public'));

let socket = require('socket.io');
let io = socket(server, {pingTimeout: 30*60*1000});
io.sockets.on('connection', handleConnection);

let clients = [];
let gameInstance = new GameInstance();

function handleConnection(socket) {
  console.log('Socket connected: ' + socket.id);
  io.to(socket.id).emit('newSocketConnection');

  clients.push(new Client(socket));

  socket.on('requestToJoinGame', joinNewUserToGame);
  socket.on('requestNewGame', gameInstance.start);
  socket.on('sendAnswer', handleAnswerSent);
  socket.on('chatMessageSent', handleChatMessage);
  socket.on('disconnect', handleDisconnection);

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

  function handleAnswerSent(data) {
    let user = getUser(socket.id);
    if(user) {
      user.answers.push(data);
    }
  }

  function handleChatMessage(data) {
    let message = getUser(socket.id).username + ': ' + data;
    io.emit('chatMessageSent', message);
    //io.sockets.emit('message', data);
    console.log('Chat message sent:', socket.id, message);
  }

  function handleDisconnection(reason) {
    console.log('Socket disconnected: ' + socket.id);
    for(let i = 0; i < clients.length; i++) {
      if(clients[i].socket != undefined) {
        if(clients[i].socket.id == socket.id) {
          clients[i].socket = undefined;
          break;
        }
      }
    }
    io.emit('activeUsersListUpdated', getListOfActiveUsernames());
  }
}

function Client(socket) {
  this.username = '';
  this.socket = socket,
  this.answer = [];
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


///////////////////////////
//Game logic

function GameInstance() {
  this.serverTimer;
  this.gameRoundInfo;

  this.initializeTimer = function(initialTime) {
    this.serverTimer = initialTime;
    gameInstance.updateTimer();
  }
  this.updateTimer = function() {
    if(this.serverTimer > 0) {
      this.serverTimer = this.serverTimer - 1;
      setTimeout(gameInstance.updateTimer, 1000);
    } else {
      io.emit('serverTimerExpired');
      console.log('Timer expired!');
      console.log(getAnswersForAllCategories());
      io.emit('presentAllAnswers', getAnswersForAllCategories());
    }
  }

  this.start = function() {
    for(let i = 0; i < clients.length; i++) {
      clients[i].answers = [];
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

    this.gameRoundInfo = {
      randomLetter: randomLetter,
      categories: activeCategoriesThisRound,
      totalTime: totalTime
    }
    io.emit('gameStarted', this.gameRoundInfo);

    console.log(this.gameRoundInfo);

    console.log(this);
    gameInstance.initializeTimer(totalTime);
  }

  this.getAnswersForAllCategories = function() {
    let answersForAllCategories = [];
    for(let categoryIndex = 0; categoryIndex < this.gameRoundInfo.categories.length; categoryIndex++) {
      let categoryAnswer = {
        category: this.gameRoundInfo.categories[categoryIndex],
        answers: []
      }
      answersForAllCategories.push(categoryAnswer);
      for(let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
        for(let i = 0; i < clients[clientIndex].answers.length; i++) {
          if(clients[clientIndex].answers[i].question == this.gameRoundInfo.categories[categoryIndex]) {
            let answer = {
              answerString: clients[clientIndex].answers[i].answerString,
              authorUsername: clients[clientIndex].username
            }
            answersForAllCategories[categoryIndex].answers.push(answer);
          }
        }
      }
    }
    return answersForAllCategories;
  }
}
