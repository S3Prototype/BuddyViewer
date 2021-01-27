const path = require('path');
const http = require('http');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');
var randomWords = require('random-words');
var express = require('express');
var bodyparser = require('body-parser');
const router = express.Router();
const {decode} = require('html-entities');
const bcrypt = require('bcryptjs');

const e = require('express');
const request = require('request');
// const cheerio = require('cheerio');
require('dotenv').config();
const { google } = require('googleapis');
const { title } = require('process');
const { youtube } = require("googleapis/build/src/apis/youtube");
const { youtubeAnalytics } = require("googleapis/build/src/apis/youtubeAnalytics");

//!Testing running python code
// const {spawn} = require('child_process');
// try{
//     const childPython = spawn('python', ['test.py', 'URL!']);
    
//     childPython.stdout.on('data', (data)=>{
//         console.log(`stdout: ${data}`);
//     });
//     childPython.stderr.on('data', (data)=>{
//         console.error(`stderr: ${data}`);
//     });
//     childPython.on('data', (data)=>{
//         console.log(`child ended with code: ${data}`);
//     });
// } catch(error) {
//     console.log("PYTHON ERROR: "+error);
// }

// const fs = require('fs');
const youtubedl = require('youtube-dl');

const expressLayouts = require('express-ejs-layouts');

const RoomModel = require('./models/room');

const {v4: uuidV4} = require('uuid');
const isUuid = require('isuuid');

const socketio = require('socket.io');

var jsonParser = bodyparser.json();
// var urlencodedParser = bodyparser.urlencoded({ extended: false });

const mongoose = require('mongoose');
mongoose.set('useCreateIndex', true);

var app = express();

require('./config/passport')(passport);
const server = http.createServer(app);

// let rooms = [];
const dbURI = 'mongodb+srv://'+process.env.DB_USERNAME+':'+process.env.DB_PASS+'@cluster0.agmjg.mongodb.net/'+process.env.DB_NAME+'?retryWrites=true&w=majority';
mongoose.connect(dbURI, {useNewUrlParser: true, useUnifiedTopology: true})
    .then((result)=>{
        server.listen(port, function(){
            // RoomModel.find().then((result)=>{
            //     // rooms = result;
            // }).catch((err)=>{
            //     console.log(`Failed to get rooms from DB\n${err}`);
            // });
            console.log('Connected to DB...');
            console.log(`Server listening on: ${port}`);
            console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
            console.log("======");
        });
    }).catch(err=>console.log(err));

// app.use(expressLayouts);
app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
  }));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.use((req, res, next)=>{
    res.locals.successMessage = req.flash('successMessage');
    res.locals.errorMessage = req.flash('errorMessage');
    res.locals.error = req.flash('error');
    next();
});

app.use('/', require('./routes/index'));
app.use('/images', require('./routes/images'));
app.use('/user', require('./routes/user'));
app.use(router);
// app.use(bodyparser.json());
// app.use(bodyparser.urlencoded({extended: true}));

const NSFW_THUMBNAIL = 'http://localhost:8092/images/thumbs/nsfw_thumb.jpg';
const PRIVATE_THUMBNAIL = 'http://localhost:8092/images/thumbs/private_thumb.jpg';
const LOCKED_DEFAULT_THUMBNAIL = 'http://localhost:8092/images/thumbs/lock_thumb.jpg';
const DEFAULT_THUMBNAIL = 'http://localhost:8092/images/thumbs/default_thumb.jpg';

const io = socketio(server);

//let rawData = fs.readFileSync('messages.json');

function getAllRooms(){
    return RoomModel.find();
}

let hostTimeout;
const hostTimeoutLimit = 2500;
function joinRoom(socket, userData, roomID){
    findRoom(roomID)
    .then(currRoom=>{
        if(currRoom.securitySetting === RoomSecurity.LOCKED &&
            !userData.passwordSuccess){
            //If no password, set it up; else, request it.
            if(!currRoom.password){
                io.to(socket.id).emit('setUpPassword', currRoom.roomName);
            } else {                    
                io.to(socket.id).emit('passwordRequest', currRoom.roomName);
            }
            return;
        }

        socket.join(roomID);
        if(currRoom){
            //Check if the room is locked. If so, ask for credentials.
            console.log("Joining a pre-existing room.");
            addToRoom(socket.id, userData, currRoom);
            io.to(socket.id).emit('initHistory', currRoom.history);            
            if(currRoom.users.length > 1){
                hostTimeout = setTimeout(() => {
    
                    becomeHost(currRoom.roomID, socket.id);
                    io.to(socket.id).emit('initPlayer', currRoom);
    
                }, hostTimeoutLimit);
            }
        } else {
            //THis code will basically never run,
            //because we call createEmptyRoom when people
            //take the route to even get here.
            console.log("Major error. Possible database failure. In joinRoom(), we didn't find a room at the roomID provided by the client.");            
            createNewRoom(socket.id, userData, roomID);
        }
    })
    .catch(err=>{
        //Eventually add code here to send an event
        //that will redirect user to homepage with
        //error message; otherwise, to an error page
        logFailure('join room', err)
    });
}

