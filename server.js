console.log('\n\n//////////////////////////////////////////');
console.log('Server running');
require('dotenv').config();

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

const https = require('https');
const fs = require('fs');
const aws = require('aws-sdk');
aws.config.region = 'us-east-2';

let rooms = {};
let connectedUsersCounter = 0;

function handleConnection(socket) {
  console.log('New connection: ' + socket.id);
  io.to(socket.id).emit('newSocketConnection');
  connectedUsersCounter++;

  socket.on('requestToJoinRoom', handleRequestToJoinRoom);
  socket.on('suggestionSent', addSuggestion);

  function handleRequestToJoinRoom(receivedData) {
    let requestToJoinRoomData = receivedData;

    let roomName = filteredText(requestToJoinRoomData.roomName).toLowerCase().replace(/[^a-zA-Z0-9_]/ig, '');
    let username = filteredText(requestToJoinRoomData.username);

    if(!rooms[roomName]) {
      //If no room with this name, create new room
      rooms[roomName] = new Room(roomName);
    }
    socket.join(roomName);
    rooms[roomName].joinUserToRoom(username, socket);
  }
}

function User(socket, username) {
  this.username = username;
  this.socket = socket;
  this.answers = [];
  this.score = 0;
  this.isOwner = false;
}

function GameState() {
  this.state = 'waiting';
  this.roundInfo = undefined;
  this.results = undefined;
  this.gameOptions = {
    roundTotalTime: 100,
    totalRounds: 10,
    totalCategories: 5,
    maxAnswersPerCategory: 10,
  };
};

