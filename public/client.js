console.log('Client code loaded')

const HOST = location.origin.replace(/^http/, 'ws')
let socket;

let containerLogin;
let containerBody;

let username;
let usernameSelection = {
  textInput: undefined,
  confirmButton: undefined
};

let startButton;

let activeUsernamesListContainer;

let gameRoundContainer;
let randomLetterSlot;
let timerSlot;
let categoriesContainer;
let currentCategory;
let categoryTextInput;
let confirmCategoryButton;
let currentCategoryIndex;
let categoriesList;

let timer;

let chat = {
  container: undefined,
  messageInput: undefined,
  sendButton: undefined,
  messagesContainer: undefined
};

function setup() {
  socket = io.connect(HOST);
  socket.on('newSocketConnection', handleNewSocketConnection);
  socket.on('userJoinedGame', handleUserJoinedGame);
  socket.on('usernameChanged', handleUsernameChanged);
  socket.on('activeUsersListUpdated', handleActiveUsersListUpdated);
  socket.on('gameStarted', handleNewGame);
  socket.on('serverTimerExpired', handleGameRoundEnded);
  socket.on('presentAllAnswers', presentAllAnswers);
  socket.on('chatMessageSent', handleChatMessageReceived);
  socket.on('disconnect', handleDisconnection);

  noCanvas();

  containerLogin = select('#container-login');
  containerBody = select('#container-body');

  username = 'user' + nf(floor(random(0,1000000)),6,0);
  usernameSelection.textInput = select('#username-input').value(username).input(validateUsername);
  usernameConfirmButton = select('#join-button').mousePressed(requestToJoinGame);
  handleEnterKey(usernameSelection.textInput, requestToJoinGame);

  startButton = select('#start-button').mousePressed(startGame);

  activeUsernamesListContainer = select('#usernames-list');

  gameRoundContainer = select('#game-round-container');
  randomLetterSlot = select('#random-letter');
  timerSlot = select('#timer');
  categoriesContainer = select('#categories-container');
  currentCategory = select('#current-category');
  categoryTextInput = select('#category-input');
  confirmCategoryButton = select('#confirm-category').mousePressed(confirmCategory);
  handleEnterKey(categoryTextInput, confirmCategory);
  currentCategoryIndex = 0;
  categoriesList = [];

  chat.container = select('#chat-container');
  chat.messageInput = select('#chat-message-input');
  chat.sendButton = select('#send-message-button').mousePressed(handleButtonClicked);
  chat.messagesContainer = select('#messages-container');
  handleEnterKey(chat.messageInput, handleButtonClicked);

  changeScreenStateTo('START_SCREEN');
}

function handleNewSocketConnection(data) {
  changeScreenStateTo('START_SCREEN');
}

function handleButtonClicked() {
  if(chat.messageInput.value() == '') {
    return;
  }
  let data = chat.messageInput.value();
  console.log("Sent:" + data);
  socket.emit('chatMessageSent', data);
  chat.messageInput.value('');
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
  createP(data).parent(chat.messagesContainer);
  chat.messagesContainer.elt.scrollTo(0,9999999999);
}

function requestToJoinGame() {
  if(usernameSelection.textInput.value() == '') {
    return;
  }
  socket.emit('requestToJoinGame', usernameSelection.textInput.value());
}

function handleUsernameChanged(data) {
  username = data;
}

function validateUsername() {
  console.log(usernameSelection.textInput.value());
  let filteredUsername = usernameSelection.textInput.value().replace(/[^a-zÀ-ÿ0-9_. ]/ig, '');
  usernameSelection.textInput.value(filteredUsername);
}

function handleUserJoinedGame() {
  changeScreenStateTo('LOBBY');
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
    usernameSelection.textInput.value(username);
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

  categoriesList = data.categories;
  currentCategoryIndex = 0;
  currentCategory.html(categoriesList[currentCategoryIndex]);
  categoryTextInput.value('');
  // categoriesContainer.html('');
  // for(let i = 0; i < data.categories.length; i++) {
  //   createP(data.categories[i]).parent(categoriesContainer);
  //   createInput('').parent(categoriesContainer);
  // }

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

function confirmCategory() {
  let answer = createAnswer(currentCategoryIndex, categoriesList[currentCategoryIndex], categoryTextInput.value());
  socket.emit('sendAnswer', answer);
  if(currentCategoryIndex + 1 < categoriesList.length) {
    currentCategoryIndex++;
    currentCategory.html(categoriesList[currentCategoryIndex]);
    categoryTextInput.value('');
  } else {
    //Finished
    currentCategory.html('');
    categoryTextInput.value('');
    window.alert("Respostas enviadas!");
  }
}

function createAnswer(questionIndex, question, answerString) {
  let answer = {
    questionIndex: questionIndex,
    question: question,
    answerString: answerString
  }
  return answer;
}

function handleDisconnection(data) {
  window.alert("Você foi desconectado. \n" + data);
  changeScreenStateTo('START_SCREEN');
}

function handleGameRoundEnded(data) {
  window.alert("Acabou o tempo!");
}

function presentAllAnswers(data) {
  console.log(data);
}