function logFailure(goal, error){
    console.log(`Failed to ${goal} becuase: \n${error}`);
}

function addToRoom(socketID, userData, currRoom){    
    const { localName, nameOnServer, userID, pfp } = userData;
        let isHost = false;
        if(currRoom.users.length < 1 || !currRoom.hostSocketID){
            //if this user is the only one in the room, make them host
            isHost = true;
            currRoom.hostSocketID = socketID;
            io.to(socketID).emit('noOneElseInRoom', false);
        } else {
            // If we're not the host, request state from the host.
            console.log(`Trying to get state from host (${
                currRoom.hostSocketID})`);
                            
                //Request state from the host, and set a timer.
                //If timer goes off, make new host. If host
                //responds before then, clear timer.
                console.log(`Current host is ${currRoom.hostSocketID}`);
                console.log(`Our socket ID is: ${socketID}`);
            io.to(currRoom.hostSocketID).emit('requestState',
                    {                    
                        socketID
                    }
                );            
        }
        
        currRoom.users.push({
            socketID, localName, nameOnServer, userID, isHost, pfp
        });

        RoomModel.updateOne(
            {roomID: currRoom.roomID},
            {$set: {
                users: currRoom.users,
                hostSocketID: currRoom.hostSocketID
            }},
            (err, newRoom)=>{}
        )
        .catch(err=>{
            logFailure('add to room', err);
        });
}

class RoomSecurity{
    static OPEN = 0;
    static LOCKED = 1;
    static PRIVATE = 2;
}

const defaultDescription = "A lovely room for watching videos! Join!";
const defaultSecuritySetting = RoomSecurity.OPEN;

async function createEmptyRoom(securitySetting, roomName,
                                roomDescription, roomID
    ){
    if(!roomName){
        roomName = randomWords();
    }
    if(!roomDescription){
        roomDescription = defaultDescription;
    }
    let firstThumbnail = DEFAULT_THUMBNAIL;
    switch(securitySetting){
        case RoomSecurity.PRIVATE:
            firstThumbnail = PRIVATE_THUMBNAIL;
            break;
        case RoomSecurity.LOCKED:
            firstThumbnail = LOCKED_DEFAULT_THUMBNAIL;
            break;
    }
    const newRoom = await RoomModel.create({
        roomID: roomName+'-'+roomID,
        hostSocketID: "",
        roomName,
        roomDescription,
        history: [],
        nsfw: false,
        securitySetting,
        thumbnail: firstThumbnail,
        users: [],
        password: "",
        videoTitle: "",
        videoSource: 4,
        videoID: "", //holds id most recently played video
        videoTime: 0, //most recent video time,
        videoState: CustomStates.UNSTARTED,//most recent state
        playRate: 1,
        messages: []
    });
    // rooms.push(newRoom);
    console.log(`Room created:\n${newRoom}`);
    // console.log("empty room created");
    // return newRoom;
    // return new RoomModel(newRoom).save();
    return newRoom.save();
    // .catch(err=>logFailure(`creat empty room from ${roomID}`, err));
}

async function createNewRoom(socketID, userData, roomID){
    const { localName, nameOnServer, userID, pfp } = userData;
    const randomName = randomWords();
    const thisRoom = await RoomModel.create({
        roomID: randomName+'-'+roomID,
        roomName: randomName,
        roomDescription: defaultDescription,
        history: [],
        nsfw: false,
        securitySetting: defaultSecuritySetting,
        thumbnail: LOCKED_THUMBNAIL,
        hostSocketID: socketID,
        users: [{
            socketID, localName, nameOnServer, userID, isHost: true, pfp
        }],
        videoID: "", //holds id most recently played video
        videoTime: 0, //most recent video time,
        videoState: CustomStates.UNSTARTED,//most recent state
        videoDuration: 0,
        playRate: 1,
        messages: [
                    {
                        messageID: 0,
                        text: "Welcome to the room!",
                        userID: "SERVER",
                        name: "SERVER",
                        timestamp: "",
                        universalTimeStamp: ""
                    }
                ]
        })
    // new RoomModel(thisRoom).save()
    thisRoom.save()
    .catch(err=>logFailure(`create new Room at ${roomID}`, err));
        // console.log(`Just joined ${JSON.stringify(thisRoom, null, 2)}`);
    // return thisRoom;
}

