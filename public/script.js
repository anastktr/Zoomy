const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const myPeer = new Peer(undefined, {
  host: '/',
  port: '3001'
})
const myVideo = document.createElement('video')
const chatContainer = document.getElementById('chat-container')
const chatInput = document.getElementById('chat-input')
const shareButton = document.getElementById('share-button');
const snapshotButton = document.getElementById('snapshot-button');
const toggleSourceButton = document.getElementById('toggle-source-button');
const hangupButton = document.getElementById('hang-up');
var usernameInput = '';
const usernameButton = document.getElementById('username-button');


let cameraStream;
 
myVideo.muted = true
let peers = {}

//get video and audio from user's device
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
    cameraStream = stream;
  addVideoStream(myVideo, stream)
  myPeer.on('call', call => {
    peers[call.peer] = call;
    call.answer(stream)
    const video = document.createElement('video')
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
    });
    call.on("close", () => {
      video.remove();
  })
  })

  //called whenever another user conntects to the room
  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
  })
})

//called when another user disconnects
socket.on('user-disconnected', userId => {
  if (peers[userId]) {
    peers[userId].close()
  }
})

//called when our Peer is open
myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id)
})
let numPeers = 0;

//function to connect to a new user
function connectToNewUser(userId, stream) {
  if (numPeers >= 4){
    return;
  }
  const call = myPeer.call(userId, stream);
  const video = document.createElement('video');
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream);
  });
  call.on('close', () => {
    video.remove();
    numPeers--; 
  });
  peers[userId] = call;
  numPeers++; 
  
}
 
//add video stream to HTML
function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
  });
  videoGrid.append(video);
}

//chat
let messages = [];//pinakas pou krataei ta minimata
 
//function for sending a message in the chat
chatInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault()
    const message = chatInput.value
    chatInput.value = ''
    const username = usernameInput; 
    const timestamp = new Date().toLocaleTimeString(); 
    socket.emit('send-chat-message', { message, username, timestamp })
  }
})
 
//called when you receive a chat message
socket.on('chat-message', data => {
  messages.push({ username: data.username, message: data.message, timestamp: data.timestamp });
  displayMessages();
})

//called when you receive a snapshot from the chat
socket.on('snapshot', data => {
  messages.push({username: data.username, snapshot: data.snapshot});
  displayMessages();
});
 

//display messages in the chat
function displayMessages() {
  chatContainer.innerHTML = '';
  messages.forEach(data => {
    const messageElement = document.createElement('div');
    
    if (data.message) {
     
      messageElement.innerText = `${data.username} (${data.timestamp}): ${data.message}`;
    } else if (data.snapshot) {
      const imageElement = document.createElement('img');
      imageElement.src = data.snapshot;
      messageElement.append(document.createTextNode(`${data.username}: `));
      messageElement.append(imageElement);
    }else if (data.score) {
      messageElement.innerText = `${data.username} (${data.timestamp}): ${data.score}`;
    }
    chatContainer.appendChild(messageElement);
  });
  chatContainer.scrollTop = chatContainer.scrollHeight; //deixnei ta pio nea minimata
} 
 
//share button
//button to copy room's URL
shareButton.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href)
    .then(() => {
      alert('URL copied to clipboard');
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
});



const filterSelect = document.getElementById('filter-select');

//snapshot button
//button for taking a snapshot
snapshotButton.addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  const snapshotWidth = 200; 
  const snapshotHeight = 150; 
  canvas.width = snapshotWidth;
  canvas.height = snapshotHeight;
  const context = canvas.getContext('2d');
  context.filter = filterSelect.value;
  context.drawImage(myVideo, 0, 0, canvas.width, canvas.height);
  const snapshot = canvas.toDataURL('image/png');
  const username = usernameInput;
  socket.emit('send-snapshot', { snapshot, username });
});



 
//-------------------------------------------------------------------------------------
 
//toggle camera button
const toggleCameraBtn = document.getElementById('toggle-camera-btn');
toggleCameraBtn.addEventListener('click', toggleCamera);
 
//toggle camera function 
function toggleCamera(){ 
  if(cameraStream){
    const tracks = cameraStream.getVideoTracks();
 
    tracks.forEach(track => track.enabled = !track.enabled);
 
    const isCameraEnabled = tracks[0].enabled;
    toggleCameraBtn.textContent = isCameraEnabled ? 'Disable Camera' : 'Enable Camera';
  }
}
 
