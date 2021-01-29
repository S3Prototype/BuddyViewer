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


const roomExpTime = 60*60*24;
const searchExpTime = 60*15;

const redisMongoQueries = require('./utils/redisMongoQueries');
const redis = redisMongoQueries.redis;

const { promisify } = require("util");

const ytsr = require('ytsr');

const e = require('express');
const request = require('request');
// const cheerio = require('cheerio');
require('dotenv').config();
const { google } = require('googleapis');
const { title } = require('process');
const { youtube } = require("googleapis/build/src/apis/youtube");
const { youtubeAnalytics } = require("googleapis/build/src/apis/youtubeAnalytics");

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

var port = process.env.PORT || 8092;
var redisPort = process.env.REDIS_PORT || 6379;

const redisClient = redisMongoQueries.createRedisClient();
const getRoomFromRedis = promisify(redisClient.hgetall).bind(redisClient);
const getKeysFromRedis = promisify(redisClient.keys).bind(redisClient);

redisClient.on('connect', _=>{
   console.log("Connected to redis");
});

const dbURI = 'mongodb+srv://'+process.env.DB_USERNAME+':'+process.env.DB_PASS+'@cluster0.agmjg.mongodb.net/'+process.env.DB_NAME+'?retryWrites=true&w=majority';
mongoose.connect(dbURI, {useNewUrlParser: true, useUnifiedTopology: true})
    .then((result)=>{
        server.listen(port, function(){
            // RoomModel.find().then((result)=>{
            //     if(!rooms) console.log("FATAL ERROR! Could not find rooms!");
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

let hostTimeout;
const hostTimeoutLimit = 2500;
function joinRoom(socket, userData, roomID){
    redisMongoQueries.findRoom(roomID)
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

                    console.log(socket.id+' trying to become Host');
                    redisMongoQueries.becomeHost(currRoom.roomID, socket.id);
                    io.to(socket.id).emit('initPlayer', currRoom);

                }, hostTimeoutLimit);
            }
        } else {
            //THis code will basically never run,
            //because we call createEmptyRoom when people
            //take the route to even get here.
            console.log(`Major error. Possible database failure. In joinRoom(), we didn't find a room at the roomID provided by the client. ID (${roomID}). Creating an empty room`);            
            redisMongoQueries.createEmptyRoom(RoomSecurity.PRIVATE, randomWords(),
                defaultDescription, uuidV4());
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
            console.log("No one else in room, so initting player with room");
            io.to(socketID).emit('initPlayer', currRoom);
        } else {
            // If we're not the host, request state from the host.
            console.log(`Trying to get state from host (${
                currRoom.hostSocketID})`);                            
                //Request state from the host, and set a timer.
                //If timer goes off, make new host. If host
                //responds before then, clear timer.
                console.log(`Current host is ${currRoom.hostSocketID}`);
                console.log(`Our socket ID is: ${socketID}`);
            io.to(currRoom.hostSocketID).emit('requestState', {socketID});            
        }
        
        currRoom.users.push({
            socketID, localName, nameOnServer, userID, isHost, pfp
        });

        redisMongoQueries.updateRoomUsers(currRoom);

        // redisClient.hmset(currRoom.roomID,
        //     'hostSocketID', currRoom.hostSocketID,
        //     'users', JSON.stringify(currRoom.users),
        //     (err, reply)=>{
        //         console.log(`Adding user (${socketID}) to room ${currRoom.roomID}. Status: ${reply}`);
        //         if(!reply) logFailure(`add user to room ${roomID}`, `Couldn't find the room.`);
        //         if(err) logFailure(`add user to room ${roomID}`, err);
        //     }
        // );

        // RoomModel.updateOne(
        //     {roomID: currRoom.roomID},
        //     {$set: {
        //         users: currRoom.users,
        //         hostSocketID: currRoom.hostSocketID
        //     }},
        //     (err, newRoom)=>{}
        // )
        // .catch(err=>{
        //     logFailure('add to room', err);
        // });
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
    console.log("We entered createemptyroom");
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
    console.log("We made it to the end of it.");
    return new Promise((resolve, reject)=>{
            console.log("In the promise");
            const newRoomID = roomName+'-'+roomID;
            redisClient.hmset(newRoomID,
                'roomID', newRoomID,
                'hostSocketID', "",
                'roomName', roomName,
                'roomDescription', roomDescription, 
                'history', JSON.stringify([]),
                'nsfw', 'false',
                'securitySetting', JSON.stringify(securitySetting),
                'thumbnail', firstThumbnail,
                'users', JSON.stringify([]),
                'password', "",
                'videoTitle', "",
                'videoSource', '-100',
                'videoDuration', '0',
                'videoID', "", //holds id most recently played video
                'videoTime', '0', //most recent video time,
                'videoState', JSON.stringify(CustomStates.UNSTARTED),//most recent state
                'playRate', '1',
                'messages', JSON.stringify([])
            ,
            (err, reply)=>{
                console.log("Reply when setting room:");
                console.log(reply);
                if(reply) resolve({roomID: newRoomID});
                if(err) reject(err);
                reject("Nothing")
            });
        });
    // const newRoom = await RoomModel.create({
    //     roomID: roomName+'-'+roomID,
    //     hostSocketID: "",
    //     roomName,
    //     roomDescription,
    //     history: [],
    //     nsfw: false,
    //     securitySetting,
    //     thumbnail: firstThumbnail,
    //     users: [],
    //     password: "",
    //     videoTitle: "",
    //     videoSource: 4,
    //     videoID: "", //holds id most recently played video
    //     videoTime: 0, //most recent video time,
    //     videoState: CustomStates.UNSTARTED,//most recent state
    //     playRate: 1,
    //     messages: []
    // });
    // rooms.push(newRoom);
    console.log(`Creating room ${roomID}... result: ${createResult}`);
    


    // console.log("empty room created");
    // return newRoom;
    // return new RoomModel(newRoom).save();
    // return newRoom.save();
    // .catch(err=>logFailure(`creat empty room from ${roomID}`, err));
}

