const path = require('path');
const http = require('http');
var randomWords = require('random-words');
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

const RoomModel = require('./models/room');

const {v4: uuidV4} = require('uuid');
const isUuid = require('isuuid');

const socketio = require('socket.io');

var jsonParser = bodyparser.json();
// var urlencodedParser = bodyparser.urlencoded({ extended: false });

const mongoose = require('mongoose');

var app = express();
const server = http.createServer(app);

let rooms = [];
const dbURI = 'mongodb+srv://'+process.env.DB_USERNAME+':'+process.env.DB_PASS+'@cluster0.agmjg.mongodb.net/'+process.env.DB_NAME+'?retryWrites=true&w=majority';
mongoose.connect(dbURI, {useNewUrlParser: true, useUnifiedTopology: true})
.then((result)=>{
    server.listen(port, function(){
        RoomModel.find().then((result)=>{
            rooms = result;
        }).catch((err)=>{
            console.log(`Failed to get rooms from DB\n${err}`);
        });
        console.log('Connected to DB...');
        console.log(`Server listening on: ${port}`);
        console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
        console.log("======");
    });
}).catch(err=>console.log(err));

app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: true}));
// app.use(bodyparser.json());
// app.use(bodyparser.urlencoded({extended: true}));
app.use(express.json());
app.use(router);

const io = socketio(server);

//let rawData = fs.readFileSync('messages.json');

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

    updateRoomUsersDB(currRoom.users, currRoom.roomID);
    // RoomModel.updateOne(
    //     {roomID: currRoom.roomID}, //query for the room to update
    //     {$set: {users: currRoom.users}} //value to update
    // );    
    //Update room in DB.
    // console.log(` ${JSON.stringify(currRoom, null, 2)}`);
}

class RoomSecurity{
    static OPEN = 0;
    static LOCKED = 1;
    static PRIVATE = 2;
}

const defaultDescription = "A lovely room for watching videos! Join!";
const defaultThumbnail = "https://i.ytimg.com/vi/l-7--PSbfbI/maxresdefault.jpg";
const defaultSecuritySetting = RoomSecurity.OPEN;

function createEmptyRoom(securitySetting, roomName, roomDescription, roomID){
    if(!roomName){
        roomName = randomWords();
    }
    if(!roomDescription){
        roomDescription = defaultDescription;
    }
    const newRoom = {
        roomID: roomName+'-'+roomID,
        roomName,
        roomDescription,
        nsfw: false,
        securitySetting,
        thumbnail: defaultThumbnail,
        users: [],
        videoID: "", //holds id most recently played video
        videoTime: 0, //most recent video time,
        videoState: CustomStates.UNSTARTED,//most recent state
        playRate: 1,
        messages: []
    };
    // rooms.push(newRoom);
    console.log("empty room created");
    return newRoom;
}

function updateRoomUsersDB(users, roomID){
    RoomModel.updateOne(
        {roomID: roomID}, //query for the room to update
        {$set: {users: users}} //value to update
    );
}

function createNewRoom(socketID, userData, videoData, roomID){
    const { localName, nameOnServer, userID, pfp } = userData;
    const { videoID, videoTime } = videoData;
    const randomName = randomWords();
    const thisRoom = {
        roomID: randomName+'-'+roomID,
        roomName: randomName,
        roomDescription: defaultDescription,
        nsfw: false,
        securitySetting: defaultSecuritySetting,
        thumbnail: defaultThumbnail,
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
        }
    const roomForDB = new RoomModel(thisRoom);
    roomForDB.save().then((result)=>{
        rooms.push(result);
    }).catch(err=>console.log(`Failed to create new Room.\n ${err}`));
        // console.log(`Just joined ${JSON.stringify(thisRoom, null, 2)}`);
    // return thisRoom;
}

function changeRoomName(roomName, roomID){
    const foundRoom = findRoom(roomID);
    RoomModel.updateOne(
        {roomID}, //query for the room to update
        {$set: {roomName, roomID: roomName+'-'+roomID}} //value to update
    ).then((result)=>{
        foundRoom.roomName = result.roomName;
        foundRoom.roomID = result.roomID;
    }).catch((err)=>{
        console.log(`Failed to change room name.\n${err}`);
    });
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

    if(!currRoom){
        return;
    }

    // roomIndex = rooms.indexOf(currRoom);
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

    updateRoomUsersDB(currRoom.users, currRoom.roomID);
}

