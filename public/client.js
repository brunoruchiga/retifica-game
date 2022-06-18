console.log('Client code loaded')

const HOST = location.origin.replace(/^http/, 'ws')
let socket;

let mainContainer;
let containerStart;
let containerLogin;
let containerBody;
let header;
let headerTagline;
let footer;

let username;
let roomName;
let joinData = {
  roomTextInput: undefined,
  usernameTextInput: undefined,
  confirmButton: undefined
}
let roomNameDisplay;
let createRoomButton, joinFriendRoomButton;

let startButtonContainer, restartButtonContainer;
let startButton, restartButton;
let waitingOwnerStart, waitingOwnerRestart;
let resultsOwnerControls, previousCategory, nextCategory, lastCategory;

let activeUsernamesContainer;
let activeUsernamesListContainer;

let gameRoundContainer;
let instructionPreRoundContainer;
let startingRoundContainer;
let resultsContainer;
let resultsSentenceContainer;
let resultsProgress;
let randomLetterSlot;
let randomLetterSlotBig;
// let randomLetterSlotInStartingRound;
let timerSlot;
let categoriesContainer;
let currentCategoryContainer;
let categoryAnswerSlotInSentence;
let categoryAnswerSlotInSentencePre;
let categoryAnswerSlotInSentencePos;
let categoryTextInput;
let confirmCategoryButton;
let currentCategoryIndex;
let categoriesList;
let waitingEndFeedbackMessage;

let gameOptions = {};

let userIndex = 0;

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

let isRoomOwner = false;
let currentResultsCategoryIndex = 0;
let resultsCategoriesLength = 0;

let gameStateCopy = {};

function setup() {
  noCanvas();

  initializeHtmlElements();
  initializeRandomUsername();
  initializeRoomName();

  currentCategoryIndex = 0;
  categoriesList = [];

  changeVisibility(mainContainer, true);
}