function removeFromRoom(socket){

    socket.rooms.forEach(roomID=>{
        console.log("Leaving room: "+roomID);
        getRoomFromRedis(roomID)
        .then(reply=>{
            if(reply){
                reply = convertRedisRoomToObject(reply);
                //reassign the host if necessary
                if(reply.users.length < 1){
                    reply.hostSocketID = "";
                } else if(reply.hostSocketID == socket.id){
                    reply.hostSocketID = reply.users[
                        Math.floor(Math.random() * reply.users.length)
                    ].socketID;
                    io.in(reply.roomID).emit('setHost', reply.hostSocketID);       
                }
                    //now remove the user
                reply.users = reply.users.filter(user=>user.socketID != socket.id);
                redisMongoQueries.updateRoomUsers(reply);
                // redisClient.hmset(roomID, ['users', JSON.stringify(reply.users)],
                //     (err, thisReply)=>{
                //         if(err) console.log(err);
                //         if(!thisReply){
                //             console.log("Failed to update room in redis");
                //             return;
                //         }
                //         console.log("Successfully removed "+socket.id+". from "+roomID);
                //         console.log("Room is now:");
                //         console.log(thisReply);
                //     }
                // );
            } else {
                console.log(`Failed to remove user from ${roomID}. Couldn't find the room!`);
            }
        });
        // redisClient.hgetall(roomID, (err, reply)=>{
        //     if(err){
        //         console.log("Failed to remove "+socket.id+" from room "+roomID);
        //         return;
        //     }                              
        // });
    });              

                    // RoomModel.findOne({$text: {$search: socket.id}})
        //! The below code can be changed, since we have access to the socket's
        //! rooms now that we're listening to 'disconnecting' instead of 'disconnect'
    // RoomModel.find({users:{$not:{$eq:null}}})
    // .then(rooms=>{
    //     // console.log(result);
    //     const foundRoom = rooms.find(room=>room.users.some(user=>user.socketID == socket.id));
    //     if(foundRoom){        
    //         console.log("USER SHOULD BE OUT OF ROOM NOW");
    //         socket.leave(foundRoom.roomID); 
    //         foundRoom.users = foundRoom.users
    //                     .filter(user=>user.socketID != socket.id);
            
    //         if(foundRoom.users.length < 1){
    //             foundRoom.hostSocketID = "";
    //         } else if(foundRoom.hostSocketID == socket.id){
    //             foundRoom.hostSocketID = foundRoom.users[
    //                 Math.floor(Math.random() * foundRoom.users.length)
    //             ].socketID;
    //             io.in(foundRoom.roomID).emit('setHost', foundRoom.hostSocketID);       
    //         }
    //         RoomModel.updateOne(
    //             {roomID: foundRoom.roomID}, //query for the room to update
    //             {$set: {
    //                 users: foundRoom.users,
    //                 hostSocketID: foundRoom.hostSocketID
    //                 }
    //             }, //value to update
    //             (err, newRoom)=>{}
    //         )
    //         .catch(err=>logFailure(`delete user ${socket.id}`, err));
    //         // updateRoomUsers(foundRoom.users, foundRoom.roomID)
    //     }
    // });
}