function updateRoomUsers(users, roomID){
    return RoomModel.updateOne(
        {roomID: roomID}, //query for the room to update
        {$set: {users: users}}, //value to update
        (err, newRoom)=>{}
    );
}

function changeRoomName(roomName, roomID){
    const foundRoom = findRoom(roomID);
    RoomModel.updateOne(
        {roomID}, //query for the room to update
        {$set: {roomName, roomID: roomName+'-'+roomID}}, //value to update
        (err, newRoom)=>{}
    ).then((result)=>{
        // foundRoom.roomName = result.roomName;
        // foundRoom.roomID = result.roomID;
    }).catch((err)=>logFailure(`change room name at ${roomID}`, err));
}

function getRoomHostSocketID(roomID){
    return findRoom(roomID);
}

function removeFromRoom(socket){
    // RoomModel.findOne({$text: {$search: socket.id}})
    RoomModel.find({users:{$not:{$eq:null}}})
    .then(rooms=>{
        // console.log(result);
        const foundRoom = rooms.find(room=>room.users.some(user=>user.socketID == socket.id));
        if(foundRoom){        
            console.log("USER SHOULD BE OUT OF ROOM NOW");
            socket.leave(foundRoom.roomID); 
            foundRoom.users = foundRoom.users
                        .filter(user=>user.socketID != socket.id);
            
            if(foundRoom.users.length < 1){
                foundRoom.hostSocketID = "";
            } else if(foundRoom.hostSocketID == socket.id){
                foundRoom.hostSocketID = foundRoom.users[
                    Math.floor(Math.random() * foundRoom.users.length)
                ].socketID;
                io.in(foundRoom.roomID).emit('setHost', foundRoom.hostSocketID);       
            }
            RoomModel.updateOne(
                {roomID: foundRoom.roomID}, //query for the room to update
                {$set: {
                    users: foundRoom.users,
                    hostSocketID: foundRoom.hostSocketID
                    }
                }, //value to update
                (err, newRoom)=>{}
            )
            .catch(err=>logFailure(`delete user ${socket.id}`, err));
            // updateRoomUsers(foundRoom.users, foundRoom.roomID)
        }
    });
}

function checkIfHost(roomID, socketID){
    return getRoomHostSocketID(roomID) == socketID;
}

function findRoom(roomID){
    return RoomModel.findOne({roomID});   
}

function becomeHost(roomID, socketID){
    // console.log("*****************");
    //     console.log("Becoming host of "+roomID);
        let isHost = false;
        let finalHostID = null;
        findRoom(roomID)
        .then(room=>{
            if(room){                
                RoomModel.updateOne(
                    {roomID}, //query for the room to update
                    {$set: {
                        hostSocketID: socketID
                    }}, //value to update
                    function(err, updatedRoom){
                        if(err){
                            console.log(`Room didn't update. ${err}`);
                        } else {
                            // console.log("Room is: "+JSON.stringify(updatedRoom, null, 2));
                        }

                    }    
                );
                finalHostID = socketID;
                isHost = true;
            }            
        })
        .finally(_=>{            
            // console.log(`Our final host ID is ${finalHostID} | The one we sent was ${socketID}`);
            io.in(roomID).emit('setHost', finalHostID);
        });
}