function initializeHtmlElements() {
  mainContainer = select('#main-container');
  containerStart = select('#container-start')
  containerLogin = select('#container-login');
  containerBody = select('#container-body');
  headerTagline = select('#tagline');
  header = select('#header');
  footer = select('#footer');

  joinData.roomTextInput = select('#room-input').input(validateRoomOnInput);
  joinData.usernameTextInput = select('#username-input').input(validateUsernameOnInput);
  joinData.confirmButton = select('#join-button').elt.addEventListener('click', requestToJoinRoom);
  handleEnterKey(joinData.roomTextInput, ()=>{
    joinData.usernameTextInput.elt.focus();
  });
  handleEnterKey(joinData.usernameTextInput, requestToJoinRoom);
  roomNameDisplay = select('#room-name');

  createRoomButton = select('#create-room-button').elt.addEventListener('click', goToCreateRoomScreen); //mousePressed(goToCreateRoomScreen);
  joinFriendRoomButton = select('#join-friend-room-button').elt.addEventListener('click', goToJoinRoomScreen);

  startButtonContainer = select('#start-button-container');
  restartButtonContainer = select('#restart-button-container');
  startButton = select('#start-button');
  startButton.elt.addEventListener('click', requestToStartRound);
  waitingOwnerStart = select('#waiting-owner-start');
  restartButton = select('#restart-button');
  restartButton.elt.addEventListener('click', requestToStartRound);
  waitingOwnerRestart = select('#waiting-owner-restart');

  resultsOwnerControls = select('#results-owner-controls');
  previousCategory = select('#previous-category-button');
  previousCategory.elt.addEventListener('click', goToPreviousCategory);
  nextCategory = select('#next-category-button');
  nextCategory.elt.addEventListener('click', goToNextCategory);
  lastCategory = select('#last-category-button');
  lastCategory.elt.addEventListener('click', finishRound);

  activeUsernamesContainer = select('#usernames-list-container');
  activeUsernamesListContainer = select('#usernames-list');

  gameRoundContainer = select('#game-round-container');
  instructionPreRoundContainer = select('#instructions-pre-round');
  startingRoundContainer = select('#starting-round');
  resultsContainer = select('#results-container');
  resultsSentenceContainer = select('#results-sentence-container');
  resultsProgress = select('#results-progress');
  randomLetterSlot = select('#random-letter');
  randomLetterSlotBig = select('#letter-big');
  // randomLetterSlotInStartingRound = select('#letter-in-instructions');
  timerSlot = select('#timer');
  categoriesContainer = select('#categories-container');
  currentCategoryContainer = select('#current-category');
  categoryAnswerSlotInSentence = select('#answer-slot-in-sentence');
  categoryAnswerSlotInSentencePre = select('#answer-slot-in-sentence-pre');
  categoryAnswerSlotInSentencePos = select('#answer-slot-in-sentence-pos');
  categoryTextInput = select('#category-input').input(updateAnswerOnInput);
  confirmCategoryButton = select('#confirm-category');
  confirmCategoryButton.elt.addEventListener('click', confirmCategory);
  handleEnterKey(categoryTextInput, confirmCategory);
  waitingEndFeedbackMessage = select('#waiting-end');

  gameOptions.container = select('#game-options-container');
  gameOptions.roundTotalTime = new CustomSlider(30, 300, 100, 10, ' segundos', 'Duração da rodada', gameOptions.container, handleRoundTotalTimeChanged);
  function handleRoundTotalTimeChanged(value) {
    gameStateCopy.gameOptions.roundTotalTime = value;
    requestToUpdateGameOptions(gameStateCopy.gameOptions);
  }
  gameOptions.totalCategories = new CustomSlider(1, 10, 5, 1, '', 'Quantidade de frases', gameOptions.container, handleTotalCategoriesChanged);
  function handleTotalCategoriesChanged(value) {
    gameStateCopy.gameOptions.totalCategories = value;
    requestToUpdateGameOptions(gameStateCopy.gameOptions);
  }
  gameOptions.maxAnswersPerCategory = new CustomSlider(2, 20, 10, 1, '', 'Limite de respostas por frase', gameOptions.container, handleMaxAnswersPerCategoryChanged);
  function handleMaxAnswersPerCategoryChanged(value) {
    gameStateCopy.gameOptions.maxAnswersPerCategory = value;
    requestToUpdateGameOptions(gameStateCopy.gameOptions);
  }
  changeVisibility(gameOptions.maxAnswersPerCategory.container, false); //Hide option because its confuse

  chat.container = select('#chat-container');
  chat.messageInput = select('#chat-message-input');
  chat.sendButton = select('#send-message-button').elt.addEventListener('click', handleSendMessageButtonClicked);
  handleEnterKey(chat.messageInput, handleSendMessageButtonClicked);
  chat.messagesContainer = select('#messages-container');

  suggestions.container = select('#suggestions-container');
  suggestions.textInput = select('#suggestion-input');
  suggestions.confirmButton = select('#confirm-suggestion').elt.addEventListener('click', sendSuggestion);
  handleEnterKey(suggestions.textInput, sendSuggestion);
  suggestions.feedbackMessage = select('#confirmed-suggestion');

  warningContainer = select('#warnings').addClass('hidden');
  warningMessageSlot = select('#warning-message');
}

function CustomSlider(min, max, defaultValue, step, unit, label, targetParent, callbackOnChanged) {
  this.container = createDiv('').parent(targetParent);
  this.label = createSpan(label + ': ').parent(this.container);
  this.valueDisplay = createSpan('...').parent(this.container);
  this.unit = unit;
  this.setValueDisplayed = function(value) {
    this.valueDisplay.html('['+value+this.unit+']');
  }
  this.setValueDisplayed(defaultValue);
  this.slider = createSlider(min, max, defaultValue, step).addClass('slider').parent(this.container);
  this.callbackOnChanged = callbackOnChanged;
  this.slider.input(()=> {
    this.setValueDisplayed(this.value());
    this.callbackOnChanged(this.value());
  });
  this.value = function() {
    return this.slider.value();
  }
  this.setValue = function(value) {
    this.slider.value(value);
    this.setValueDisplayed(value);
  }
}

