console.log('Client code loaded')

const HOST = location.origin.replace(/^http/, 'ws')
let socket;

let containerLogin;
let containerBody;

let loginInstructions;
let username;
let usernameTextInput;
let usernameConfirmButton;

let messagesInstructions;
let editableText;
let button1;
let messagesContainer;

let startButton;
let activeUsernamesListContainer;

let gameRoundContainer;
let randomLetterSlot;
let timerSlot;
let categoriesContainer;

let timer;

function setup() {
  socket = io.connect(HOST);
  socket.on('newSocketConnection', handleNewSocketConnection);
  socket.on('userJoinedGame', handleUserJoinedGame);
  socket.on('activeUsersListUpdated', handleActiveUsersListUpdated);
  socket.on('gameStarted', handleNewGame);
  socket.on('serverTimerExpired', handleGameRoundEnded);
  socket.on('chatMessageSent', handleChatMessageReceived);
  socket.on('disconnect', handleDisconnection);


  noCanvas();

  containerLogin = createDiv().id('container-login');
  containerBody = createDiv().id('container-body');

  loginInstructions = createP('Escolha seu nome de usuário:').parent(containerLogin);
  username = 'user' + nf(floor(random(0,1000000)),6,0);
  usernameTextInput = createInput(username).parent(containerLogin);
  usernameConfirmButton = createButton('Entrar').mousePressed(requestToJoinGame).parent(containerLogin);
  handleEnterKey(usernameTextInput, requestToJoinGame);

  startButton = createButton('Começar!').mousePressed(startGame).parent(containerBody);

  activeUsernamesListContainer = createDiv('').id('usernames-list').class('container').parent(containerBody);

  gameRoundContainer = createDiv('').id('game-round-container').class('container').parent(containerBody);
  randomLetterSlot = createP('_').id('random-letter').parent(gameRoundContainer);
  timerSlot = createP('_').id('timer').parent(gameRoundContainer);
  categoriesContainer = createDiv('').id('categories-container').parent(gameRoundContainer);

  messagesInstructions = createP('<br><br><br><br><br><br>Chat:').parent(containerBody);
  editableText = createInput('').parent(containerBody);
  button1 = createButton('Enviar').mousePressed(handleButtonClicked).parent(containerBody);
  messagesContainer = createDiv('').id('messages-container').class('container').parent(containerBody);
  handleEnterKey(editableText, handleButtonClicked);

  changeScreenStateTo('START_SCREEN');
  usernameTextInput.elt.focus();
}

function handleNewSocketConnection(data) {
  changeScreenStateTo('START_SCREEN');
}

function handleButtonClicked() {
  if(editableText.value() == '') {
    return;
  }
  let data = editableText.value();
  console.log("Sent:" + data);
  socket.emit('chatMessageSent', data);
  editableText.value('');
}

function changeVisibility(element, visible) {
  if(visible) {
    element.removeClass('hidden');
  } else {
    element.addClass('hidden');
  }
}

function handleChatMessageReceived(data) {
  console.log("Received:" + data);
  createP(data).parent(messagesContainer);
  messagesContainer.elt.scrollTo(0,9999999999);
}

function requestToJoinGame() {
  if(usernameTextInput.value() == '') {
    return;
  }
  socket.emit('requestToJoinGame', usernameTextInput.value());
}

function handleUserJoinedGame() {
  changeScreenStateTo('LOBBY');
  editableText.elt.focus();
}

function handleEnterKey(textInput, f) {
  textInput.elt.addEventListener("keyup", function(event) {
    if (event.keyCode === 13) { // Number 13 is the "Enter" key on the keyboard
      event.preventDefault(); // Cancel the default action, if needed
      f();
    }
  });
}

function handleActiveUsersListUpdated(data) {
  activeUsernamesListContainer.html('');
  for(let i = 0; i < data.length; i++) {
    createP(data[i]).parent(activeUsernamesListContainer);
  }
}

function changeScreenStateTo(newState) {
  if(newState == 'START_SCREEN') {
    changeVisibility(containerLogin, true);
    changeVisibility(containerBody, false);
  }
  if(newState == 'LOBBY') {
    changeVisibility(startButton, true);
    changeVisibility(gameRoundContainer, false);
    changeVisibility(containerLogin, false);
    changeVisibility(containerBody, true);
  }
  if(newState == 'GAME_PLAYING') {
    changeVisibility(startButton, false);
    changeVisibility(gameRoundContainer, true);
    changeVisibility(containerLogin, false);
    changeVisibility(containerBody, true);
  }
}

function startGame() {
  socket.emit('requestNewGame');
}

function handleNewGame(data) {
  randomLetterSlot.html(data.randomLetter);

  categoriesContainer.html('');
  for(let i = 0; i < data.categories.length; i++) {
    createP(data.categories[i]).parent(categoriesContainer);
    createInput('').parent(categoriesContainer);
  }

  initializeTimer(data.totalTime);

  changeScreenStateTo('GAME_PLAYING');
}

function initializeTimer(initialTime) {
  timer = initialTime;
  updateTimer();
}
function updateTimer() {
  if(timer > 0) {
    timerSlot.html(timer);
    timer = timer - 1;
    setTimeout(updateTimer, 1000);
  } else {
    timerSlot.html('_');
    console.log('Timer expired!');
  }
}

function handleDisconnection(data) {
  window.alert("Você foi desconectado. \n" + data);
  changeScreenStateTo('START_SCREEN');
}

function handleGameRoundEnded(data) {
  window.alert("Acabou o tempo!");
}
