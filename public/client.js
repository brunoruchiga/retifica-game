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

function setup() {
  socket = io.connect(HOST);
  socket.on('messageSent', handleMessageReceived);
  socket.on('usernameChanged', handleUsernameInitialized);

  noCanvas();

  containerLogin = createDiv().id('container-login');
  containerBody = createDiv().id('container-body');

  loginInstructions = createP('Escolha seu nome de usuário:').parent(containerLogin);
  username = 'user' + nf(floor(random(0,10000)),4,0);
  usernameTextInput = createInput(username).parent(containerLogin);
  usernameConfirmButton = createButton('Entrar').mousePressed(requestNewUsername).parent(containerLogin);
  handleEnterKey(usernameTextInput, requestNewUsername);

  messagesInstructions = createP('Mensagens:').parent(containerBody);
  editableText = createInput('').parent(containerBody);
  button1 = createButton('Enviar').mousePressed(handleButtonClicked).parent(containerBody);
  messagesContainer = createDiv('').id('messages-container').parent(containerBody);
  handleEnterKey(editableText, handleButtonClicked);

  changeVisibility(containerBody, false);
  usernameTextInput.elt.focus();
}

function handleButtonClicked() {
  if(editableText.value() == '') {
    return;
  }
  let data = editableText.value();
  console.log("Sent:" + data);
  socket.emit('messageSent', data);
  editableText.value('');
}

function changeVisibility(element, visible) {
  if(visible) {
    element.removeClass('hidden');
  } else {
    element.class('hidden');
  }
}

function handleMessageReceived(data) {
  console.log("Received:" + data);
  createP(data).parent(messagesContainer);
  messagesContainer.elt.scrollTo(0,9999999999);
}

function requestNewUsername() {
  socket.emit('requestNewUsername', usernameTextInput.value());
}

function handleUsernameInitialized(data) {
  console.log("New username:" + data);
  changeVisibility(containerLogin, false);
  changeVisibility(containerBody, true);
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