function requestToUpdateGameOptions(gameOptions) {
  if(socket) {
    socket.emit('requestToChangeGameOptions', gameOptions);
  }
}

function goToCreateRoomScreen() {
  changeScreenStateTo('JOIN_ROOM_SCREEN');
  setTimeout(()=> {
    joinData.roomTextInput.elt.focus();
  }, 1);
}

function goToJoinRoomScreen() {
  changeScreenStateTo('JOIN_ROOM_SCREEN');
  joinData.roomTextInput.value('');
  setTimeout(()=> {
    joinData.roomTextInput.elt.focus();
  }, 1);
}

function initializeRoomName() {
  if(location.hash != '') {
    updateRoomNameFromURLHash();
    changeScreenStateTo('JOIN_ROOM_SCREEN');
    joinData.usernameTextInput.elt.focus();
  } else {
    let randomRoomName = 'room' + nf(floor(random(0,10000)),4,0);
    joinData.roomTextInput.value(randomRoomName);
    changeScreenStateTo('START_SCREEN');
    joinData.roomTextInput.elt.focus();
  }
}

function updateRoomNameFromURLHash() {
  let initialRoomName = location.hash.substring(1);
  joinData.roomTextInput.value(initialRoomName);
}
window.onhashchange = updateRoomNameFromURLHash;

function validateRoomOnInput() {
  let filteredRoom = joinData.roomTextInput.value().replace(/[^a-zA-Z0-9_]/ig, '');
  joinData.roomTextInput.value(filteredRoom);
}

function initializeRandomUsername() {
  username = 'usuario' + nf(floor(random(0,1000000)),6,0);
  joinData.usernameTextInput.value(username);
}

function validateUsernameOnInput() {
  let filteredUsername = joinData.usernameTextInput.value().replace(/[^a-zÀ-ÿ0-9_. ]/ig, '');
  joinData.usernameTextInput.value(filteredUsername);
}

function requestToJoinRoom() {
  if(joinData.roomTextInput.value() == '') { return; }
  roomName = joinData.roomTextInput.value().toLowerCase();
  if(joinData.usernameTextInput.value() == '') { return; }
  username = joinData.usernameTextInput.value();
  changeScreenStateTo('LOADING');
  setupSocket();
}

function setupSocket() {
  socket = io.connect(HOST);
  console.log('Requesting connection to server...');
  socket.on('newSocketConnection', handleNewSocketConnection);
  socket.on('joinedRoom', handleJoinedRoom);
  socket.on('setAsOwner', handleSetAsOwner);
  socket.on('gameStarted', handleGameStarted);
  socket.on('currentCategoryChanged', handleCurrentCategoryChanged);
  socket.on('votesUpdated', handleVotesUpdated);
  socket.on('finishedResults', handleFinishedResults);
  socket.on('activeUsersListUpdated', handleActiveUsersListUpdated);
  socket.on('tickSecond', handleTickSecond);
  socket.on('roundFinished', handleRoundFinished);
  socket.on('gameOptionsChanged', handleGameOptionsChanged);
  socket.on('chatMessageSent', handleChatMessageReceived);
  socket.on('disconnect', handleDisconnection);
}

function handleNewSocketConnection(data) {
  console.log('Connected to server');
  console.log('Requesting to join room ' + roomName + ' as ' + username + '...');
  let requestToJoinRoomData = {
    roomName: roomName,
    username: username
  }
  socket.emit('requestToJoinRoom', requestToJoinRoomData);
}