function Room(room) {
  this.roomName = room;
  this.users = [];
  this.active = true;
  this.gameState = new GameState();
  this.allQuestionsRandomized = getRandomizedQuestions();
  this.owner = undefined;

  this.joinUserToRoom = function(username, socket) {
    let user = this.addUserByUsername(username, socket);

    //Set owner
    if(this.owner == undefined) {
      this.owner = user;
      user.isOwner = true;
    }

    //Bind events
    socket.to(this.roomName).on('requestNewRound', ()=>{
      this.startNewRound();
    });
    socket.to(this.roomName).on('sendAnswer', (receivedData)=>{
      this.handleAnswerSent(receivedData, socket);
    });
    socket.to(this.roomName).on('sendVote', (receivedData)=>{
      this.handleNewVote(receivedData, socket);
    });
    socket.to(this.roomName).on('goToCategory', (receivedData)=>{
      this.goToCategory(receivedData);
    });
    socket.to(this.roomName).on('finishResults', ()=>{
      this.finishResults();
    });
    socket.to(this.roomName).on('requestToChangeGameOptions', (receivedData)=>{
      this.changeGameOptions(receivedData, socket);
    });
    socket.to(this.roomName).on('chatMessageSent', (receivedData)=>{
      this.handleChatMessage(receivedData, socket);
    });
    socket.to(this.roomName).on('disconnect', (reason)=>{
      this.handleDisconnection(reason, socket);
    });

    //Confirmed
    let joinedRoomData = {
      roomName: this.roomName,
      username: user.username,
      gameState: this.gameState,
      isOwner: user.isOwner
    }
    console.log('New user joined room ' + joinedRoomData.roomName + ': ' + joinedRoomData.username + ' ' + socket.id);
    io.to(socket.id).emit('joinedRoom', joinedRoomData);
    io.to(this.roomName).emit('activeUsersListUpdated', this.getListOfActiveUsernames());
  }

  this.addUserByUsername = function(username, socket) {
    //Try to find username already in list
    let user = this.findUserByUsername(username);
    //If username was found already in list...
    if(user) {
      if(user.socket == undefined) { //...If there is no socket, attribute this socket to the same user
        user.socket = socket;
        return user;
      } else {
        //Generate different username (user --> user2 --> user3) and create new user
        let differentUsernameGenerated = username;
        let counter = 2;
        while(this.findUserByUsername(differentUsernameGenerated + counter)) {
          counter++;
        }
        user = new User(socket, differentUsernameGenerated + counter);
      }
    } else {
      //If username is not in list, attribute username to this socket
      user = new User(socket, username);
    }
    this.users.push(user);
    return user;
  }

  this.findUserByUsername = function(username) {
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].username == username) {
        return this.users[i];
      }
    }
    return undefined;
  }

  this.startNewRound = function() {
    this.gameState.state = 'playing';
    this.gameState.results = undefined;
    this.gameState.roundsInfoHistory = [];
    this.serverTimer = -1;
    this.timerSetTimeoutFunction = undefined;
    for(let i = 0; i < this.users.length; i++) {
      this.users[i].answers = [];
    }
    this.haveEveryoneFinished = false;

    let alphabet = 'AAABBBCCCDDDEEEFFFGGGHIIIJJJKLLLMMMNNNOOOPPPQQRRRSSSTTTUUUVVWXYZ';
    let randomLetter = alphabet.charAt(Math.floor(Math.random()*alphabet.length));
    let activeCategoriesThisRound = this.getCategoriesForThisRound();
    let gettingReadyExtraTime = 5;
    let totalTime = this.gameState.gameOptions.roundTotalTime + gettingReadyExtraTime;

    this.gameState.roundInfo = {
      randomLetter: randomLetter,
      categories: activeCategoriesThisRound,
      maxAnswersPerCategory: this.gameState.gameOptions.maxAnswersPerCategory,
      numberOfCategoriesPerUser: this.gameState.gameOptions.totalCategories,
      totalTime: totalTime
    }
    io.to(this.roomName).emit('gameStarted', this.gameState.roundInfo);

    this.initializeTimer(totalTime);
  }

  this.changeGameOptions = function(newGameOptions, socket) {
    this.gameState.gameOptions = newGameOptions;
    socket.to(this.roomName).emit('gameOptionsChanged', this.gameState.gameOptions);
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
      io.to(this.roomName).emit('tickSecond', {timeCurrentValue: this.serverTimer});
      this.checkEarlyEnd();
    } else {
      //Timer expired
      this.finishRound();
    }
  }

  this.checkEarlyEnd = function() {
    if(this.haveEveryoneFinished) return;

    if(this.serverTimer <= 5) { //If its almost finishing, abort checking early end
      return;
    }

    let tempHaveEveryoneFinished = true;
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].socket) {
        if(this.users[i].answers.length < this.gameState.roundInfo.numberOfCategoriesPerUser) {
          tempHaveEveryoneFinished = false;
          return;
        }
      }
    }
    if(tempHaveEveryoneFinished) {
      this.haveEveryoneFinished = true;
      setTimeout(()=>{ //Wait 3 seconds before early finish
        this.finishRound();
      }, 3000);
      return;
    }
  }

  this.finishRound = function() {
    clearTimeout(this.timerSetTimeoutFunction);
    this.gameState.state = 'results';
    this.gameState.results = {
      allCategories: this.getAnswersForAllCategories(),
      currentCategoryIndex: 0
    };

    this.gameState.roundsInfoHistory.push(this.gameState.roundInfo);

    console.log(this.getAllAnswersForAllCategories());

    io.to(this.roomName).emit('roundFinished', this.gameState.results);
  }

  this.getCategoriesForThisRound = function() {
    let numberOfActiveUsers = this.getListOfActiveUsernames().length;
    // let minAmountOfCategories = this.gameState.gameOptions.totalCategories;
    // let maxAnswersPerCategory = this.gameState.gameOptions.maxAnswersPerCategory;

    // let amount = minAmountOfCategories;
    // if(numberOfActiveUsers > maxAnswersPerCategory) {
    //   amount = amount + (numberOfActiveUsers - maxAnswersPerCategory);
    // }

    let amount = this.gameState.gameOptions.totalCategories;

    if(amount > this.allQuestionsRandomized.length) {
      this.allQuestionsRandomized = getRandomizedQuestions();
    }
    let categoryStringsForThisRound = this.allQuestionsRandomized.splice(0, amount);
    let categoryObjectsForThisRound = [];
    for(let i = 0; i < categoryStringsForThisRound.length; i++) {
      categoryObjectsForThisRound.push({
        indexOnServer: i,
        categoryString: categoryStringsForThisRound[i], //TODO: I don't know why it's an array of length 1 here
        answers: {}
      });
    }
    return categoryObjectsForThisRound;
  }

  this.getAnswersForAllCategories = function() {
    /*
    //TODO: Refactor archiving
    // let answersForAllCategories = [];
    // for(let categoryIndex = 0; categoryIndex < this.gameState.roundInfo.categories.length; categoryIndex++) {
    //   let categoryAnswer = {
    //     category: this.gameState.roundInfo.categories[categoryIndex].categoryString,
    //     answers: []
    //   }
    //   answersForAllCategories.push(categoryAnswer);
    //   for(let clientIndex = 0; clientIndex < this.users.length; clientIndex++) {
    //     if(this.users[clientIndex].answers) {
    //       for(let i = 0; i < this.users[clientIndex].answers.length; i++) {
    //         if(this.users[clientIndex].answers[i].questionIndex == categoryIndex) {
    //           let answer = {
    //             answerString: this.users[clientIndex].answers[i].answerString,
    //             authorUsername: this.users[clientIndex].username
    //           }
    //           answersForAllCategories[categoryIndex].answers.push(answer);
    //         }
    //       }
    //     }
    //   }
    // }
    // archiveAnswers(answersForAllCategories);
    */

    return shuffle(this.gameState.roundInfo.categories);
  }

  this.goToCategory = function(receivedData) {
    io.to(this.roomName).emit('currentCategoryChanged', {
      index: receivedData.index
    });
  }

  this.finishResults = function() {
    io.to(this.roomName).emit('finishedResults');
  }

  this.handleNewVote = function(data) {
    let targetCategory = this.gameState.roundInfo.categories[data.categoryIndex];
    let targetAnswer = targetCategory.answers[data.votedUser];
    let answerAuthorKeys = Object.keys(targetCategory.answers)

    //If trying to vote in self, abort
    if(data.votedUser == data.votingUser) {
      return;
    }

    //If already voted in this category, abort
    for(let i = 0; i < answerAuthorKeys.length; i++) {
      if(targetCategory.answers[answerAuthorKeys[i]].votes.includes(data.votingUser)) {
        return;
      }
    }

    targetAnswer.votes.push(data.votingUser);
    io.to(this.roomName).emit('votesUpdated', this.gameState.results);

    let user = this.findUserByUsername(data.votedUser);
    if(user) {
      user.score++;
    }
    io.to(this.roomName).emit('activeUsersListUpdated', this.getListOfActiveUsernames());
  }

  this.getListOfActiveUsernames = function() {
    let activeUsernames = [];
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].socket) {
        let userPublicData = {
          username: this.users[i].username,
          score: this.users[i].score,
          isOwner: this.users[i].isOwner
        }
        activeUsernames.push(userPublicData);
      }
    }
    return activeUsernames;
  }

  this.findNewOwner = function() {
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].socket != undefined) {
        this.owner = this.users[i];
        this.users[i].isOwner = true;
        io.to(this.users[i].socket.id).emit('setAsOwner', {isOwner: true});
        io.to(this.roomName).emit('activeUsersListUpdated', this.getListOfActiveUsernames());
        return;
      }
    }
  }

  this.handleDisconnection = function(reason, socket) {
    connectedUsersCounter = Math.max((connectedUsersCounter - 1), 0);
    console.log('Disconnected from room ' + this.roomName + ': ' + socket.id + ' ('+reason+')');
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].socket != undefined) {
        if(this.users[i].socket.id == socket.id) {
          this.users[i].socket.disconnect();
          this.users[i].socket = undefined;
          if(this.users[i].isOwner) {
            this.users[i].isOwner = false;
            this.findNewOwner();
          }
          break;
        }
      }
    }

    let isRoomEmpty = true;
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].socket != undefined) {
        isRoomEmpty = false;
      }
    }
    if(isRoomEmpty) {
      this.active = false;
      cleanNonActiveRooms();
      return;
    }

    io.to(this.roomName).emit('activeUsersListUpdated', this.getListOfActiveUsernames());

  }

  this.handleAnswerSent = function(data, socket) {
    let user = this.getUser(socket.id);
    if(user) {
      if(user.answers) {
        user.answers.push(data);
      }
    }
    let answer = {
      answerString: filteredText(data.answerString),
      votes: []
    };
    this.gameState.roundInfo.categories[data.indexOnServer].answers[user.username] = answer;
  }

  this.getUser = function(socketId) {
    for(let i = 0; i < this.users.length; i++) {
      if(this.users[i].socket != undefined) {
        if(socketId == this.users[i].socket.id) {
          return this.users[i];
        }
      }
    }
    return undefined;
  }

  this.handleChatMessage = function(receivedData, socket) {
    let text = receivedData;
    let messageData = {
      username: this.getUser(socket.id).username,
      text: filteredText(text)
    };
    io.to(this.roomName).emit('chatMessageSent', messageData);
  }

  this.getAllAnswersForAllCategories = function() {
    let allAnswers = [];
    const roundsInfoHistory = this.gameState.roundsInfoHistory;
    for(let i = 0; i < roundsInfoHistory.length; i++) {
      for(let categoryIndex = 0; categoryIndex < roundsInfoHistory[i].categories.length; categoryIndex++) {
        const answers = roundsInfoHistory[i].categories[categoryIndex].answers;
        let answersKeys = Object.keys(answers);
        for(let answersKeysIndex = 0; answersKeysIndex < answersKeys.length; answersKeysIndex++) {
          const answer = answers[answersKeys[answersKeysIndex]].answerString;
          allAnswers.push(answer);
        }
      }
    }
    return allAnswers;
  }
}

