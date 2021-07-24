console.log('Client code loaded')

const HOST = location.origin.replace(/^http/, 'ws')
let socket;

let mainContainer;
let containerLogin;
let containerBody;
let header;
let footer;

let username;
let joinData = {
  roomTextInput: undefined,
  usernameTextInput: undefined,
  confirmButton: undefined
}

let startButton, restartButton;

let activeUsernamesListContainer;

let gameRoundContainer;
let resultsContainer;
let randomLetterSlot;
let timerSlot;
let categoriesContainer;
let categoryAnswerSlotInSentence;
let categoryAnswerSlotInSentencePre;
let categoryAnswerSlotInSentencePos;
let categoryTextInput;
let confirmCategoryButton;
let currentCategoryIndex;
let categoriesList;
let waitingEndFeedbackMessage;

let timer;

let chat = {
  container: undefined,
  messageInput: undefined,
  sendButton: undefined,
  messagesContainer: undefined
};

let suggestions = {
  container: undefined,
  textInput: undefined,
  confirmButton: undefined,
  feedbackMessage: undefined
}

let warningContainer;
let warningMessageSlot;

function setup() {
  noCanvas();

  initializeHtmlElements();
  initializeRandomUsername();
  initializeRoom();

  currentCategoryIndex = 0;
  categoriesList = [];

  changeVisibility(mainContainer, true);
  changeScreenStateTo('START_SCREEN');
}

function initializeHtmlElements() {
  mainContainer = select('#main-container');
  containerLogin = select('#container-login');
  containerBody = select('#container-body');
  header = select('#header');
  footer = select('#footer');

  joinData.roomTextInput = select('#room-input').input(validateRoomOnInput);
  joinData.usernameTextInput = select('#username-input').input(validateUsernameOnInput);
  joinData.confirmButton = select('#join-button').mousePressed(requestToJoinRoom);
  handleEnterKey(joinData.roomTextInput, ()=>{
    joinData.usernameTextInput.elt.focus();
  });
  handleEnterKey(joinData.usernameTextInput, requestToJoinRoom);

  startButton = select('#start-button').mousePressed(startGame);
  restartButton = select('#restart-button').mousePressed(startGame);

  activeUsernamesListContainer = select('#usernames-list');

  gameRoundContainer = select('#game-round-container');
  resultsContainer = select('#results-container');
  randomLetterSlot = select('#random-letter');
  timerSlot = select('#timer');
  categoriesContainer = select('#categories-container');
  categoryAnswerSlotInSentence = select('#answer-slot-in-sentence');
  categoryAnswerSlotInSentencePre = select('#answer-slot-in-sentence-pre');
  categoryAnswerSlotInSentencePos = select('#answer-slot-in-sentence-pos');
  categoryTextInput = select('#category-input').input(updateAnswerOnInput);
  confirmCategoryButton = select('#confirm-category').mousePressed(confirmCategory);
  handleEnterKey(categoryTextInput, confirmCategory);
  waitingEndFeedbackMessage = select('#waiting-end');

  chat.container = select('#chat-container');
  chat.messageInput = select('#chat-message-input');
  chat.sendButton = select('#send-message-button').mousePressed(handleSendMessageButtonClicked);
  handleEnterKey(chat.messageInput, handleSendMessageButtonClicked);
  chat.messagesContainer = select('#messages-container');

  suggestions.container = select('#suggestions-container');
  suggestions.textInput = select('#suggestion-input');
  suggestions.confirmButton = select('#confirm-suggestion').mousePressed(sendSuggestion);
  handleEnterKey(suggestions.textInput, sendSuggestion);
  suggestions.feedbackMessage = select('#confirmed-suggestion');

  warningContainer = select('#warnings').addClass('hidden');
  warningMessageSlot = select('#warning-message');
}

function initializeRoom() {
  let initialRoomName;
  if(location.hash != '') {
    initialRoomName = location.hash.substring(1);
  } else {
    initialRoomName = 'room' + nf(floor(random(0,10000)),4,0);
  }
  joinData.roomTextInput.value(initialRoomName);
}

function validateRoomOnInput() {
  let filteredRoom = joinData.roomTextInput.value().replace(/[^a-zA-Z0-9_]/ig, '');
  joinData.roomTextInput.value(filteredRoom);
}

function initializeRandomUsername() {
  username = 'user' + nf(floor(random(0,1000000)),6,0);
  joinData.usernameTextInput.value(username);
}

function validateUsernameOnInput() {
  let filteredUsername = joinData.usernameTextInput.value().replace(/[^a-zÀ-ÿ0-9_. ]/ig, '');
  joinData.usernameTextInput.value(filteredUsername);
}

function requestToJoinRoom() {
  if(joinData.roomTextInput.value() == '') {
    return;
  }
  let roomName = joinData.roomTextInput.value().toLowerCase();
  if(joinData.usernameTextInput.value() == '') {
    return;
  }
  setupSocket();

}