function handleJoinedRoom(receivedData) {
  let joinedRoomData = receivedData;

  setMeAsRoomOwner(joinedRoomData.isOwner);

  gameStateCopy = joinedRoomData.gameState;
  if(gameStateCopy.state == 'waiting') {
    changeScreenStateTo('LOBBY');
  }
  if (gameStateCopy.state == 'playing') {
    handleGameStarted(gameStateCopy.roundInfo);
  }
  if (gameStateCopy.state == 'results') {
    changeScreenStateTo('RESULTS');
  }

  let roomNameFiltered = filteredText(joinedRoomData.roomName);
  roomNameDisplay.html(roomNameFiltered);
  history.pushState(null, null, '#'+roomNameFiltered);
  console.log('Joined room ' + roomNameFiltered + ' as ' + joinedRoomData.username);
}

function handleSetAsOwner(receivedData) {
  setMeAsRoomOwner(receivedData.isOwner);
}

function setMeAsRoomOwner(isOwner) {
  isRoomOwner = isOwner;

  changeVisibility(startButton, isRoomOwner);
  changeVisibility(waitingOwnerStart, !isRoomOwner);
  changeVisibility(restartButton, isRoomOwner);
  changeVisibility(waitingOwnerRestart, !isRoomOwner);

  changeVisibility(resultsOwnerControls, isRoomOwner);

  changeVisibility(gameOptions.roundTotalTime.slider, isRoomOwner);
  changeVisibility(gameOptions.totalCategories.slider, isRoomOwner);
  changeVisibility(gameOptions.maxAnswersPerCategory.slider, isRoomOwner);
}

function handleGameOptionsChanged(receivedData) {
  gameStateCopy.gameOptions = receivedData;
  gameOptions.roundTotalTime.setValue(gameStateCopy.gameOptions.roundTotalTime);
  gameOptions.totalCategories.setValue(gameStateCopy.gameOptions.totalCategories);
  gameOptions.maxAnswersPerCategory.setValue(gameStateCopy.gameOptions.maxAnswersPerCategory);
}

function handleActiveUsersListUpdated(data) {
  activeUsernamesListContainer.html('');

  //Find the index of my own username on the list
  userIndex = 0;
  for(let i = 0; i < data.length; i++) {
    if(data[i].username.toString() == username.toString()) {
      userIndex = i;
    }
  }

  //Sort list by user score
  let sortedUserList = data.sort(function(a, b) {
    return b.score - a.score;
  });

  for(let i = 0; i < sortedUserList.length; i++) {
    let text = sortedUserList[i].username;

    //Score
    if(sortedUserList[i].score > 0) {
      text = text + ' ✔'+sortedUserList[i].score;
    }

    //Owner badge
    if(sortedUserList[i].isOwner) {
      text = text + ' ♦';
    }

    createElement('li', text).addClass('w3-padding-small').parent(activeUsernamesListContainer);
  }
}