//toggle microphone button
const toggleMicBtn = document.getElementById('toggle-mic-btn'); 
toggleMicBtn.addEventListener('click', toggleMicrophone);
 
//toggle microphone function
function toggleMicrophone(){
  if (cameraStream){
    const audioTracks = cameraStream.getAudioTracks();
 
    audioTracks.forEach(track=>{
      track.enabled = !track.enabled;
    });
 
    const isMicEnabled = audioTracks[0].enabled;
    toggleMicBtn.textContent = isMicEnabled ? 'Disable Microphone' : 'Enable Microphone';
  }
}
//toggle source button for switching between camera and screen sharing
let isScreenShared = false;

toggleSourceButton.addEventListener('click', toggleSource);

function toggleSource() {
  if (cameraStream) {
    const videoTracks = cameraStream.getVideoTracks();

    videoTracks.forEach(track => {
      track.enabled = !track.enabled;
    });

    if (isScreenShared) {
      // switch back to camera
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      }).then(stream => {
        switchStream(stream);
      });
    } else {
      // switch to sharescreen
      navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      }).then(stream => {
        switchStream(stream);
      });
    }
    isScreenShared = !isScreenShared;
  }
}

//function to switch the camera stream
function switchStream(stream) {
  cameraStream = stream;
  myVideo.srcObject = stream;
  myVideo.play();
  //update the video tracks for all connected peers
  for (const peer in peers) {
    let call = peers[peer]; 
    let newVideoTrack = stream.getVideoTracks()[0];
    call.peerConnection.getSenders().forEach(function(sender) {
      if (sender.track.kind === newVideoTrack.kind) {
        sender.replaceTrack(newVideoTrack);
      }
    });
  }
}


//-------------------------------------soundbar

const playButton = document.getElementById('play-button');

const soundFilePath = '../cr_suuu.mp3';



//------------------------------------morethanone


const playButton2 = document.getElementById('play-button2');

const playButton3 = document.getElementById('play-button3');

const soundFilePath2 = '../aa.mp3'; 

const soundFilePath3 = '../andrew-tate-theme-song_5Tk4Ez5.mp3'; 


playButton2.addEventListener('click', () => {
  socket.emit('send-audio-message', soundFilePath2)
});


playButton3.addEventListener('click', () => {
  socket.emit('send-audio-message', soundFilePath3)
});


//--------------------------------------morethanoneend

playButton.addEventListener('click', () => {
  socket.emit('send-audio-message', soundFilePath)
});



socket.on('audio-message', data => {
  playSound(data)
})


function playSound(soundFilePath) {
  const audioElement = new Audio(soundFilePath);
  audioElement.play();
}

function updateSoundBar(audioContext, duration) {
  const startTime = audioContext.currentTime;
  const endTime = startTime + duration;

  function update() {
    const currentTime = audioContext.currentTime;
    const progress = (currentTime - startTime) / (endTime - startTime);


    // Continue updating until the sound playback is finished
    if (currentTime < endTime) {
      requestAnimationFrame(update);
    } else {
      // Reset the sound bar after playback
      //soundBar.style.width = '0%';
    }
  }

  // Start updating the sound bar
  update();
}




//----------------------------------------------------------------------------------------------

function handleLogin() {
  var roomUUID = uuid.v4();
  window.location.href = "/"+roomUUID;
}
//------------------------------------------- ---------------------------------------------------
//button to hang up the call and redirect to the home page
hangupButton.addEventListener('click', () => {
  // Disconnect the current peer
  myPeer.disconnect();
  // Redirect to home page
  window.location.href = "/";
});
//button to set the username
usernameButton.addEventListener('click', () => {
  let username = prompt("Please enter your username");
  if (!username) {
    alert('Please enter a username.');
    return;
  }
  usernameInput = username;
});
//game


var canvas = document.getElementById('game');
var context = canvas.getContext('2d');
let gameisrunning = false;

// the canvas width & height, snake x & y, and the apple x & y, all need to be a multiples of the grid size in order for collision detection to work
// (e.g. 16 * 25 = 400)
var grid = 16;
var count = 0;

var snake = {
  x: 160,
  y: 160,

  // snake velocity. moves one grid length every frame in either the x or y direction
  dx: grid,
  dy: 0,

  // keep track of all grids the snake body occupies
  cells: [],

  // length of the snake. grows when eating an apple
  maxCells: 4
};
var apple = {
  x: 320,
  y: 320
};


function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