function convertRedisRoomToObject(reply){
    Object.keys(reply).forEach((key, index)=>{
        const currObject = reply[key];
        switch(currObject){
            case 'true':
            case 'false':
                reply[key] = Boolean(currObject);
                return;
        }

        if(currObject[0] === '['){
            reply[key] = JSON.parse(currObject);
            return;
        }

        const numConversion = Number(currObject);
        if(isNaN(numConversion)) return;
        else reply[key] = numConversion;
    });
    return reply;
}

// function findRoom(roomID){
//     console.log("We were given room");
//     console.log(roomID);
//     return new Promise((resolve, reject)=>{
//         redisClient.hgetall(roomID, (err, reply)=>{            
//             if(err){
//                 console.log(`Tried finding room ${roomID}, but failed.`);
//                 console.log(err);
//                 reject(err);
//             } else if(!reply){
//                 console.log(`New msg: Tried to find room ${roomID}. Didn't work`)
//                 reject(`Tried finding room ${roomID}, but failed.`);
//             }
//             // console.log("GOT ALL");   
//             try{
//                 //Have to reconstruct the object from a string.
//                 reply = convertRedisRoomToObject(reply);
//             } catch(error){
//                 return RoomModel.findOne({roomID});
//             }
//             // console.log(reply);
//             // if(!reply) return RoomModel.findOne({roomID});            
//             // console.log('Reply was:');
//             // console.log(reply);            
//             resolve(reply);
//         });
//     });
//     // return RoomModel.findOne({roomID});
// }

// function becomeHost(roomID, socketID){
//     // console.log("*****************");
//     //     console.log("Becoming host of "+roomID);
//         let isHost = false;
//         let finalHostID = null;
//         console.log("Trying to become the host");
//         findRoom(roomID)
//         .then(room=>{
//             if(room){                
//                 // RoomModel.updateOne(
//                 //     {roomID}, //query for the room to update
//                 //     {$set: {
//                 //         hostSocketID: socketID
//                 //     }}, //value to update
//                 //     function(err, updatedRoom){
//                 //         if(err){
//                 //             console.log(`Room didn't update. ${err}`);
//                 //         } else {
//                 //             // console.log("Room is: "+JSON.stringify(updatedRoom, null, 2));
//                 //         }

//                 //     }    
//                 // );
//                 redisClient.hmset(room.roomID, 
//                     [
//                         'hostSocketID', socketID
//                     ],
//                     (err, reply)=>{
//                         if(err) console.log(`Room didn't update. ${err}`);
//                         else if(reply) console.log(`user ${socketID} became host`);
//                 });
//                 finalHostID = socketID;
//                 isHost = true;
//             }            
//         })
//         .finally(_=>{            
//             // console.log(`Our final host ID is ${finalHostID} | The one we sent was ${socketID}`);
//             io.in(roomID).emit('setHost', finalHostID);
//         });
// }

// function updateRoomState(data, roomID){
//     const {videoSource, videoTitle,
//            videoTime, videoID, playRate,
//            videoDuration} = data;
//     let {thumbnail} = data;
//     console.log("We're in room update");
//     findRoom(roomID)
//     .then(room=>{
//         let history = room.history;
//         if(!history){
//             history = [];
//         }

//         const newHistoryDetails = {
//             videoSource,
//             videoTitle,
//             videoTime,
//             videoID,
//             videoDuration,
//             thumbnail,
//             channelTitle: data.channelTitle
//         };

//             //If this item already exists, we just update it.
//         if(history.length > 0 &&
//             history[history.length -1].videoID == videoID){
//                 history[history.length -1] = newHistoryDetails;
//         } else {
//             //Otherwise, add it to the list.
//             history.push(newHistoryDetails);
//         }

