const path = require('path');
const http = require('http');
var express = require('express');
var bodyparser = require('body-parser');
const router = express.Router();
// var events = require('events');
// const fs = require('fs');
const e = require('express');
const request = require('request');
// const cheerio = require('cheerio');
require('dotenv').config();
const { google } = require('googleapis');
const { title } = require('process');

const {v4: uuidV4} = require('uuid');

const socketio = require('socket.io');

var app = express();
const server = http.createServer(app);
const io = socketio(server);

//let rawData = fs.readFileSync('messages.json');
let allStatesAligned = true;
let socketCount = 0;
let meaninglessvar = "JUST A TEST THING.";

let rooms = [];

function joinRoom(socket, userData, videoData, roomID){
    if(!rooms.some(room=>{return room.roomID == roomID})){
        createNewRoom(socket.id, userData, videoData, roomID);
    } else {
        addToRoom(socket.id, userData, videoData, roomID);
    }
    socket.join(roomID);
}

function addToRoom(socketID, userData, videoData, roomID){    
    const { localName, nameOnServer, userID, pfp } = userData;
    const { videoID, videoTime } = videoData;
    const currRoom = rooms.find(room=>{return room.roomID == roomID});
    let isHost = false;
    if(currRoom.users.length < 1 || !currRoom.hostSocketID){
        //if this user is the only one in the room
        isHost = true;
        currRoom.hostSocketID = socketID;
    }
    currRoom.users.push({
        socketID, localName, nameOnServer, userID, isHost, pfp
    });
    console.log(` ${JSON.stringify(currRoom, null, 2)}`);
}

function createNewRoom(socketID, userData, videoData, roomID){
    const { localName, nameOnServer, userID, pfp } = userData;
    const { videoID, videoTime } = videoData;
    const thisRoom = rooms.push({
        roomID,
        hostSocketID: socketID,
        users: [{
            socketID, localName, nameOnServer, userID, isHost: true, pfp
        }],
        videoID, //holds id most recently played video
        videoTime, //most recent video time,
        videoState: CustomStates.UNSTARTED,//most recent state
        playRate: 1,
        messages: [
                    {
                        mID: 0,
                        mContent: "Welcome to the room!",
                        mUserID: "SERVER",
                        mlocalName: "SERVER",
                        mlocalTimeStamp: "",
                        mUniversalTimeStamp: ""
                    }
                ]
    });
    console.log(`Just joined ${JSON.stringify(thisRoom, null, 2)}`);
    // rooms[roomID].users[userID] = {
    //     socketID, localName, serverName, userID, isHost: true, pfp
    // }
}

function getRoomHostSocketID(roomID){
    return rooms.find(room=>{return room.roomID == roomID}).hostSocketID;
}

function removeFromRoom(socket){
    if(rooms.length < 1) return;
    const currRoom = rooms.find(
        room=>{ return room.users.some(
            user=>{return user.socketID == socket.id})
        }
    );

    roomIndex = rooms.indexOf(currRoom);
    // rooms[roomIndex].hostSocketID = "";

    socket.leave(currRoom.roomID);

    currRoom.users = currRoom.users.filter(
        user=>{
            return user.socketID != socket.id;
        }
    );

    if(currRoom.users.length < 1){
        currRoom.hostSocketID = "";
    } else if(currRoom.hostSocketID == socket.id){
        //If there are still users,
        //assign host to a random ID in the user array.
        currRoom.hostSocketID = currRoom.users[
            Math.floor(Math.random() * currRoom.users.length)
        ].socketID;
    }
}

function checkIfHost(roomID, socketID){
    return getRoomHostSocketID(roomID) == socketID;
}

function findRoom(roomID){
    return rooms.find(room=>{return room.roomID == roomID});    
}

function updateRoomState({videoTime, videoID, playRate}, roomID, newState){
    const currRoom = findRoom(roomID);
    currRoom.videoTime = videoTime;
    currRoom.videoState = newState;
    currRoom.videoID = videoID;
    currRoom.playRate = playRate;
}

