console.log('\n\n//////////////////////////////////////////')
console.log('Server running')
require('dotenv').config()

const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT);

app.use(express.static('public',{
  extensions:['json']
}));

let socket = require('socket.io');
let io = socket(server, {
  pingTimeout: 30*60*1000
});
io.sockets.on('connection', handleConnection);

const https = require('https');
const fs = require('fs');
const aws = require('aws-sdk');
aws.config.region = 'us-east-2';

let globalClients = [];
let rooms = {};

function handleConnection(socket) {
  console.log('New connection: ' + socket.id);
  io.to(socket.id).emit('newSocketConnection');

  globalClients.push(new Client(socket));

  socket.on('requestToJoinRoom', joinNewUserToRoom);
  socket.on('suggestionSent', addSuggestion);

  function joinNewUserToRoom(data) {
    if(!rooms[data.room]) {
      rooms[data.room] = new Room(data.room);
    }
    socket.join(data.room);
    rooms[data.room].handleRequestToJoinRoomByUsername(data.username, socket);

    socket.to(data.room).on('requestNewGame', ()=>{
      rooms[data.room].startNewGame();
    });
    socket.to(data.room).on('sendAnswer', (d)=>{
      rooms[data.room].handleAnswerSent(d, socket);
    });
    socket.to(data.room).on('chatMessageSent', (d)=>{
      rooms[data.room].handleChatMessage(d, socket);
    });
    socket.to(data.room).on('disconnect', (reason)=>{
      rooms[data.room].handleDisconnection(reason, socket);
    });

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
  this.answers = [];
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
  this.allQuestionsRandomized = getRandomizedQuestions();

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

    let alphabet = 'AAABBBCCCDDDEEEFFFGGGHIIIJJJKLLLMMMNNNOOOPPPQQRRRSSSTTTUUUVVWXYZ';
    let randomLetter = alphabet.charAt(Math.floor(Math.random()*alphabet.length));
    let totalTime = 100;
    let activeCategoriesThisRound = this.getCategoriesForThisRound(5);

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
      this.checkEarlyEnd();
    } else {
      console.log('Timer expired!');
      this.finishRound();
    }
  }

  this.checkEarlyEnd = function() {
    let haveEveryoneFinished = true;
    for(let i = 0; i < this.clients.length; i++) {
      if(this.clients[i].socket) {
        if(this.clients[i].answers.length < this.gameState.roundInfo.categories.length) {
          haveEveryoneFinished = false;
          return;
        }
      }
    }
    if(haveEveryoneFinished) {
      this.finishRound();
      return;
    }
  }

  this.finishRound = function() {
    clearTimeout(this.timerSetTimeoutFunction);
    this.gameState.state = 'results';
    io.to(this.room).emit('serverTimerExpired', this.getAnswersForAllCategories());
    console.log('Round finished!');
  }

  this.getCategoriesForThisRound = function(amount) {
    if(amount > this.allQuestionsRandomized.length) {
      this.allQuestionsRandomized = getRandomizedQuestions();
    }
    return this.allQuestionsRandomized.splice(0, amount);
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
            if(this.clients[clientIndex].answers[i].questionIndex == categoryIndex) {
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
    archiveAnswers(answersForAllCategories);
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
    io.to(this.room).emit('activeUsersListUpdated', this.getListOfActiveUsernames());
  }

  this.handleAnswerSent = function(data, socket) {
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

  this.handleChatMessage = function(data, socket) {
    let filteredMessage = data.replace(/\<.*?\>/, '');
    let message = this.getUser(socket.id).username + ': ' + '<strong>' + filteredMessage + '</strong>';
    io.to(this.room).emit('chatMessageSent', message);
    //io.sockets.emit('message', data);
    console.log('Chat message sent:', socket.id, message);
  }
}

let questions = [
  'Nome de idoso',
  'Lugar onde já chorei',
  'Novo sabor de miojo: ___!',
  'Um ótimo presente para o Dia dos Namorados',
  'Artista ruim',
  'Eu reprovei na prova de ___',
  '___: Nova série original GloboPlay',
  'Quando a pandemia abacar, eu vou ___ muito',
  'Esta é uma manifestação muito importante para conscientizar toda a sociedade sobre o problema com ___',
  'Essa cicatriz aqui na perna foi causada por ___',
  'Fátima, é um prazer estar aqui no seu programa para poder falar sobre ___',
  '___ foi proibido nas Olimpíadas por ser considerado muito perigoso',
  'Rolê bad vibe',
  'Fui cancelado por ___',

  //Cards Against Humanity
  //Cards Against Humanity is free to use under the Creative Commons BY-NC-SA 2.0 License. You can read more about the license at http://creativecommons.org/licenses/by-nc-sa/2.0/
  //This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 2.0 Generic License.
  'Por motivos de segurança, a ANAC proibiu ___ em todos os aviões',
  'Animou a torcida e comemorou o gol fazendo a dancinha do ___!',
  'Desculpa, professor, mas o ___ destruiu meu dever de casa',
  'E o prêmio de melhor ___ vai para...',
  'Cara, NÃO VAI no banheiro, tem ___ lá',
  'Como eu perdi minha virgindade?',
  'Lamentável que as crianças de hoje estão se envolvendo com ___ tão cedo',
  'Qual é meu poder secreto?',
  'Nenhum jantar romântico estaria completo sem ___',
  'A excursão escolar da terceira série foi completamente arruinada por ___',
  'Ministério da ___',
  'Não era amor, era ___',
  'A gente terminou porque ele era muito ___',
  'Passarinho! Que som é esse? Esse é o som de ___',
  'De acordo com os exames, você foi acometido por um caso típico de ___',
  'Nova animação da Pixar: e se ___ tivessem vida?',
  'Que cheiro é esse?',
  'Por que não consigo dormir a noite?',
  'O Campeonato Mundial de ___',
  'Quando eu foi milionário, vou mandar erguer uma estátua de 10 metros de altura para celebrar ___',
]

function getRandomizedQuestions() {
  return shuffle(questions);
}

function shuffle(array) {
  let arrayClone = array.slice();
  let randomizedArray = []
  while (arrayClone.length > 0) {
    let randomIndex = Math.floor(Math.random() * arrayClone.length);
    let randomElement = arrayClone.splice(randomIndex, 1);
    randomizedArray.push(randomElement);
  }
  return randomizedArray;
}

let isEdittingArchiveAnswersFile = false;
function archiveAnswers(newAnswers) {
  if(isEdittingArchiveAnswersFile) {
    //Is file is being written, try again 1s after and abort this function
    setTimeout(()=>{archiveAnswers(newAnswers)}, 100);
    return;
  }
  isEdittingArchiveAnswersFile = true;
  // fs.readFile("public/other/globalAnswersArchive.json", function(err, buf) {
  const file = fs.createWriteStream("public/other/globalAnswersArchive.json");
  https.get("https://cards-against-ruchiga.s3.us-east-2.amazonaws.com/globalAnswersArchive.json", response => {
    response.on('data', function(d) {
      let parsedData = JSON.parse(d.toString());
      for(let tempCategoryIndex = 0; tempCategoryIndex < newAnswers.length; tempCategoryIndex++) {
        for(let i = 0; i < newAnswers[tempCategoryIndex].answers.length; i++) {
          if(!parsedData[newAnswers[tempCategoryIndex].category]) {
            parsedData[newAnswers[tempCategoryIndex].category] = [];
          }
          parsedData[newAnswers[tempCategoryIndex].category].push(newAnswers[tempCategoryIndex].answers[i].answerString);
        }
      }
      let jsonData = JSON.stringify(parsedData);
      fs.writeFile("public/other/globalAnswersArchive.json", jsonData, (err) => {
        if (err) console.log(err);
        console.log("Answers archived in Heroku");
        uploadFile('public/other/globalAnswersArchive.json', 'globalAnswersArchive.json', function(data) {
          console.log("Answers archived in S3");
          isEdittingSuggestionFile = false;
        });
      });
    });
  });
};

let isEdittingSuggestionFile = false;
function addSuggestion(text) {
  if(isEdittingSuggestionFile) {
    //Is file is being written, try again 1s after and abort this function
    setTimeout(()=>{addSuggestion(text)}, 100);
    return;
  }
  isEdittingSuggestionFile = true;
  console.log('[Sugestão]' + text + '[Fim da Sugestão]')
  const file = fs.createWriteStream("public/other/sugestoes.txt");
  https.get("https://cards-against-ruchiga.s3.us-east-2.amazonaws.com/sugestoes.txt", response => {
    response.on('data', function(d) {
      let prevText;
      if(response.statusCode == 403) {
        prevText = '';
      } else {
        prevText = d.toString();
      }
      let newText = prevText + '\n' + text;
      fs.writeFile("public/other/sugestoes.txt", newText, (err) => {
        if (err) console.log(err);
        console.log("Suggestion saved in Heroku");
        uploadFile('public/other/sugestoes.txt', 'sugestoes.txt', function(data) {
          console.log("Suggestion saved in S3");
          isEdittingSuggestionFile = false;
        })
      })
    })
  })
};

function uploadFile(file, name, callback) {
  const fileStream = fs.createReadStream(file);
  const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  });
  const s3Params = {
    Bucket: 'cards-against-ruchiga', //process.env.S3_BUCKET_NAME,
    Key: name,
    Body: fileStream,
    Expires: 600,
    ACL: 'public-read'
  };
  s3.upload(s3Params, function(err, data) {
    if(err) {
      console.error(err);
      return;
    }
    console.log(data);
    callback(data);
  });
}