//         if(room.securitySetting == RoomSecurity.PRIVATE){
//             thumbnail = PRIVATE_THUMBNAIL;
//         } else if(videoSource == VideoSource.OTHERONE){
//             thumbnail = NSFW_THUMBNAIL;
//         }

//         if(!thumbnail){
//             thumbnail = DEFAULT_THUMBNAIL;
//         }

//         redisClient.hmset(room.roomID,
//             'history', JSON.stringify(history),
//             'thumbnail', thumbnail,
//             'videoTitle', videoTitle,
//             'videoSource', JSON.stringify(videoSource),
//             'playRate', JSON.stringify(playRate),
//             'videoDuration', JSON.stringify(videoDuration),
//             'videoID', videoID, //holds id most recently played video
//             'videoTime', JSON.stringify(videoTime), //most recent video time,
//             'videoState', JSON.stringify(CustomStates.UNSTARTED),//most recent state
//             (err, reply)=>{
//                 console.log("Updating room state. Status:");
//                 if(!reply) logFailure(`update room ${roomID}`, `Couldn't find the room.`);
//                 if(err) logFailure(`update room ${roomID}`, err);
//             }
//         );
//     })
//     .catch(err=>logFailure(`find room to update (${roomID})`, err));
//     // redisClient.hget(roomID, 'room', (err, room)=>{
//     //     console.log("=====================");
//     //     room = JSON.parse(room);
//     //     let history = room.history;
//     //     if(!history){
//     //         history = [];
//     //     }

//     //     const newHistoryDetails = {
//     //         videoSource,
//     //         videoTitle,
//     //         videoTime,
//     //         videoID,
//     //         videoDuration,
//     //         thumbnail,
//     //         channelTitle: data.channelTitle
//     //     };

//     //         //If this item already exists, we just update it.
//     //     if(history.length > 0 &&
//     //         history[history.length -1].videoID == videoID){
//     //             history[history.length -1] = newHistoryDetails;
//     //     } else {
//     //         //Otherwise, add it to the list.
//     //         history.push(newHistoryDetails);
//     //     }

//     //     if(room.securitySetting == RoomSecurity.PRIVATE){
//     //         thumbnail = PRIVATE_THUMBNAIL;
//     //     } else if(videoSource == VideoSource.OTHERONE){
//     //         thumbnail = NSFW_THUMBNAIL;
//     //     }

//     //     if(!thumbnail){
//     //         thumbnail = DEFAULT_THUMBNAIL;
//     //     }

//     //     redisClient.hset(room.roomID, 'room', JSON.stringify({
//     //             videoTime,
//     //             videoSource,
//     //             videoID,
//     //             playRate,
//     //             thumbnail,
//     //             videoTitle,
//     //             videoDuration: videoDuration ?? 0,
//     //             history
//     //         }),
//     //         (err, reply)=>{
//     //             if(err){
//     //                 console.log("Error updating room state");
//     //                 console.log(err);
//     //             }
//     //         }
//     //     );
//     // });
//     // RoomModel.findOne({roomID})
//     // .then(room=>{
//     //     let history = room.history;
//     //     if(!history){
//     //         history = [];
//     //     }

//     //     const newHistoryDetails = {
//     //         videoSource,
//     //         videoTitle,
//     //         videoTime,
//     //         videoID,
//     //         videoDuration,
//     //         thumbnail,
//     //         channelTitle: data.channelTitle
//     //     };

//     //         //If this item already exists, we just update it.
//     //     if(history.length > 0 &&
//     //         history[history.length -1].videoID == videoID){
//     //             history[history.length -1] = newHistoryDetails;
//     //     } else {
//     //         //Otherwise, add it to the list.
//     //         history.push(newHistoryDetails);
//     //     }

//     //     // console.log('======');
//     //     // console.log(`Room history is now:`);
//     //     // console.log(JSON.stringify(history, null, 2));
//     //     // console.log('======');

//     //     if(room.securitySetting == RoomSecurity.PRIVATE){
//     //         thumbnail = PRIVATE_THUMBNAIL;
//     //     } else if(videoSource == VideoSource.OTHERONE){
//     //         thumbnail = NSFW_THUMBNAIL;
//     //     }

//     //     if(!thumbnail){
//     //         thumbnail = DEFAULT_THUMBNAIL;
//     //     }