function requestToStartRound() {
  socket.emit('requestNewRound');
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

function handleGameStarted(receivedData) {
  let roundInfo = receivedData;
  updateCurrentLetter(roundInfo.randomLetter);

  categoriesList = [];
  let iteratorOffset = userIndex;
  // let numberOfCategories = roundInfo.maxAnswersPerCategory;
  let numberOfCategories = roundInfo.numberOfCategoriesPerUser;
  for(let i = 0; i < numberOfCategories; i++) {
    let iteratorIndex = (i + iteratorOffset) % roundInfo.categories.length;
    categoriesList.push({
      indexOnServer: roundInfo.categories[iteratorIndex].indexOnServer,
      categoryString: roundInfo.categories[iteratorIndex].categoryString,
      confirmed: false
    });
  }
  updateCurrentCategoryDisplayed(0);

  initializeTimer(roundInfo.totalTime);

  changeScreenStateTo('STARTING_GAME');
  setTimeout(()=>{
    changeScreenStateTo('GAME_PLAYING');
  }, 5000);
}

function playSelectingRandomLetterAnimation(targetLetter) {
  let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let targetLetterIndex = alphabet.indexOf(targetLetter);
  if(targetLetterIndex < 0) {
    //Error
    return;
  }
  let currentIndex = ((targetLetterIndex - 10) + alphabet.length) % alphabet.length;
  randomLetterSlotBig.html(alphabet[currentIndex]);
  let animationInterval = setInterval(()=>{
    currentIndex = (currentIndex + 1) % alphabet.length;
    randomLetterSlotBig.html(alphabet[currentIndex]);
    if(currentIndex == targetLetterIndex) {
      clearInterval(animationInterval);
    }
  }, 100);
}

function updateCurrentLetter(letter) {
  randomLetterSlot.html(letter);
  // randomLetterSlotInStartingRound.html(letter);
  playSelectingRandomLetterAnimation(letter);
}

function updateCurrentCategoryDisplayed(index) {
  currentCategoryIndex = index;

  let sentenceSplited = String(categoriesList[currentCategoryIndex].categoryString).split('___');
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
  categoryTextInput.value('');
  displayAnswerSlotAsEmpty();

  updateConfirmCategoryButton();

  // playCssAnimation(currentCategoryContainer, 'animate-intro-question');
}
function clearCurrentCategoryDisplayed() {
  currentCategoryIndex = 0;
  categoryAnswerSlotInSentencePre.html('');
  categoryAnswerSlotInSentencePos.html('');
  categoryAnswerSlotInSentence.html('');
}
function displayAnswerSlotAsEmpty() {
  categoryAnswerSlotInSentence.html('_____').addClass('empty-category-answer');
}

function Answer(indexOnServer, question, answerString) {
  this.indexOnServer = indexOnServer;
  this.question = question;
  this.answerString = answerString;
}

function updateAnswerOnInput() {
  let answer = filteredText(categoryTextInput.value());

  if(answer == '') {
    displayAnswerSlotAsEmpty();
  } else {
    categoryAnswerSlotInSentence.html(answer).removeClass('empty-category-answer');
  }

  updateConfirmCategoryButton();
}

function updateConfirmCategoryButton() {
  if(categoryTextInput.value() == '') {
    confirmCategoryButton.html('Pular →');
  } else {
    confirmCategoryButton.html('→');
  }
}

function confirmCategory() {
  if(categoryTextInput.value() != '') {
    let answer = new Answer(categoriesList[currentCategoryIndex].indexOnServer, categoriesList[currentCategoryIndex].categoryString, categoryTextInput.value());
    categoriesList[currentCategoryIndex].confirmed = true;
    socket.emit('sendAnswer', answer);
  }
  let allCategoriesConfirmed = true;
  currentCategoryIndex = currentCategoryIndex + 1;
  for(let offsetFromCurrentIndex = 0; offsetFromCurrentIndex < categoriesList.length; offsetFromCurrentIndex++) {
    let tempIndex = (currentCategoryIndex + offsetFromCurrentIndex) % categoriesList.length;
    if(!categoriesList[tempIndex].confirmed) {
      allCategoriesConfirmed = false;
      updateCurrentCategoryDisplayed(tempIndex);
      break;
    }
  }
  setTimeout(()=>{
    categoryTextInput.elt.focus();
  }, 1);
  if(allCategoriesConfirmed) {
    //Finished
    clearCurrentCategoryDisplayed();
    categoryTextInput.value('');
    changeVisibility(categoriesContainer, false);
    changeVisibility(waitingEndFeedbackMessage, true);
  }
}

function handleRoundFinished(receivedData) {
  gameStateCopy.results = receivedData;

  resultsCategoriesLength = gameStateCopy.results.allCategories.length;
  currentResultsCategoryIndex = 0;
  presentAllAnswers();
  updateResultsOwnerControls()
  changeScreenStateTo('RESULTS');
}

function presentAllAnswers() {
  console.log(gameStateCopy.results.allCategories);
  resultsSentenceContainer.html('');
  // createElement('hr').parent(resultsSentenceContainer);
  answersUser = Object.keys(gameStateCopy.results.allCategories[currentResultsCategoryIndex].answers);

  createFormatedSentenceInParent(gameStateCopy.results.allCategories[currentResultsCategoryIndex].categoryString, '_____', resultsSentenceContainer);

  for(let i = 0; i < answersUser.length; i++) {
    createAnswerInParent(
      i,
      gameStateCopy.results.allCategories[currentResultsCategoryIndex].answers[answersUser[i]].answerString,
      gameStateCopy.results.allCategories[currentResultsCategoryIndex].indexOnServer,
      answersUser[i],
      gameStateCopy.results.allCategories[currentResultsCategoryIndex].answers[answersUser[i]].votes,
      resultsSentenceContainer
    );
  }
  createElement('hr').parent(resultsSentenceContainer);

  // let resultsProgressString = '' + '/' + ''.toString();
  // resultsProgress.html(resultsProgressString);
}

function goToNextCategory() {
  if(currentResultsCategoryIndex+1 < resultsCategoriesLength) {
    //Go to next
    let index = currentResultsCategoryIndex+1;
    socket.emit('goToCategory', {
      index: index
    });
  }
}

function finishRound() {
  //Finished
  socket.emit('finishResults');
}

function goToPreviousCategory() {
  let index = Math.max((currentResultsCategoryIndex-1), 0);
  socket.emit('goToCategory', {
    index: index
  });
}

function handleCurrentCategoryChanged(receivedData) {
  currentResultsCategoryIndex = receivedData.index;
  presentAllAnswers();
  updateResultsOwnerControls();
}

function updateResultsOwnerControls() {
  changeVisibility(previousCategory, (currentResultsCategoryIndex > 0));
  changeVisibility(nextCategory, (currentResultsCategoryIndex < resultsCategoriesLength-1));
  changeVisibility(lastCategory, (currentResultsCategoryIndex == resultsCategoriesLength-1));
}

function handleFinishedResults() {
  changeScreenStateTo('WAITING_NEXT_ROUND');
}

function createFormatedSentenceInParent(sentence, answer, targetParent) {
  //Content
  let pContainer = createP('').addClass('category').parent(targetParent);
  let sentenceSplited = String(sentence).split('___');
  if(sentenceSplited.length == 1) {
    createSpan(sentenceSplited[0] + '<br/>').parent(pContainer);
    createSpan(answer).addClass('w3-black').addClass('category-answer').addClass('empty-category-answer').parent(pContainer);
  } else if (sentenceSplited.length > 1) {
    createSpan(sentenceSplited[0]).parent(pContainer);
    createSpan(answer).addClass('w3-black').addClass('category-answer').addClass('empty-category-answer').parent(pContainer);
    createSpan(sentenceSplited[1]).parent(pContainer);
  } else {
    //Error
  }
}

function createAnswerInParent(answerIndex, answer, categoryIndex, answerUser, votes, targetParent) {
  //Button
  let sentenceButton = createButton('').addClass('w3-btn').addClass('container-button').parent(targetParent);
  sentenceButton.elt.addEventListener('click', ()=>{
    voteFor(categoryIndex, answerUser);
  });

  //Content
  let indexIdentifierAlphabet = 'abcdefghijklmnopqrstuvwxyz';
  let indexIdentifier = indexIdentifierAlphabet.charAt(answerIndex % indexIdentifierAlphabet.length) + '.' + '&nbsp;';
  createSpan(indexIdentifier).addClass('category').parent(sentenceButton);
  createSpan(answer).addClass('w3-black').addClass('category-answer').addClass('category').parent(sentenceButton);

  //Votes
  if(votes.length > 0) {
    let answersContainer = createSpan('').addClass('vote-from').parent(sentenceButton);
    for(let i = 0; i < votes.length; i++) {
      // createDiv('★ '+votes[i]).addClass('vote-from').addClass('w3-card').addClass('w3-light-grey').addClass('w3-tiny').parent(answersContainer);
      createSpan('✔').parent(answersContainer);
    }
    // createDiv('✔ '+votes.length).addClass('vote-from').addClass('w3-card').addClass('w3-light-grey').addClass('w3-small').parent(answersContainer);
  }
}

function voteFor(categoryIndex, answerUser) {
  let vote = {
    votingUser: username,
    categoryIndex: categoryIndex,
    votedUser: answerUser
  }
  // if(answerUser == username) {
  //   return;
  // }
  socket.emit('sendVote', vote);
}

function handleVotesUpdated(receivedData) {
  gameStateCopy.results = receivedData;
  presentAllAnswers();
}

function handleSendMessageButtonClicked() {
  if(chat.messageInput.value() == '') {
    return;
  }
  let text = chat.messageInput.value();
  console.log("Sent: " + text);
  socket.emit('chatMessageSent', text);
  chat.messageInput.value('');
}

function handleChatMessageReceived(receivedData) {
  let messageData = receivedData;
  messageData.username = filteredText(messageData.username);
  messageData.text = filteredText(messageData.text);

  console.log('Received from ' + messageData.username + ': ' + messageData.text);
  let displayedMessage = messageData.username + ': ' + '<strong>' + messageData.text + '</strong>';
  createP(displayedMessage).parent(chat.messagesContainer);
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
  socket.disconnect();
  displayWarning("Você foi desconectado: " + data);
  changeScreenStateTo('JOIN_ROOM_SCREEN');
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
    headerTagline,
    footer,
    containerStart,
    containerLogin,
    containerBody,
    startButtonContainer,
    restartButtonContainer,
    gameRoundContainer,
    categoriesContainer,
    waitingEndFeedbackMessage,
    resultsContainer,
    gameOptions.container,
    chat.container,
    suggestions.container,
    instructionPreRoundContainer,
    startingRoundContainer,
    activeUsernamesContainer
  ];
}

