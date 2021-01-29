const RoomModel = require('../models/room');
const redis = require('redis');
let redisClient;

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

class RoomSecurity{
    static OPEN = 0;
    static LOCKED = 1;
    static PRIVATE = 2;
}

const defaultDescription = "A lovely room for watching videos! Join!";
const defaultSecuritySetting = RoomSecurity.OPEN;

const NSFW_THUMBNAIL = 'http://localhost:8092/images/thumbs/nsfw_thumb.jpg';
const PRIVATE_THUMBNAIL = 'http://localhost:8092/images/thumbs/private_thumb.jpg';
const LOCKED_DEFAULT_THUMBNAIL = 'http://localhost:8092/images/thumbs/lock_thumb.jpg';
const DEFAULT_THUMBNAIL = 'http://localhost:8092/images/thumbs/default_thumb.jpg';

function logFailure(goal, error){
    console.log(`Failed to ${goal} becuase: \n${error}`);
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

function updateRoomState(data, roomID){
    const {videoSource, videoTitle,
           videoTime, videoID, playRate,
           videoDuration} = data;
    let {thumbnail} = data;
    console.log("We're in room update");
    findRoom(roomID)
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
            thumbnail,
            channelTitle: data.channelTitle
        };

            //If this item already exists, we just update it.
        if(history.length > 0 &&
            history[history.length -1].videoID == videoID){
                history[history.length -1] = newHistoryDetails;
        } else {
            //Otherwise, add it to the list.
            history.push(newHistoryDetails);
        }

        if(room.securitySetting == RoomSecurity.PRIVATE){
            thumbnail = PRIVATE_THUMBNAIL;
        } else if(videoSource == VideoSource.OTHERONE){
            thumbnail = NSFW_THUMBNAIL;
        }

        if(!thumbnail){
            thumbnail = DEFAULT_THUMBNAIL;
        }

        redisClient.hmset(room.roomID,
            'history', JSON.stringify(history),
            'thumbnail', thumbnail,
            'videoTitle', videoTitle,
            'videoSource', JSON.stringify(videoSource),
            'playRate', JSON.stringify(playRate),
            'videoDuration', JSON.stringify(videoDuration),
            'videoID', videoID, //holds id most recently played video
            'videoTime', JSON.stringify(videoTime), //most recent video time,
            'videoState', JSON.stringify(CustomStates.UNSTARTED),//most recent state
            (err, reply)=>{
                console.log("Updating room state. Status:");
                if(!reply) logFailure(`update room ${roomID}`, `Couldn't find the room.`);
                if(err) logFailure(`update room ${roomID}`, err);
            }
        );

        RoomModel.updateOne(
            {roomID: room.roomID}, //query for the room to update
            {$set: {
                videoTime,
                videoSource,
                videoState: CustomStates.UNSTARTED,
                videoID,
                playRate,
                thumbnail,
                videoTitle,
                videoDuration: videoDuration ?? 0,
                history
            }}, //value to update
            function(err, newRoom){
                if(err){
                    const thisRoom = newRoom ? newRoom.roomID : "a room";
                    logFailure(`update ${thisRoom} in MongoDB`, err);
                } 
                // else console.log("Updated in mongodb too");
            }
        );

    })
    .catch(err=>logFailure(`find room to update (${roomID})`, err));    
}

function findRoom(roomID){
    console.log("We were given room");
    console.log(roomID);
    return new Promise((resolve, reject)=>{
        redisClient.hgetall(roomID, (err, reply)=>{            
            if(err){
                logFailure(`find room in redis (${roomID})`, err);
                console.log("Trying MongoDB...");
                return RoomModel.findOne({roomID});                
            } else if(!reply){
                console.log(`New msg: Tried to find room ${roomID}. Didn't work`)
                reject(`Tried finding room ${roomID}, but failed.`);
            }
            // console.log("GOT ALL");   
            try{
                //Have to reconstruct the object from a string.
                reply = convertRedisRoomToObject(reply);
            } catch(error){
                logFailure(`find room in redis (${roomID})`, err);
                console.log("Trying MongoDB...");
                return RoomModel.findOne({roomID});
            }           
            resolve(reply);
        });
    });
    // return RoomModel.findOne({roomID});
}