function updateRoomState(data, roomID, newState){
    // const currRoom = findRoom(roomID);
    const {videoSource, videoTitle,
           videoTime, videoID, playRate,
           videoDuration} = data;
    let {thumbnail} = data;
    RoomModel.findOne({roomID})
    .then(room=>{
        let history = room.history;
        if(!history){
            history = [];
        }

        const newHistoryDetails = {
            videoSource,
            videoTitle,
            videoTime,
            videoID,
            videoDuration,
            thumbnail
        };

            //If this item already exists, we just update it.
        if(history.length > 0 &&
            history[history.length -1].videoID == videoID){
                history[history.length -1] = newHistoryDetails;
        } else {
            //Otherwise, add it to the list.
            history.push(newHistoryDetails);
        }

        // console.log('======');
        // console.log(`Room history is now:`);
        // console.log(JSON.stringify(history, null, 2));
        // console.log('======');

        if(room.securitySetting == RoomSecurity.PRIVATE){
            thumbnail = PRIVATE_THUMBNAIL;
        } else if(videoSource == VideoSource.OTHERONE){
            thumbnail = NSFW_THUMBNAIL;
        }

        if(!thumbnail){
            thumbnail = DEFAULT_THUMBNAIL;
        }

        RoomModel.updateOne(
            {roomID}, //query for the room to update
            {$set: {
                videoTime,
                videoSource,
                videoID,
                playRate,
                thumbnail,
                videoTitle,
                videoDuration: videoDuration ?? 0,
                history
            }}, //value to update
            function(err, newRoom){}
        ).then(result=>{
            //This returns the room prior to the update
            
        });
    })
    .catch((err)=>{
        //I assume for now that if there's an error, the room doesn't exist.                
        console.log(`Failed to update room state\n${err}`);
        //should probably make a function like logFailure('update room state', err);
    });
    // .then((result)=>{})
}

const listRoomID = "LISTROOM";