let isEdittingArchiveAnswersFile = false;
function archiveAnswers(newAnswers) {
  console.log(newAnswers);
  return;
  if(isEdittingArchiveAnswersFile) {
    //Is file is being written, try again 1s after and abort this function
    setTimeout(()=>{archiveAnswers(newAnswers)}, 100);
    return;
  }
  isEdittingArchiveAnswersFile = true;
  // fs.readFile("public/other/globalAnswersArchive.json", function(err, buf) {
  //const file = fs.createWriteStream("public/other/globalAnswersArchive.json");
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
        if (err) return;
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
  let filteredSuggestion = filteredText(text);
  if(isEdittingSuggestionFile) {
    //Is file is being written, try again 1s after and abort this function
    setTimeout(()=>{addSuggestion(filteredSuggestion)}, 100);
    return;
  }
  isEdittingSuggestionFile = true;
  console.log('[Suggestion] ' + filteredSuggestion);
  const file = fs.createWriteStream("public/other/sugestoes.txt");
  https.get("https://cards-against-ruchiga.s3.us-east-2.amazonaws.com/sugestoes.txt", response => {
    response.on('data', function(d) {
      let prevText;
      if(response.statusCode == 403) {
        prevText = '';
      } else {
        prevText = d.toString();
      }
      let newText = prevText + '\n' + filteredSuggestion;
      fs.writeFile("public/other/sugestoes.txt", newText, (err) => {
        if (err) return;
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
  if(!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error('Could not access env variables')
    return;
  }
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
      //console.error(err);
      console.log('Error saving file to S3');
      return;
    }
    console.log(data);
    callback(data);
  });
}

function cleanNonActiveRooms() {
  setTimeout(()=> {
    let keys = Object.keys(rooms);
    for(let i = keys.length-1; i >= 0; i--) {
      if(!rooms[keys[i]].active) {
        delete rooms[keys[i]];
      }
    }
  }, 100);
}

function filteredText(text) {
  return String(text).replace(/\<.*?\>/, '');
}

let questions = [
  'Nome de idoso',
  'Nome de cachorro',
  'Lugar onde j?? chorei',
  'Novo sabor de miojo: ___!',
  'Um ??timo presente para o Dia dos Namorados',
  'Artista ruim',
  'Eu reprovei na prova de ___',
  '___: Nova s??rie original GloboPlay',
  'Esta ?? uma manifesta????o muito importante para conscientizar toda a sociedade sobre o problema com ___',
  'Essa cicatriz aqui na perna foi causada por ___',
  'F??tima, ?? um prazer estar aqui no seu programa para poder falar sobre ___',
  '___ foi proibido nas Olimp??adas por ser considerado muito perigoso',
  'Rol?? bad vibe',
  // 'Fui cancelado por ___',
  'Urgente: Pol??cia Federal deflagra nova fase da Opera????o ___',
  '___ deveria ser ilegal',
  'Fui no cinema pra ver ___',
  'Corno(a) famoso(a)',
  'Novo curso do Senac: ___ e Automa????o',
  'Mam??e est?? h?? horas tentando falar com o suporte t??cnico da ___',
  'Oferecimento: ___',
  'Artista do SBT',
  'Minha pr??xima viagem vai ser para ___',
  'Se ___, n??o dirija',
  'Tua piscina est?? cheia de ___',
  'Seria inapropriado ___ na sala de espera do dentista',
  'O ingrediente secreto da minha torta ?? ___',
  'A mestre confeiteira da f??brica garantiu ser normal todas as barras de chocolate terem pelo menos 4% de ___',
  'Saiba mais sobre ___, a profiss??o do futuro',
  'Voc?? nunca deve misturar ___ com bebida',
  'Por favor, n??o coloque ___ no micro-ondas',
  'Personagem que seria um bom presidente',


  //Cards Against Humanity
  //Cards Against Humanity is free to use under the Creative Commons BY-NC-SA 2.0 License. You can read more about the license at http://creativecommons.org/licenses/by-nc-sa/2.0/
  //This work is licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 2.0 Generic License.
  'Por motivos de seguran??a, a ANAC proibiu ___ em todos os avi??es',
  'Animou a torcida e comemorou o gol fazendo a dancinha do ___!',
  'Desculpa, professor, mas o ___ destruiu meu dever de casa',
  'E o pr??mio de melhor ___ vai para...',
  'Cara, N??O VAI no banheiro, tem ___ l??',
  'Lament??vel que as crian??as de hoje est??o se envolvendo com ___ t??o cedo',
  'Qual ?? meu poder secreto?',
  'Nenhum jantar rom??ntico estaria completo sem ___',
  'A excurs??o escolar da terceira s??rie foi completamente arruinada por ___',
  'Minist??rio da ___',
  'N??o era amor, era ___',
  'A gente terminou porque ele era muito ___',
  'Passarinho! Que som ?? esse? Esse ?? o som de ___',
  'De acordo com os exames, voc?? foi acometido por um caso t??pico de ___',
  'Nova anima????o da Pixar: e se ___ tivessem vida?',
  'Que cheiro ?? esse?',
  'Por que n??o consigo dormir a noite?',
  'O Campeonato Mundial de ___',
  'Quando eu for milion??rio, vou mandar erguer uma est??tua de 10 metros de altura para celebrar ___',
  '___: O Musical',
  'N??o sei com que armas ser?? lutada a 3?? Guerra Mundial, mas a 4?? Guerra Mundial ser?? com ___',
  // 'Como eu perdi minha virgindade?',

  //https://www.trueachievements.com/a208499/quiplash-xl-back-talk-achievement
  'O segredo para uma vida feliz:',
  'Eu aprendi que jamais se deve colocar ___ na pizza',








  //Sugest??es
  // 'Tu ficou sabendo? Do cachorro que tentou ___ e conseguiu!',
  // '___ se tu ?? bem macho!',
  // 'Voc?? deveria ter ___',
  'Eu gosto tanto do jeito que voc?? ___...',
  // 'Descobriram um novo g??nero humano, o Homo ___.',
  'Mois??s desceu do morro antes que Deus pudesse ditar o 11?? mandamento: N??o ___.',
  'Nove em cada dez m??dicos recomenda ___.',
  // 'Maur??cio tomando vodka com ___',
  '___ ?? infal??vel para animar uma festa',
  // 'Se n??o fosse o Bolsonaro, eu estaria ___.',
  // 'Tenho uma fofoca boa: aquele meu colega ___',
  // 'No primeiro almo??o com minha fam??lia, meu/minha namorado(a) estava vestindo ___.',
  // 'Encontrei ___ no meu umbigo.',
  // 'Caiu minha m??scara no(a) ___ e agora vou ter que ir l?? pegar.',
  'Eu j?? tentei ___, mas n??o recomendo.',
  'A NASA descobriu ___ nas luas de Saturno.',
  // 'Descobriram que hidroxicloroquina cura ___.',
  // 'Tu viu? O Bolsonaro disse vai ___ amanh??.',
  // 'O presidente do STF decidiu que ___.',
  'Minha m??e faz um ___ delicioso!',
  // 'Gostei de um v??deo de Manual do Mundo: VOC?? N??O ACREDITA COMO ?? UM ___ POR DENTRO!',













  // '___. Foi o que ela disse.',
  // 'Depois de 8 horas seguidas em live, s?? restava ___.',
  // 'Chegou a #GankDo___ pog pog pog',
  // 'Depois de tantas horas, tudo o que eu quero ?? ___',
  // '___ ?? melhor do que caf?? para se manter acordado.',
  // 'S?? ___ consegue dar mais mancada que essa pessoa',
  // 'Quando terminar a live eu mando a raid para ___, prometo!',
  // '___ acabou de entrar ao vivo.',
  // '___ foi banido do chat por 4800 segundos',
  // 'Foi expulso por ___',






]















let questionsSuggested = [
  //Sugest??es
  'Tu ficou sabendo? Do cachorro que tentou ___ e conseguiu!',
  '___ se tu ?? bem macho!',
  'Voc?? deveria ter ___',
  'Eu gosto tanto do jeito que voc?? ___...',
  'Descobriram um novo g??nero humano, o Homo ___.',
  'Mois??s desceu do morro antes que Deus pudesse ditar o 11?? mandamento: N??o ___.',
  'Nove em cada dez m??dicos recomenda ___.',
  'Maur??cio tomando vodka com ___',
  '___ ?? infal??vel para animar uma festa',
  'Se n??o fosse o Bolsonaro, eu estaria ___.',
  'Tenho uma fofoca boa: aquele meu colega ___',
  'No primeiro almo??o com minha fam??lia, meu/minha namorado(a) estava vestindo ___.',
  'Encontrei ___ no meu umbigo.',
  'Caiu minha m??scara no(a) ___ e agora vou ter que ir l?? pegar.',
  'Eu j?? tentei ___, mas n??o recomendo.',
  'A NASA descobriu ___ nas luas de Saturno.',
  'Descobriram que hidroxicloroquina cura ___.',
  'No almo??o com minha fam??lia, meu/minha namorado(a) estava vestindo __.',
  'Tu viu? O Bolsonaro disse vai ___ amanh??.',
  'O presidente do STF decidiu que ___.',
  'Minha m??e faz um(a) ___ delicioso(a)!',
]


function getRandomizedQuestions() {
  let defaultQuestionsRandomized = shuffle(questions);
  // let suggestedQuestionsRandomized = shuffle(questionsSuggested);
  // let resultQuestions = defaultQuestionsRandomized; //suggestedQuestionsRandomized.concat(defaultQuestionsRandomized);

  return defaultQuestionsRandomized;
}

function shuffle(array) {
  let arrayClone = array.slice();
  let randomizedArray = []
  while (arrayClone.length > 0) {
    let randomIndex = Math.floor(Math.random() * arrayClone.length);
    let randomElement = arrayClone.splice(randomIndex, 1)[0];
    randomizedArray.push(randomElement);
  }
  return randomizedArray;
}
