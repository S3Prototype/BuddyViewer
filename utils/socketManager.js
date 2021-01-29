const RoomModel = require('../models/room');
const {v4: uuidV4} = require('uuid');
const isUuid = require('isuuid');
const randomWords = require('random-words');
const redisMongoQueries = require('./redisMongoQueries');
const bcrypt = require('bcryptjs');

const {logFailure} = require('./logUtils');

const { promisify } = require("util");

const roomUtils = require('./roomUtils');
const {RoomSecurity} = roomUtils;

let getRoomFromRedis;

const socketio = require('socket.io');
let io;

function createIO(server){
    let redisClient = redisMongoQueries.getRedisClient();
    getRoomFromRedis = promisify(redisClient.hgetall).bind(redisClient);
    io = socketio(server);    
    return io;
}

function getIO(){
    return io;
}

function initIO(socket){

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
            redisMongoQueries.becomeHost(roomID, socket.id, io);
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
            socket.rooms.forEach(roomID=>{
                if(roomID != socket.id){
                    redisMongoQueries.removeFromRoom(socket.id, roomID, io);
                }
            })
        });  
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
}

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
                    redisMongoQueries.becomeHost(currRoom.roomID, socket.id, io);
                    io.to(socket.id).emit('initPlayer', currRoom);

                }, hostTimeoutLimit);
            }
        } else {
            //THis code will basically never run,
            //because we call createEmptyRoom when people
            //take the route to even get here.
            console.log(`Major error. Possible database failure. In joinRoom(), we didn't find a room at the roomID provided by the client. ID (${roomID}). Creating an empty room`);            
            redisMongoQueries.createEmptyRoom(RoomSecurity.PRIVATE, randomWords(),
                roomUtils.defaultDescription, uuidV4());
        }
    })
    .catch(err=>{
        //Eventually add code here to send an event
        //that will redirect user to homepage with
        //error message; otherwise, to an error page
        logFailure('join room', err)
    });
}

function removeFromRoom(socket){
    socket.rooms.forEach(roomID=>{
        console.log("Leaving room: "+roomID);
        getRoomFromRedis(roomID)
        .then(reply=>{
            if(reply){
                reply = redisMongoQueries.convertRedisRoomToObject(reply);
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

module.exports = {
    createIO,
    getIO,
    initIO
}