io.on('connection', socket=>{

    socket.on('joinRoom', (userData, roomID)=>{
        joinRoom(socket, userData, roomID);
    });

    socket.on('checkRoomPassword', data=>{
        findRoom(data.roomID)
        .then(room=>{
            const failMessage = "Something went wrong. Please create a new room.";
            if(room && room.password){
                //if room
                bcrypt.compare(data.password, room.password,
                    (err, isMatch)=>{
                        if(err){
                            console.log(err);
                            failMessage = err;
                        } else if(!isMatch){
                            failMessage = 'Incorrect password.';
                        } else {
                            io.to(socket.id).emit('accessRoom', true);                            
                            return;
                        }
                        io.to(socket.id).emit('wrongPassword', failMessage);
                    }//err, isMatch
                )//compare()      
            } else {
                io.to(socket.id).emit('wrongPassword', failMessage);
                console.log("Tried to enter password for room that doesn't exist.");
            }
        });
    });

    socket.on('createRoomPassword', data=>{
        if(data.pass1 !== data.pass2){
            io.to(socket.id).emit('wrongPassword', "Passwords do not match.");
            return;
        }
        console.log("Trying to find room: "+data.roomID);
        findRoom(data.roomID)
        .then(room=>{
            if(room){
                if(room.password){
                    //if room already has a password, something went wrong.
                    console.log("Someone tried to change the password of a room illegally");
                    io.to(socket.id).emit('wrongPassword', "A password for this room already exists.");
                    return;
                }                    
                
                const saltRounds = 10;
                bcrypt.genSalt(saltRounds, (err, salt)=>{
                    bcrypt.hash(data.pass2, salt, (err, hash)=>{
                        if(err){
                            console.log('Error hashing room password.');
                            console.log(err);
                            io.to(socket.id).emit('wrongPassword', 'Error hashing room password.');
                        } else {
                            RoomModel.updateOne(
                                {roomID: data.roomID}, //query for the room to update
                                {$set: {
                                    password: hash
                                }}, //value to update
                                (err, newRoom)=>{}
                            ).catch(err=>{ });
                            io.to(socket.id).emit('accessRoom', true);                    
                        }
                    });
                });
            } else {
                io.to(socket.id).emit('accessRoom', true);
                console.log("Tried to enter password for room that doesn't exist.");
            }
        });
    });

    socket.on('becomeHost', (roomID)=>{
        becomeHost(roomID, socket.id);
    });

    socket.on('releaseHost', roomID=>{
        console.log("*****************");
        console.log("Releasing host of "+roomID);
        let isHost = false;
        let newHostID;
        findRoom(roomID)
        .then(room=>{
            if(room){
                //Find a random user.
                newHostID = room.users.find(user=>user.socketID != socket.id)?.socketID;                
                if(newHostID === undefined){
                    io.to(socket.id).emit('noOneElseInRoom', false);
                    return;
                }
                RoomModel.updateOne(
                    {roomID}, //query for the room to update
                    {$set: {
                        hostSocketID: newHostID
                    }}, //value to update
                    (err, newRoom)=>{}
                );              
                socket.to(roomID).emit('setHost', newHostID);
            }            
        })
        .finally(_=>{   
            if(!newHostID) newHostID = "unchanged, because no one else is in the room.";
            console.log(`Our final host ID is ${newHostID} | The one we sent was ${socket.id}`);
        });
    });

    socket.on('sendMessage', (messageData, roomID)=>{
        // console.log(JSON.stringify(messageData));        
        socket.to(roomID).broadcast.emit('getMessage', messageData);
        findRoom(roomID)
        .then(room=>{
            if(!room.messages){
                room.messages = [];
            }
            
            room.messages.push(messageData);
            
            console.log("======");
            console.log("Now the messages are:")
            console.log(room.messages);
            console.log("======");
            RoomModel.updateOne(
                {roomID}, //query for the room to update
                {$set: {
                    messages: room.messages
                }}, //value to update
            function(err, newRoom){});
        });
    });

    socket.on('setLooping', (loopValue, roomID)=>{
        socket.to(roomID).broadcast.emit('setLooping', loopValue);
    })

    socket.on('joinListRoom', _=>{
        socket.join(listRoomID);
    });

    socket.on('refreshRequest', _=>{
        const data = {
        };
        io.to(socket.id).emit('refreshResponse', data);
    });

    socket.on('joinChat', (userData, room)=>{
        // socket.to(room).broadcast.emit('chatJoined', `${userData.name} has joined the chat!`);
    });

    socket.on('sendState', (data)=>{
        if(hostTimeout){
            clearTimeout(hostTimeout);
            hostTimeout = null;
        }
        io.to(data.requesterSocketID).emit('initPlayer', data);
        console.log(`STATE SENT TO ${data.requesterSocketID}`);
    });

    socket.on('requestSync', roomID=>{
        findRoom(roomID)
        .then(({hostSocketID})=>{
            if(hostSocketID && hostSocketID != socket.id){
                io.to(hostSocketID).emit('sendUpTime', socket.id);
            }
        });
    });

    socket.on('syncFromMe', (videoTime, requesterSocketID)=>{
        io.to(requesterSocketID).emit('syncFromOther', videoTime);
    });

    socket.on('playrateChange', (playRate, roomID)=>{
            //No need to update DB every time the playrate changes.
            //Just wait until the host presses play/pause.    
        socket.to(roomID).broadcast.emit('playrateChange', playRate);
    });

    socket.on('play', (data, roomID)=>{
        // const isHost = checkIfHost(roomID, socket.id);
        findRoom(roomID)
        .then(({hostSocketID})=>{
            const isHost = hostSocketID == socket.id
            // if(isHost){
                updateRoomState(data, roomID)
            // }
            socket.to(roomID).broadcast.emit('play', {
                state: CustomStates.PLAYING,
                isHost,
                videoTime: data.videoTime
            });
        });
    });

    socket.on('pause', (data, roomID)=>{
        findRoom(roomID)
        .then(({hostSocketID})=>{
            const isHost = hostSocketID == socket.id
            // if(isHost){
                updateRoomState(data, roomID);
            // }
            socket.to(roomID).broadcast.emit('pause', {
                state: CustomStates.PAUSED,
                isHost,
                videoTime: data.videoTime
            });
        });
    });

    socket.on('playPause', (data, roomID)=>{
        findRoom(roomID)
        .then(({hostSocketID})=>{
            const isHost = hostSocketID == socket.id
            if(isHost){
                updateRoomState(data, roomID)
            }
            socket.to(roomID).broadcast.emit('playPause', {
                videoState: data.videoState,
                isHost,
                videoTime: data.videoTime
            });
        });
    });

    socket.on('seek', (videoTime, roomID)=>{
        socket.to(roomID).broadcast.emit('seek', videoTime);
    });

    socket.on('sync', roomID=>{
        findRoom(roomID)
        .then(room=>{
            io.to(roomID).emit('initPlayer', room);
        });
    });

    socket.on('message', (letterArray, roomID)=>{
        console.log(letterArray);
    });

    socket.on('startOver', (roomID)=>{
        socket.to(roomID).broadcast.emit('startOver', 0);
    });

    socket.on('startNew', (data, roomID)=>{
        updateRoomState(data, roomID, CustomStates.PAUSED);
        data.roomID = roomID;        
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

app.get('/room/', (req, res)=>{
    res.redirect('/');
});

app.get('/room/:roomID', (req, res)=>{
    // const currRoomID = req.params.roomID;
    // console.log(`ID IS ${currRoomID}`);
    findRoom(req.params.roomID)
    .then(room=>{
        if(room){
            res.render('room', {roomID: room.roomID});
        } else {
            console.log("Someone tried to enter a room that didn't exist.");
            res.redirect('/');
        }
    })
    .catch(err=>{
        console.log(err);
        res.redirect('/');
    });
});

app.post('/create-new-room', (req, res)=>{
    const {securitySetting, roomDescription} = req.body;
    let {roomName} = req.body;
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

    const rawID = uuidV4();
    console.log("SECURITY SETTING: "+securitySetting+`(${securityResult})`);
    createEmptyRoom(securityResult, roomName, roomDescription, rawID)
    .then(({roomID})=>{
        res.redirect(`/room/${roomID}`);
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


class VideoSource{
    static YOUTUBE = 0;
    static VIMEO = 2;
    static SPOTIFY = 3;
    static OTHERONE = 4;
}

class YouTubeSearchManager{
    static searchResults = [];
}

app.post('/get-rooms-list', (req, res)=>{
    getAllRooms()
    .then(rooms=>{
        res.send({rooms});
    })
    .catch(error=>{
        logFailure()
        res.render('error', {error});//Show error page
    });
});

app.post('/getYouTubeInfo', (req, res)=>{
    const options = [];
    youtubedl.getInfo(req.body.videoID, [], (error, info)=>{
        if (error || !info){
            console.log('==============');
            console.log(`Error looking for video ${req.query}.`);
            console.log(`${error}`);
            console.log('==============');
            res.send({error});
        } else {
            const {title, description, thumbnail} = info;
            res.send({videoTitle: title, description, thumbnail});
        }
    });
});

// const fs = require('fs')
// const youtubedl = require('youtube-dl')

// const video = youtubedl('http://www.youtube.com/watch?v=90AiXO1pAiA',
//   // Optional arguments passed to youtube-dl.
//   ['--format=18'],
//   // Additional options can be given for calling `child_process.execFile()`.
//   { cwd: __dirname })

// // Will be called when the download starts.
// video.on('info', function(info) {
//   console.log('Download started')
//   console.log('filename: ' + info._filename)
//   console.log('size: ' + info.size)
// })

// video.pipe(fs.createWriteStream('myvideo.mp4'))

app.post('/otherone', (req, res)=>{
        //Validate the options before starting the search.
    const options = req.body.options ? req.body.options : [];
    youtubedl.getInfo(req.body.query, options, (error, info)=>{
        if (error || !info){
            console.log('==============');
            console.log(`Error looking for otherone video ${req.query}.`);
            console.log('VVVVVVVVVVVVVVVV');
            console.log(`${error}`);
            console.log('==============');
            res.send({error});
        } else {
            const resultData = {
                videoSource: VideoSource.OTHERONE, 
                videoState: CustomStates.PLAYING,
                videoTitle: info.title || 'Internet Video',
                videoTime: 0, 
                videoID: info.url,
                playRate: 1,
                thumbnail: NSFW_THUMBNAIL,
                videoDuration: undefined
            };            
            updateRoomState(resultData, req.body.roomID);
            res.send(resultData);
        }
        // {
        //     id: info.id,
        //     title: info.title,
        //     url: info.url,
        //     thumbnail: info.thumbnail,
        //     description: info.description,
        //     filename: info._filename,
        //     format_id: info.format_id
        // }
    });
});

app.post('/search', function(req, response){   
    google.youtube('v3').search.list({
        key: process.env.YOUTUBE_TOKEN,
        part: "snippet",
        q: req.body.query,
        maxResults: 20
    }).then(({ data })=>{
        const searchData = [];
        data.items.forEach((item)=>{
            if(item.id.kind == "youtube#video"){
                const {snippet} = item;
                searchData.push({
                    title: decode(snippet.title),
                    description: decode(snippet.description),
                    published: snippet.publishedAt,
                    thumbnail: snippet.thumbnails['high'].url,
                    channelTitle: snippet.channelTitle,
                    videoID: item.id.videoId
                });
                console.log(JSON.stringify(searchData, null, 2));
            }
        });
        response.send(searchData);
    })
    .catch(e=>console.log(e));
});

app.post('/get-search-results', function(req, res){
    
    const results = YouTubeSearchManager.searchResults[req.body.user_id];
    if(results){
        // results.forEach(result=>console.log(`${new Date().toLocaleTimeString()} Result is: ${JSON.stringify(result, null, 2)}`));
        YouTubeSearchManager.searchResults[req.body.user_id] = null;
    }// if(results) YouTubeSearchManager.searchResults[req.body.user_id] = null;

    res.send(results);
});

app.post('/room-password/:roomID', (req, res)=>{
});