io.on('connection', socket=>{

    socket.on('joinRoom', (userData, videoData, roomID)=>{
        joinRoom(socket, userData, videoData, roomID);
            //Now ask for the state from the host:
        const hostSocketID = getRoomHostSocketID(roomID);
        if(hostSocketID != socket.id){
            console.log(`Trying to get state from host (${hostSocketID})`);
            io.to(hostSocketID).emit('requestState', socket.id);
        }
    });

    socket.on('joinChat', (userData, room)=>{
        // socket.to(room).broadcast.emit('chatJoined', `${userData.name} has joined the chat!`);
    });

    socket.on('sendState', (data)=>{
        // data.senderSocketID = socket.id;
        const {requesterSocketID} = data;
        io.to(requesterSocketID).emit('initPlayer', data);
        const requesterLocalName = data.localName;
        console.log(`STATE SENT TO ${requesterLocalName}`);
    });                    

    // socket.on('queryState', (data, room)=>{
    //     if(socketCount > 1){        
    //         allStatesAligned = false;
    //         socket.to(room).broadcast.emit('getState', socket.id);
    //     }
    // });

    socket.on('playrateChange', (playRate, roomID)=>{
        socket.to(roomID).broadcast.emit('playrateChange', playRate);
    });

    socket.on('play', (data, roomID)=>{
        const isHost = checkIfHost(roomID, socket.id);
        const newState = CustomStates.PLAYING;
        if(isHost){
            updateRoomState(data, roomID, newState)
        }        
        socket.to(roomID).broadcast.emit('play', {
            state: newState,
            isHost,
            time: data.videoTime
        });
    });

    socket.on('pause', (data, roomID)=>{
        const isHost = checkIfHost(roomID, socket.id);
        const newState = CustomStates.PAUSED;
        if(isHost){
            updateRoomState(data, roomID, newState)
        }        
        socket.to(roomID).broadcast.emit('pause',{
            state: newState,
            isHost,
            time: data.videoTime
        });
    });

    socket.on('seek', (time, roomID)=>{
        socket.to(roomID).broadcast.emit('seek', time);
    });

    socket.on('sync', roomID=>{
        const currRoom = findRoom(roomID);
        const data = {
            state: currRoom.videoState,
            videoID: currRoom.videoID,
            startTime: currRoom.videoTime,
            playRate: currRoom.playRate
        }
        io.to(roomID).emit('initPlayer', data);
    });

    socket.on('message', (letterArray, roomID)=>{
        console.log(letterArray);
    });

    socket.on('startOver', (roomID)=>{
        socket.to(roomID).broadcast.emit('startOver', 0);
    });

    socket.on('startNew', (data, roomID)=>{
        socket.to(roomID).broadcast.emit('startNew', data);
    });

    socket.on('disconnect', _=>{
        console.log("DISCONNECTING!!");
        removeFromRoom(socket);
    });
});

var port = process.env.PORT || 8092;

app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));
app.use(bodyparser.json());
app.use(router);

app.get('/', (req, res)=>{
    // res.render('room', {roomID: uuidV4()});
    res.redirect(`/${uuidV4()}`);
});

app.get('/:roomID', (req, res)=>{
    const currRoomID = req.params.roomID;
    console.log(`ID IS ${currRoomID}`);
    res.render('room', {roomID: currRoomID});
});

app.post('/room', (req, res)=>{
    rooms[req.body.room] = {users: {}};
    res.redirect(res.body.room);
});


class CustomStates{
    static UNSTARTED = -1;
    static ENDED = 0;
    static PLAYING = 1;
    static PAUSED = 2;
    static BUFFERING = 3;
    static CUED = 5;
    //Below are my custom values
    static SEEKING = 6;
}

class YouTubeSearchManager{
    static searchResults = [];
}

app.post('/search', function(req, res){
    // console.log(`${new Date().toLocaleTimeString()} Searching for: ${JSON.stringify(req.body, null, 2)}`);
    // console.log('===================================');    
    google.youtube('v3').search.list({
        key: process.env.YOUTUBE_TOKEN,
        part: "snippet",
        q: req.body.query,
        maxResults: 20
    }).then((res)=>{
        const searchData = [];
        const { data } = res;
        data.items.forEach(function(item){
            if(item.id.kind == "youtube#video"){
                const snippet = item.snippet;
                searchData.push({
                    title: snippet.title,
                    description: snippet.description,
                    published: snippet.publishedAt,
                    thumbnail: snippet.thumbnails['high'].url,
                    videoID: item.id.videoId
                });
            }
        });
        YouTubeSearchManager.searchResults[req.body.user_id] = searchData;
    })
    .catch(e=>console.log(e));
    res.send(YouTubeSearchManager.searchResults[req.body.user_id]);
});

app.post('/get-search-results', function(req, res){
    
    const results = YouTubeSearchManager.searchResults[req.body.user_id];
    if(results){
        // results.forEach(result=>console.log(`${new Date().toLocaleTimeString()} Result is: ${JSON.stringify(result, null, 2)}`));
        YouTubeSearchManager.searchResults[req.body.user_id] = null;
    }// if(results) YouTubeSearchManager.searchResults[req.body.user_id] = null;

    res.send(results);
});

server.listen(port, function(){
    console.log(`Server listening on: ${port}`);
    console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
    console.log("======");
    // setInterval(NameContainer.checkPings, 2500);
    // setInterval(VideoManager.checkPings, 1000);
});