function becomeHost(roomID, socketID){
    // console.log("*****************");
    //     console.log("Becoming host of "+roomID);
        let isHost = false;
        let finalHostID = null;
        console.log("Trying to become the host");
        findRoom(roomID)
        .then(room=>{
            if(room){          
                redisClient.hmset(room.roomID, 
                    [
                        'hostSocketID', socketID
                    ],
                    (err, reply)=>{
                        if(err){
                            logFailure(`redis-set ${socketID} to host of ${roomID}`, err);
                            console.log("Trying MongoDB");                                  
                            RoomModel.updateOne(
                                {roomID}, //query for the room to update
                                {$set: {
                                    hostSocketID: socketID
                                }}, //value to update
                                function(err, updatedRoom){
                                    if(err){
                                        logFailure(`mongodb-set ${socketID} to host of ${roomID}`, err);                                        
                                    } else {
                                        console.log("Host set in MongoDB");
                                    }

                                }    
                            );
                        }
                        else if(reply) console.log(`user ${socketID} became host`);
                });
                finalHostID = socketID;
                isHost = true;
            }            
        })
        .finally(_=>{            
            // console.log(`Our final host ID is ${finalHostID} | The one we sent was ${socketID}`);
            io.in(roomID).emit('setHost', finalHostID);
        });
}

function updateRoomIfHost(data, socketID, roomID){
    findRoom(roomID)
    .then(({hostSocketID})=>{
        const isHost = hostSocketID == socketID
        if(isHost){
            updateRoomState(data, roomID)
        }
    });
}

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

    return new Promise((resolve, reject)=>{
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
            'messages', JSON.stringify([]),
            (err, reply)=>{
                console.log("Reply when setting room:");
                console.log(reply);
                
                if(reply){
                    resolve({roomID: newRoomID});
                }

                const newRoom = RoomModel.create({
                    roomID: newRoomID,
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
                    videoSource: -100,
                    videoID: "", //holds id most recently played video
                    videoTime: 0, //most recent video time,
                    videoState: CustomStates.UNSTARTED,//most recent state
                    playRate: 1,
                    messages: []
                })
                .then(newRoom=>{
                    resolve({roomID: newRoomID});
                })
                .catch(error=> reject(error));
            }
        );
        });
}

function updateRoomUsers(updatedRoom){
    let status = "";
    redisClient.hmset(updatedRoom.roomID,
        'hostSocketID', updatedRoom.hostSocketID,
        'users', JSON.stringify(updatedRoom.users),
        (err, reply)=>{
            if(!reply) logFailure(`redis-update users in room ${updatedRoom.roomID}`, `Couldn't find the room.`);
            if(err) logFailure(`redis-update users in room ${updatedRoom.roomID}`, err);
            status += "Failed to add to redis.\n";
        }
    );
    RoomModel.updateOne(
        {roomID: updatedRoom.roomID},
        {$set: {
            users: updatedRoom.users,
            hostSocketID: updatedRoom.hostSocketID
        }},
        (err, newRoom)=>{ status += "Failed to update users in mongodb\n" }
    )
    .catch(err=>{
        logFailure(`mongodb-update users in room ${updatedRoom.roomID} to mongodb`, err);
    });
}

function getRoomsList(res){
    let promises = [];    
    const roomArray = []; 
    
    redisClient.keys('*', (err, roomList)=>{
        if(err){
            res.render('error', {err});
            return;
        }
        const keys = Object.keys(roomList);
        // console.log("keys is");
        // console.log(keys);            
        roomList.forEach((roomID)=>{
            promises.push(
                getRoomFromRedis(roomID)
                .then(room=>{
                    if(room.room || !room.roomID) return;

                    return new Promise((resolve, reject)=>{
                        room = convertRedisRoomToObject(room);
                        // console.log("Room is");   
                        // console.log(room);
                        // console.log('***************');
                        try{
                            resolve(roomArray.push(room))
                        } catch (err){
                            reject(err);
                        }
                    });
                })//getroomfromredis.then()
            );//promises.push()
        });//roomlist.foreach                           
        Promise.all(promises)
        .then(_=>{         
            console.log('888888888888888888888888888');
            console.log("PROMISE:");
            console.log(roomArray);
            res.send({rooms: roomArray});
        });
    });
}

function createRedisClient(){
    redisClient = redis.createClient();
    return redisClient;
}

module.exports = {
    updateRoomIfHost,
    redis,
    createRedisClient,
    updateRoomState,
    findRoom,
    becomeHost,
    createEmptyRoom,
    updateRoomUsers,
    getRoomsList
}