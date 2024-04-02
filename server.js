const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)
const { v4: uuidV4 } = require('uuid')

app.set('view engine', 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true })) 



//----------------------------------------------------------------------------------------------
//render login page for the root URL
app.get('/', (req, res) => {
  res.render('login');
});
//----------------------------------------------------------------------------------------------

// handle post request to create a new room and redirect to it
app.post('/room', (req, res) => {
  const roomUUID = uuidV4();
  res.redirect(`/${roomUUID}`);
});

//render the room page for the specified room ID  
app.get('/:room', (req, res) => {
  const roomUUID = req.params.room;
  res.render('room', { roomId: req.params.room, roomUUID: roomUUID });
})

//socket.io connection handling
io.on('connection', socket => {
  //event handler for users joining a roomn
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId)
    //broadcast user connection to others in the room
    socket.to(roomId).broadcast.emit('user-connected', userId)
    
    //event handler for sending chat messages
    socket.on('send-chat-message', data => {
      io.emit('chat-message', data);
    });


    //event handler for sending audio messages
    socket.on('send-audio-message', adata => {
      io.emit('audio-message', adata); 
    });

    //-------------------
    

    //event handler for sending snapshots
    socket.on('send-snapshot', data => {
      io.emit('snapshot', data);
    });

    //event handler for sending game's scores
    socket.on('send-score', data => {
      io.emit('score', data);
    });

    //---------------------------

    //event handler for user disconnecting
    socket.on('disconnect', () => {
      socket.to(roomId).broadcast.emit('user-disconnected', userId)
    })
  })
})

//start the server on port 3000
server.listen(3000)