//     //     RoomModel.updateOne(
//     //         {roomID}, //query for the room to update
//     //         {$set: {
//     //             videoTime,
//     //             videoSource,
//     //             videoID,
//     //             playRate,
//     //             thumbnail,
//     //             videoTitle,
//     //             videoDuration: videoDuration ?? 0,
//     //             history
//     //         }}, //value to update
//     //         function(err, newRoom){}
//     //     ).then(result=>{
//     //         //This returns the room prior to the update
            
//     //     });
//     // })
//     // .catch((err)=>{
//     //     //I assume for now that if there's an error, the room doesn't exist.                
//     //     console.log(`Failed to update room state\n${err}`);
//     //     //should probably make a function like logFailure('update room state', err);
//     // });
//     // .then((result)=>{})
// }

const listRoomID = "LISTROOM";

io.on('connection', socket=>{

    socket.on('joinRoom', (userData, roomID)=>{
        joinRoom(socket, userData, roomID);
    });

    socket.on('checkRoomPassword', data=>{
        redisMongoQueries.findRoom(data.roomID)
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
        redisMongoQueries.findRoom(data.roomID)
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
        redisMongoQueries.becomeHost(roomID, socket.id);
    });

    socket.on('releaseHost', roomID=>{
        console.log("*****************");
        console.log("Releasing host of "+roomID);
        let isHost = false;
        let newHostID;
        redisMongoQueries.findRoom(roomID)
        .then(room=>{
            if(room){
                //Find a random user.
                newHostID = room.users.find(user=>user.socketID != socket.id)?.socketID;                
                if(newHostID === undefined){
                    io.to(socket.id).emit('noOneElseInRoom', false);
                    return;
                }
                // RoomModel.updateOne(
                //     {roomID}, //query for the room to update
                //     {$set: {
                //         hostSocketID: newHostID
                //     }}, //value to update
                //     (err, newRoom)=>{}
                // );              
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
        redisMongoQueries.findRoom(roomID)
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
        redisMongoQueries.findRoom(roomID)
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
        socket.to(roomID).broadcast.emit('play', {
            state: CustomStates.PLAYING,
            isHost,
            videoTime: data.videoTime
        });
        if(data.isHost){
            redisMongoQueries.updateRoomState(data, roomID);
        }
    });

    socket.on('pause', (data, roomID)=>{
        socket.to(roomID).broadcast.emit('pause', {
            state: CustomStates.PAUSED,
            isHost,
            videoTime: data.videoTime
        });
        if(data.isHost){
            redisMongoQueries.updateRoomState(data, roomID);
        }
    });

    socket.on('playPause', (data, roomID)=>{
        socket.to(roomID).broadcast.emit('playPause', {
            videoState: data.videoState,
            isHost: data.isHost,
            videoTime: data.videoTime
        });
            //Then update the room if they're the host.
        if(data.isHost){
            redisMongoQueries.updateRoomState(data, roomID);
        }
    });

    socket.on('seek', (data, roomID)=>{
        socket.to(roomID).broadcast.emit('seek', data.videoTime);
        if(data.isHost){
            redisMongoQueries.updateRoomState(data, roomID);
        }
    });

    socket.on('sync', roomID=>{
        redisMongoQueries.findRoom(roomID)
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
        console.log("START NEW CALLED");
        redisMongoQueries.updateRoomState(data, roomID);
        data.roomID = roomID;        
        socket.to(roomID).broadcast.emit('startNew', data);
    });

    // socket.on('disconnect', _=>{
    //     console.log("DISCONNECTING!!");
    //     removeFromRoom(socket);
    // });

    socket.on('disconnecting', _=>{
        console.log("DISCONNECTING!!");
        removeFromRoom(socket);
    });
});

app.post('/check-saved-roomID', (req, res)=>{
    console.log("GET FIRED");
    const shouldRedirect = isUuid(req.body.currRoomID) && redisMongoQueries.findRoom(req.body.storedRoomID);
    res.send(shouldRedirect);
});

app.get('/room/', (req, res)=>{
    res.redirect('/');
});

app.get('/room/:roomID', (req, res)=>{
    // const currRoomID = req.params.roomID;
    // console.log(`ID IS ${currRoomID}`);
    redisMongoQueries.findRoom(req.params.roomID)
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
        console.log(`Creating room ${roomID}`);
        res.redirect(`/room/${roomID}`);
    })
    .catch(err=> console.log(err));
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
    // RoomModel.find()
    // .then(rooms=>{
    //     res.send({rooms});
    // })
    // .catch(error=>{
    //     logFailure('get all rooms', error);
    //     res.render('error', {error});//Show error page
    // });

    //* Get all keys.
    //* For each key, hgetall the room.
    //* save that result to an array
    //* res.send that array
    redisMongoQueries.getRoomsList(res);
    // let promises = [];    
    // const roomArray = []; 
    
    // redisClient.keys('*', (err, roomList)=>{
    //     if(err){
    //         res.render('error', {err});
    //         return;
    //     }
    //     const keys = Object.keys(roomList);
    //     // console.log("keys is");
    //     // console.log(keys);            
    //     roomList.forEach((roomID)=>{
    //         promises.push(
    //             getRoomFromRedis(roomID)
    //             .then(room=>{
    //                 if(room.room || !room.roomID) return;

    //                 return new Promise((resolve, reject)=>{
    //                     room = convertRedisRoomToObject(room);
    //                     // console.log("Room is");   
    //                     // console.log(room);
    //                     // console.log('***************');
    //                     try{
    //                         resolve(roomArray.push(room))
    //                     } catch (err){
    //                         reject(err);
    //                     }
    //                 });
    //             })//getroomfromredis.then()
    //         );//promises.push()
    //     });//roomlist.foreach                           
    //     Promise.all(promises)
    //     .then(_=>{         
    //         console.log('888888888888888888888888888');
    //         console.log("PROMISE:");
    //         console.log(roomArray);
    //         res.send({rooms: roomArray});
    //     });
    // });
});

app.post('/getYouTubeInfo', (req, res)=>{
    const options = [];
    ytsrGetOneResult(req.body.videoID, res);
    // youtubedl.getInfo(req.body.videoID, [], (error, info)=>{
    //     if (error || !info){
    //         console.log('==============');
    //         console.log(`Error looking for video ${req.query}.`);
    //         console.log(`${error}`);
    //         console.log('==============');
    //         res.send({error});
    //     } else {
    //         const {title, description, thumbnail} = info;
    //         res.send({videoTitle: title, description, thumbnail});
    //     }
    // });
});

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
            redisMongoQueries.updateRoomState(resultData, req.body.roomID);
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

async function ytsrSearch(query, res){    
    const searchResults = await ytsr(query, {pages: 1});
    const searchData = searchResults.items.filter(item=>item.type === 'video');    
    searchData.forEach(item=>{
        // console.log(JSON.stringify(item, null, 2));
        item.thumbnail = item.bestThumbnail.url;
        item.videoID = item.id;
        item.title = decode(item.title);
        item.videoTitle = item.title;
        item.channelTitle = decode(item.author.name);
        item.description = decode(item.description);        
    });
    res.send(searchData);
}

async function ytsrGetOneResult(query, res){
    const searchResults = await ytsr(query, {pages: 1});
    const searchData = searchResults.items.filter(item=>item.type === 'video');
    const item = searchData[0];
    item.thumbnail = item.bestThumbnail.url;
    item.videoID = item.id;
    item.title = decode(item.title);
    item.videoTitle = item.title;
    item.channelTitle = decode(item.author.name);
    item.description = decode(item.description);        
    res.send(item);
}

app.post('/search', function(req, response){
    ytsrSearch(req.body.query, response);
    // google.youtube('v3').search.list({
    //     key: process.env.YOUTUBE_TOKEN,
    //     part: "snippet",
    //     q: req.body.query,
    //     maxResults: 20
    // }).then(({ data })=>{
    //     const searchData = [];
    //     data.items.forEach((item)=>{
    //         if(item.id.kind == "youtube#video"){
    //             const {snippet} = item;
    //             searchData.push({
    //                 title: decode(snippet.title),
    //                 description: decode(snippet.description),
    //                 published: snippet.publishedAt,
    //                 thumbnail: snippet.thumbnails['high'].url,
    //                 channelTitle: snippet.channelTitle,
    //                 videoID: item.id.videoId
    //             });
    //             console.log(JSON.stringify(searchData, null, 2));
    //         }
    //     });
    //     response.send(searchData);
    // })
    // .catch(e=>console.log(e));
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