function setupSocket() {
  socket = io.connect(HOST);
  console.log('Requesting connection to server...');
  socket.on('newSocketConnection', handleNewSocketConnection);
  socket.on('userJoinedGame', handleUserJoinedGame);
  socket.on('usernameConfirmed', handleUsernameConfirmed);
  socket.on('gameStarted', initializeGame);
  socket.on('activeUsersListUpdated', handleActiveUsersListUpdated);
  socket.on('tickSecond', handleTickSecond);
  socket.on('serverTimerExpired', handleGameRoundEnded);
  socket.on('chatMessageSent', handleChatMessageReceived);
  socket.on('disconnect', handleDisconnection);
}

function handleNewSocketConnection(data) {
  console.log('Connected to server');
  if(joinData.roomTextInput.value() == '') {
    return;
  }
  let roomName = joinData.roomTextInput.value().toLowerCase();
  if(joinData.usernameTextInput.value() == '') {
    return;
  }
  let joinRoomData = {
    room: roomName,
    username: joinData.usernameTextInput.value()
  }
  socket.emit('requestToJoinRoom', joinRoomData);
}

function handleUsernameConfirmed(data) {
  username = data;
  console.log('Username: ' + username);
}

function handleUserJoinedGame(data) {
  let gameState = data.gameState;
  if(gameState.state == 'waiting') {
    changeScreenStateTo('LOBBY');
  }
  if (gameState.state == 'playing') {
    initializeGame(gameState.roundInfo);
  }
  if (gameState.state == 'results') {
    changeScreenStateTo('RESULTS');
  }
  console.log('User joined room ' + data.room);
  history.pushState(null, null, '#'+data.room);
}

function handleActiveUsersListUpdated(data) {
  activeUsernamesListContainer.html('');
  for(let i = 0; i < data.length; i++) {
    createElement('li', data[i]).addClass('w3-padding-small').parent(activeUsernamesListContainer);
  }
}

function startGame() {
  socket.emit('requestNewGame');
}

function initializeTimer(initialTime) {
  timer = initialTime;
  //updateTimer();
}
function handleTickSecond(data) {
  timer = data.timeCurrentValue;
  timerSlot.html(timer);
}
/*
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
*/

function initializeGame(data) {
  randomLetterSlot.html(data.randomLetter);

  categoriesList = data.categories;
  updateCurrentCategoryDisplayed(0);

  // categoriesContainer.html('');
  // for(let i = 0; i < data.categories.length; i++) {
  //   createP(data.categories[i]).parent(categoriesContainer);
  //   createInput('').parent(categoriesContainer);
  // }

  initializeTimer(data.totalTime);

  changeScreenStateTo('GAME_PLAYING');
}

function updateCurrentCategoryDisplayed(index) {
  currentCategoryIndex = index;

  let sentenceSplited = String(categoriesList[currentCategoryIndex]).split('___');
  if(sentenceSplited.length == 1) {
    sentenceSplited[0] = sentenceSplited[0] + '<br/>';
    categoryAnswerSlotInSentencePre.html(sentenceSplited[0]);
    categoryAnswerSlotInSentencePos.html('');
  } else if (sentenceSplited.length > 1) {
    categoryAnswerSlotInSentencePre.html(sentenceSplited[0]);
    categoryAnswerSlotInSentencePos.html(sentenceSplited[1]);
  } else {
    //Error
    categoryAnswerSlotInSentencePre.html('');
    categoryAnswerSlotInSentencePos.html('');
  }
  categoryAnswerSlotInSentence.html('_____');
  categoryTextInput.value('');
}
function clearCurrentCategoryDisplayed() {
  currentCategoryIndex = 0;
  categoryAnswerSlotInSentencePre.html('');
  categoryAnswerSlotInSentencePos.html('');
  categoryAnswerSlotInSentence.html('');
}

function Answer(questionIndex, question, answerString) {
  this.questionIndex = questionIndex;
  this.question = question;
  this.answerString = answerString;
}

function updateAnswerOnInput() {
  let answer = categoryTextInput.value();

  if(answer == '') {
    categoryAnswerSlotInSentence.html('_____');
  } else {
    categoryAnswerSlotInSentence.html(categoryTextInput.value());
  }
}

function confirmCategory() {
  if(categoryTextInput.value() != '') {
    let answer = new Answer(currentCategoryIndex, categoriesList[currentCategoryIndex], categoryTextInput.value());
    socket.emit('sendAnswer', answer);
  } else {
    categoriesList.push(categoriesList[currentCategoryIndex]);
  }
  if(currentCategoryIndex+1 < categoriesList.length) {
    updateCurrentCategoryDisplayed(currentCategoryIndex+1);
  } else {
    //Finished
    clearCurrentCategoryDisplayed();
    categoryTextInput.value('');
    changeVisibility(categoriesContainer, false);
    changeVisibility(waitingEndFeedbackMessage, true);
  }
}