// game loop
function loop() {
  // stop game loop if snake collided with itself
  if (!gameisrunning) {
    return;
  }
  requestAnimationFrame(loop);

  // slow game loop to 15 fps instead of 60 (60/15 = 4)
  if (++count < 9) {
    return;
  }

  count = 0;
  context.clearRect(0,0,canvas.width,canvas.height);

  // move snake by it's velocity
  snake.x += snake.dx;
  snake.y += snake.dy;

  // wrap snake position horizontally on edge of screen
  if (snake.x < 0) {
    snake.x = canvas.width - grid;
  }
  else if (snake.x >= canvas.width) {
    snake.x = 0;
  }

  // wrap snake position vertically on edge of screen
  if (snake.y < 0) {
    snake.y = canvas.height - grid;
  }
  else if (snake.y >= canvas.height) {
    snake.y = 0;
  }

  // keep track of where snake has been. front of the array is always the head
  snake.cells.unshift({x: snake.x, y: snake.y});

  // remove cells as we move away from them
  if (snake.cells.length > snake.maxCells) {
    snake.cells.pop();
  }

  // draw apple
  context.fillStyle = 'red';
  context.fillRect(apple.x, apple.y, grid-1, grid-1);

  // draw snake one cell at a time
  context.fillStyle = 'green';
  snake.cells.forEach(function(cell, index) {

    // drawing 1 px smaller than the grid creates a grid effect in the snake body so you can see how long it is
    context.fillRect(cell.x, cell.y, grid-1, grid-1);

    // snake ate apple
    if (cell.x === apple.x && cell.y === apple.y) {
      snake.maxCells++;

      // canvas is 400x400 which is 25x25 grids
      apple.x = getRandomInt(0, 25) * grid;
      apple.y = getRandomInt(0, 25) * grid;
    }

    // check collision with all cells after this one (modified bubble sort)
    for (var i = index + 1; i < snake.cells.length; i++) {

      // snake occupies same space as a body part. reset game
      if (cell.x === snake.cells[i].x && cell.y === snake.cells[i].y) {
        gameisrunning = false;
        sendScore(snake.maxCells);
        alert('Game over.');
        restartButton.style.display = 'block';
      }
    }
  });
}

// listen to keyboard events to move the snake
document.addEventListener('keydown', function(e) {
  // prevent snake from backtracking on itself by checking that it's
  // not already moving on the same axis (pressing A while moving
  // left won't do anything, and pressing D while moving left
  // shouldn't let you collide with your own body)

  // A key
  if (e.which === 65 && snake.dx === 0) {
    snake.dx = -grid;
    snake.dy = 0;
  }
  // W key
  else if (e.which === 87 && snake.dy === 0) {
    snake.dy = -grid;
    snake.dx = 0;
  }
  // D key
  else if (e.which === 68 && snake.dx === 0) {
    snake.dx = grid;
    snake.dy = 0;
  }
  // S key
  else if (e.which === 83 && snake.dy === 0) {
    snake.dy = grid;
    snake.dx = 0;
  }
});
//function that shows gameover


// function to start the game
function startGame() {
  // reset game state
  snake.x = 160;
  snake.y = 160;
  snake.cells = [];
  snake.maxCells = 4;
  snake.dx = grid;
  snake.dy = 0;

  apple.x = getRandomInt(0, 25) * grid;
  apple.y = getRandomInt(0, 25) * grid;
// start game loop
  gameisrunning = true;
  requestAnimationFrame(loop);
}
//function that send score to chat 
function sendScore(score) {
  const message = `Your score at snake is: ${score}`;
  chatInput.value = '';
  const username = usernameInput; 
  const timestamp = new Date().toLocaleTimeString();
  socket.emit('send-score', { message, username, timestamp })
}

socket.on('score', data => {
  messages.push({ username: data.username, message: data.message, timestamp: data.timestamp });
  displayMessages();
});


let gameStarted = false;

// a button that opens the game
const gameButton = document.getElementById('game-button');
gameButton.addEventListener('click', () => {
  if (!gameStarted) {
    canvas.style.display = 'block';
    restartButton.style.display = 'none';
    startGame();
    gameStarted = true;
  } else {
    // Hide the game board
    gameisrunning = false;
    restartButton.style.display = 'none';
    canvas.style.display = 'none';
    gameStarted = false;
  }
});
const restartButton = document.getElementById('restart-button');
restartButton.addEventListener('click', () => {
  restartButton.style.display = 'none'; // hide the button
  startGame();
});