function checkIfHost(roomID, socketID){
    return getRoomHostSocketID(roomID) == socketID;
}

function findRoom(roomID){
    return RoomModel.findOne({roomID}).then((result)=>{
        return result;
    }).catch((err=>{
        return undefined;
    }));
    // return rooms.find(room=>{return room.roomID == roomID});    
}

function updateRoomState({videoTime, videoID, playRate, thumbnail}, roomID, newState){
    // const currRoom = findRoom(roomID);
    RoomModel.updateOne(
        {roomID: roomID}, //query for the room to update
        {$set: {videoTime, videoID, playRate, thumbnail}} //value to update
    ).then((result)=>{

        // currRoom.videoTime = result.videoTime;
        // currRoom.videoState = result.newState;
        // currRoom.videoID = result.videoID;
        // currRoom.playRate = result.playRate;
        // currRoom.thumbnail = result.thumbnail; //? result.thumbnail : defaultThumbnail;
    }).catch((err)=>{
        //I assume for now that if there's an error, the room doesn't exist.                
        console.log(`Failed to update room state\n${err}`);
        //should probably make a function like logFailure('update room state', err);
    });
}

const listRoomID = "LISTROOM";

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

    socket.on('joinListRoom', _=>{
        socket.join(listRoomID);
    });

    socket.on('refreshRequest', _=>{
        const data = {
            rooms
        };
        io.to(socket.id).emit('refreshResponse', data);
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
        if(isHost){
            updateRoomState(data, roomID, CustomStates.PLAYING)
        }        
        socket.to(roomID).broadcast.emit('play', {
            state: CustomStates.PLAYING,
            isHost,
            time: data.videoTime
        });
    });

    socket.on('pause', (data, roomID)=>{
        const isHost = checkIfHost(roomID, socket.id);
        if(isHost){
            updateRoomState(data, roomID, CustomStates.PAUSED)
        }        
        socket.to(roomID).broadcast.emit('pause',{
            state: CustomStates.PAUSED,
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
        updateRoomState(data, roomID, CustomStates.PAUSED);
        socket.to(roomID).broadcast.emit('startNew', data);
    });

    socket.on('disconnect', _=>{
        console.log("DISCONNECTING!!");
        removeFromRoom(socket);
    });
});

var port = process.env.PORT || 8092;

app.post('/check-saved-roomID', (req, res)=>{
    console.log("GET FIRED");
    const shouldRedirect = isUuid(req.body.currRoomID) && findRoom(req.body.storedRoomID);
    res.send(shouldRedirect);
});

app.get('/', (req, res)=>{
    // res.render('room', {roomID: uuidV4()});
    // res.redirect(`/${uuidV4()}`);
    // console.log(`SENDING DOWN: ${JSON.stringify(rooms, null, 2)}`);
    res.render('index', {rooms: rooms});
});

app.get('/:roomID', (req, res)=>{
    const currRoomID = req.params.roomID;
    console.log(`ID IS ${currRoomID}`);
    foundRoom = findRoom(currRoomID);
    if(!foundRoom){
            //If room doesn't exist, send them to homepage.
        res.redirect('/');
    } else {
        res.render('room', {roomID: currRoomID});
    }
});

app.post('/create-new-room', (req, res)=>{
    const {securitySetting, roomDescription} = req.body;
    let {roomName} = req.body;
    const newID = uuidV4();
    let securityResult = RoomSecurity.PRIVATE;
    switch(securitySetting){
        case "open":
            securityResult = RoomSecurity.OPEN;
            break;
        case "locked":
            securityResult = RoomSecurity.LOCKED;
            break;
        case "private":
            securityResult = RoomSecurity.PRIVATE;
            break;
    }
    if(roomName.includes(' ')){
        roomName = roomName.split(' ').join('');
    }

    if(roomName.length > 50){
        roomName = roomName.substring(0, 50);
    }

    console.log("SECURITY SETTING: "+securitySetting+`(${securityResult})`);
    const createdRoom = createEmptyRoom(securityResult, roomName, roomDescription, newID);
    
    const roomForDB = new RoomModel(createdRoom);
    roomForDB.save().then((result)=>{
        rooms.push(result);
        res.redirect(`/${result.roomID}`);
    }).catch((err)=>{
        console.log(err);
        res.send(err);
    });
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

app.post('/get-rooms-list', (req, res)=>{

    const data = {
        rooms: rooms.filter(room=>room.securitySetting != RoomSecurity.PRIVATE)
    }
    res.send(data);
});

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