console.log('Client code loaded')

const HOST = location.origin.replace(/^http/, 'ws')
let socket;

let containerLogin;
let containerBody;

let username;
let usernameTextInput;
let usernameConfirmButton;

let messagesContainer;
let editableText;
let button1;

function setup() {
  socket = io.connect(HOST);
  socket.on('messageSent', handleMessageReceived);
  socket.on('usernameChanged', handleUsernameInitialized);

  noCanvas();

  containerLogin = createDiv().id('container-login');
  containerBody = createDiv().id('container-body');

  username = 'user' + nf(floor(random(0,10000)),4,0);
  // socket.emit('requestNewUsername', username);
  usernameTextInput = createInput(username).parent(containerLogin);
  usernameConfirmButton = createButton('Ok').mousePressed(requestNewUsername).parent(containerLogin);

  messagesContainer = createDiv('').id('messages-container').parent(containerBody);
  editableText = createInput('').parent(containerBody);
  button1 = createButton('Enviar').mousePressed(handleButtonClicked).parent(containerBody);

  changeVisibility(containerBody, false);
}

function handleButtonClicked() {
  let data = editableText.value();
  console.log("Sent:" + data);
  socket.emit('messageSent', data);
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
}

function requestNewUsername() {
  socket.emit('requestNewUsername', usernameTextInput.value());
}

function handleUsernameInitialized(data) {
  console.log("New username:" + data);
  changeVisibility(containerLogin, false);
  changeVisibility(containerBody, true);
}



/*
let em;

let myPosition;
let speed;
let myVelocity;
let myInteraction;
let myColor;

let otherClientsSocketIds = [];
let otherClientsPositions = [];
//let otherClientsColor = [];

function setup() {
  createCanvas(windowWidth-1, windowHeight-1);
  frameRate(30);
  em = height / 30;
  myPosition = createVector();
  speed = 0.25*em;
  myVelocity = createVector();
  myInteraction = false;

  let hue = floor(random(360));
  myColor = color("hsl("+hue+", 80%, 20%)");

  socket = io.connect(HOST);
  socket.on('position', handlePositionReceived);
}

function draw() {
  background(20, 20, 32);
  translate(width/2, height/2);

  //move
  let isWalking = false;
  myVelocity.set(0, 0);
  if(upKeyPressed) {
    myVelocity.add(0, -1);
    isWalking = true;
  }
  if(rightKeyPressed) {
    myVelocity.add(1, 0);
    isWalking = true;
  }
  if(downKeyPressed) {
    myVelocity.add(0, 1);
    isWalking = true;
  }
  if(leftKeyPressed) {
    myVelocity.add(-1, 0);
    isWalking = true;
  }
  myVelocity.setMag(speed);
  myPosition.add(myVelocity);

  // if(mouseIsPressed) {
    //myPosition.set(mouseX/width, mouseY/height);
    let x = myPosition.x;
    let y = myPosition.y;
    let data = {x, y, isWalking, myInteraction, myColor};
    socket.emit('position', data);
  //}

  for(let i = 0; i < otherClientsPositions.length; i++) {
    if(otherClientsPositions[i]) {
      displayPlayer(otherClientsPositions[i].x, otherClientsPositions[i].y, i, otherClientsPositions[i].myColor, otherClientsPositions[i].isWalking, otherClientsPositions[i].myInteraction);
    }
  }

  displayPlayer(myPosition.x, myPosition.y, -1, myColor, isWalking, myInteraction);
}

function displayPlayer(x, y, i, c, isWalking, isInteracting) {
  push();
  translate(x - em/2, y - em/2);

  fill(c.levels);
  stroke(c.levels);
  strokeWeight(em*0.1);

  let legsOscillationAmplitude = 0;
  if(isWalking) {
    legsOscillationAmplitude = sin(millis()*0.001*30)*0.075*em;
  }

  rect(0, 0, em, 0.75*em);
  rect(-0.2*em, 0.4*em+legsOscillationAmplitude, 0.3*em, 0.5*em);
  rect(em-0.1*em, 0.4*em-legsOscillationAmplitude, 0.3*em, 0.5*em);

  let eyeColor = color(128);
  fill(eyeColor);
  if(isInteracting) {
    fill(255);
  }
  noStroke();
  rect(0.05*em, 0.2*em, 0.25*em, 0.25*em);
  rect(em-0.25*em-0.05*em, 0.2*em, 0.25*em, 0.25*em);

  // ellipse(position.x*width, position.y*height, em, em);

  pop();
}


function handlePositionReceived(data) {
  let clientIndex = otherClientsSocketIds.indexOf(data.socketId);
  if(clientIndex < 0) {
    otherClientsSocketIds.push(data.socketId);
    clientIndex = otherClientsSocketIds.length - 1;
    otherClientsPositions[clientIndex] = data;
    //otherClientsColor[clientIndex] = color(80); //color(random(128, 255), random(128, 255), random(128, 255));
  }

  otherClientsPositions[clientIndex] = data;
}

function windowResized() {
  resizeCanvas(windowWidth-1, windowHeight-1);
  em = height / 30;
}

//keyboardControls
let upKeyPressed = false;
let rightKeyPressed = false;
let downKeyPressed = false;
let leftKeyPressed = false;
function keyPressed(){
  if (keyCode === UP_ARROW || key === 'w' || key === 'W') {
    upKeyPressed = true;
  }
  if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') {
    rightKeyPressed = true;
  }
  if (keyCode === DOWN_ARROW || key === 's' || key === 'S') {
    downKeyPressed = true;
  }
  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') {
    leftKeyPressed = true;
  }
  if (key === ' ') {
    myInteraction = true;
  }
}
function keyReleased(){
  if (keyCode === UP_ARROW || key === 'w' || key === 'W') {
    upKeyPressed = false;
  }
  if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') {
    rightKeyPressed = false;
  }
  if (keyCode === DOWN_ARROW || key === 's' || key === 'S') {
    downKeyPressed = false;
  }
  if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') {
    leftKeyPressed = false;
  }
  if (key === ' ') {
    myInteraction = false;
  }
}
*/