function handleGameRoundEnded(data) {
  presentAllAnswers(data);
  changeScreenStateTo('RESULTS');
}

function presentAllAnswers(data) {
  console.log(data);
  resultsContainer.html('');
  for(let tempCategoryIndex = 0; tempCategoryIndex < data.length; tempCategoryIndex++) {
    if(data[tempCategoryIndex].answers.length > 0) { //If received at least 1 answer
      //createP(data[tempCategoryIndex].category).addClass('result-category').parent(resultsContainer);
      for(let i = 0; i < data[tempCategoryIndex].answers.length; i++) {
        //createP(data[tempCategoryIndex].answers[i].answerString).addClass('result-answer').parent(resultsContainer);
        createFormatedAnswerInParent(data[tempCategoryIndex].category, data[tempCategoryIndex].answers[i].answerString, resultsContainer);
      }
      createElement('hr').parent(resultsContainer);
    }
  }
}

function createFormatedAnswerInParent(sentence, answer, targetParent) {
  let sentenceSplited = String(sentence).split('___');
  let pContainer = createP('').addClass('category').parent(targetParent);
  if(sentenceSplited.length == 1) {
    createSpan(sentenceSplited[0] + '<br/>').parent(pContainer);
    createSpan(answer).addClass('w3-black').addClass('category-answer').parent(pContainer);
  } else if (sentenceSplited.length > 1) {
    createSpan(sentenceSplited[0]).parent(pContainer);
    createSpan(answer).addClass('w3-black').addClass('category-answer').parent(pContainer);
    createSpan(sentenceSplited[1]).parent(pContainer);
  } else {
    //Error
  }
}

function handleSendMessageButtonClicked() {
  if(chat.messageInput.value() == '') {
    return;
  }
  let data = chat.messageInput.value();
  console.log("Sent:" + data);
  socket.emit('chatMessageSent', data);
  chat.messageInput.value('');
}

function handleChatMessageReceived(data) {
  console.log("Received:" + data);
  createP(data).parent(chat.messagesContainer);
  chat.messagesContainer.elt.scrollTo(0,9999999999);
}

function sendSuggestion() {
  if(suggestions.textInput.value() == '') {
    return;
  }
  let data = suggestions.textInput.value();
  console.log("Suggestion:" + data);
  socket.emit('suggestionSent', data);
  suggestions.textInput.value('');
  changeVisibility(suggestions.feedbackMessage, true);
  setTimeout(()=>{
    changeVisibility(suggestions.feedbackMessage, false);
  }, 1000);
}

function handleDisconnection(data) {
  displayWarning("Você foi desconectado: " + data);
  changeScreenStateTo('START_SCREEN');
}

function displayWarning(warningMessage) {
  warningMessageSlot.html(warningMessage);
  changeVisibility(warningContainer, true);
  setTimeout(function() {
    changeVisibility(warningContainer, false);
  }, 3000);
}

///////////////////////////
//Screen states
function getAllElements() {
  return [
    header,
    footer,
    containerLogin,
    containerBody,
    startButton,
    restartButton,
    gameRoundContainer,
    categoriesContainer,
    waitingEndFeedbackMessage,
    resultsContainer,
    chat.container,
    suggestions.container
  ];
}

function changeScreenStateTo(newState) {
  console.log('Screen changed to: ' + newState);

  if(newState == 'START_SCREEN') {
    joinData.usernameTextInput.value(username);
    activateOnlyActiveElements([header, footer, containerLogin]);
  }
  if(newState == 'LOBBY') {
    activateOnlyActiveElements([header, footer, containerBody, startButton, chat.container, suggestions.container]);
  }
  if(newState == 'GAME_PLAYING') {
    activateOnlyActiveElements([gameRoundContainer, categoriesContainer, containerBody]);
  }
  if(newState == 'RESULTS') {
    activateOnlyActiveElements([header, footer, containerBody, restartButton, resultsContainer, chat.container, suggestions.container]);
  }
}

function activateOnlyActiveElements(activeElements) {
  let allElements = getAllElements();
  for(let i = 0; i < allElements.length; i++) {
    let shouldBeVisible = activeElements.includes(allElements[i]);
    changeVisibility(allElements[i], shouldBeVisible);
  }
}

///////////////////////////
//Utils
function changeVisibility(element, visible) {
  let prevVisible = !element.hasClass('hidden');
  if(prevVisible == visible) {
    return;
  }

  if(visible) {
    element.removeClass('hidden');
    element.addClass('animate-show');
  } else {
    element.addClass('hidden');
    element.removeClass('animate-show');
  }
}

function handleEnterKey(textInput, f) {
  textInput.elt.addEventListener("keyup", function(event) {
    if (event.keyCode === 13) { // Number 13 is the "Enter" key on the keyboard
      event.preventDefault(); // Cancel the default action, if needed
      f();
    }
  });
}