function changeScreenStateTo(newState) {
  if(newState == 'START_SCREEN') {
    activateOnlyActiveElements([header, headerTagline, footer, containerStart]);
  }
  if(newState == 'JOIN_ROOM_SCREEN') {
    joinData.usernameTextInput.value(username);
    activateOnlyActiveElements([header, headerTagline, footer, containerLogin]);
  }
  if(newState == 'LOBBY') {
    activateOnlyActiveElements([header, headerTagline, instructionPreRoundContainer, footer, containerBody, startButtonContainer, gameOptions.container, chat.container, suggestions.container, activeUsernamesContainer]);
  }
  if(newState == 'STARTING_GAME') {
    activateOnlyActiveElements([startingRoundContainer, containerBody, activeUsernamesContainer]);
  }
  if(newState == 'GAME_PLAYING') {
    activateOnlyActiveElements([gameRoundContainer, categoriesContainer, containerBody, activeUsernamesContainer]);
  }
  if(newState == 'RESULTS') {
    activateOnlyActiveElements([header, containerBody, resultsContainer]);
  }
  if(newState == 'WAITING_NEXT_ROUND') {
    activateOnlyActiveElements([header, footer, containerBody, activeUsernamesContainer, restartButtonContainer, gameOptions.container, chat.container, suggestions.container]);
  }
  if(newState == 'LOADING') {
    activateOnlyActiveElements([header, headerTagline]);
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
  if(!element) {
    console.error('Element invalid in changeVisibility function:', element, visible);
    return;
  }
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

function filteredText(text) {
  return String(text).replace(/\<.*?\>/, '');
}

setInterval(()=> {
  console.log('Acorda!');
  let url = location.origin + '/?acorda';
  let xmlHttp = new XMLHttpRequest();
  xmlHttp.open("GET", url);
  xmlHttp.send();
}, 5*60*1000);
