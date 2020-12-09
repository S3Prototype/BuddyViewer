var express = require('express');
var bodyparser = require('body-parser');
const router = express.Router();
var events = require('events');
const fs = require('fs');
const e = require('express');

var app = express();

//let rawData = fs.readFileSync('messages.json');

let defaultMessage = {
    "name": "SERVER",
    "message_id": 0,
    "timestamp": "00:00:00 AM",
    "message_data": " ",
    "user_id" : "SERVER_MESSAGE"
};

var port = process.env.PORT || 8092;

app.use(express.static(__dirname));
app.use(bodyparser.json());
app.use(router);
// let messages = [{}];//was: JSON.parse(rawData);
// let takenNames = [];

class NameContainer{
    static #takenNames = [];

    static #pingList = [];

    static addToTakenNames(thisMessage){
        let nameInfo = {
            name : thisMessage.name,
            id : thisMessage.user_id,
            hasBeenPinged : true,
            failedCount : 0
        };
        NameContainer.#takenNames.push(nameInfo);
        // NameContainer.#pingList.push(nameInfo);
        //console.log("USER LIST ID: "+userListID);
    }
    static refreshTakenNames(){
        NameContainer.#takenNames = NameContainer.#takenNames.filter(
            function(name){
                return name != null;
            }
        );
        // NameContainer.#takenNames = refreshedNames;
    }
    static makeNameAvailable(nameToRelease){
        if(!nameToRelease) return;
        // let nameWasFound = false;
        NameContainer.#takenNames = NameContainer.#takenNames.filter(
            function(name){
                return name && name.name != nameToRelease.name
            }
        );
        // NameContainer.#takenNames = newList;
    }
    static isNameAvailable(thisMessage){
        console.log("%%Is Name Available called%%");
        let doesUserOwnIt = false;
        let nameAvailable = true;

        // let tempNames = NameContainer.#takenNames;
        
        for (let i = 0; nameAvailable == true && i < NameContainer.#takenNames.length; i++){
            if (NameContainer.#takenNames[i] &&
                NameContainer.#takenNames[i].name.toUpperCase() == thisMessage.name.toUpperCase()
            ){
                if (NameContainer.#takenNames[i].id == thisMessage.user_id){
                    doesUserOwnIt = true;
                    break;
                } else {
                    nameAvailable = false;
                }//else
            }//if (takenNames ...
        }//for    
        return {canUse : nameAvailable, alreadyOwnedByUser: doesUserOwnIt};
    }
    static validateName(thisMessage, nameToRelease){   
        NameContainer.makeNameAvailable(nameToRelease);
        const currentName = NameContainer.isNameAvailable(thisMessage);// returns an object
        console.log('Is '+thisMessage.name+ ' avail?'+currentName.canUse);
        console.log('| Already owned by this user? '+currentName.alreadyOwnedByUser);

        if(currentName.canUse){//was && nameToRelease
            //If you're changing your name
            // if(thisMessage.name.substr(0, 5) != 'ANON-'){
            if(!currentName.alreadyOwnedByUser){
                NameContainer.addToTakenNames(thisMessage);
            }
        }
        
        return currentName;
    }
    static getTakenNames(){
        return NameContainer.#takenNames;
    }
    static pingName(pName){
        //Check if name and id are in ping list. If not, add it.
        //nameData.name, nameData.id
        // let idHasBeenPinged = false;
        if(!NameContainer.#takenNames) return;
        // console.log("###############");
        // console.log("ID Pinged: "+pName);
        let nameFound = false;
        for(let i = 0; !nameFound && i < NameContainer.#takenNames.length; i++){
            if(NameContainer.#takenNames[i].name == pName){
                // console.log("Failed count: "+NameContainer.#takenNames[i].failedCount);
                NameContainer.#takenNames[i].hasBeenPinged = true;
                NameContainer.#takenNames[i].failedCount = 0;
                nameFound = true;
            }
        }
    }
    static checkPings(){
        if(!NameContainer.#takenNames) return;
        for(let pingedName of NameContainer.#takenNames){
            if(pingedName){
                if(pingedName.hasBeenPinged){
                    pingedName.hasBeenPinged = false;
                    pingedName.failedCount = 0;
                } else {
                    //increment the counter.
                    //and check the counter. if its
                    //too much, delete the name and ID
                    //from the server
                    //But first let's just DC it instantly.
                    //Implement the counter after we make it work.
                    if(pingedName.failedCount > 3){
                        NameContainer.makeNameAvailable(pingedName);
                        console.log("******************");
                        console.log("Ping failed! Deleting: "+pingedName.name);
                    }
                    pingedName.failedCount++;
                }
            }
        }//for
    }
}

class UserListContainer{
    constructor(){
        
    }
    static #userListID;
    static #userList = [];

    static initialize(){
        UserListContainer.#userList = [];
    }
    static generateNewListID(){
        UserListContainer.#userListID = Math.floor(Math.random()* 10000);
    }
    static populateUserList(nameList){
        UserListContainer.#userList = nameList.filter(name=>{
            return name != null;
        });
    }
    static getUserListID(){
        return UserListContainer.#userListID;
    }
    static getUserList(){
        return UserListContainer.#userList;
    }
}

class MessageContainer{
    static #messages = [];

    static initialize(){
        MessageContainer.#messages = [];
    }
    static generateNewMessageID(){
        return Math.floor(Math.random()* 10000);        
    }
    static addMessageToDatabase(thisMessage){
        thisMessage.message_id = MessageContainer.generateNewMessageID();
        MessageContainer.#messages.push(thisMessage);
    }
    static isEmpty(){
        return (MessageContainer.#messages.length <= 0)
    }
    static getMessageList(){
        return MessageContainer.#messages;
    }
}

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

class VideoManager{
    static universalState = CustomStates.UNSTARTED;
    static previousUniversalState = CustomStates.UNSTARTED;
    static universalTime = 0;

    static timeIsWithinRange(time){
        const uniTime = VideoManager.universalTime;
        const bufferRange = 3;
        return time > uniTime - bufferRange && time < uniTime + bufferRange;
    }
    static bufferingID = "EMPTY";
    static universalUrl = "hjcXNK-zUFg";
    static settingsAltered = false;
    static alterID = "";
    static #seekingIDList = [];
    static universalPlaybackRate = 1;
    static universalLooping = false;
    static seekingIDListEmpty = true;
    static #viewerIDList = [];
    static isSeekingIDListEmpty(){
        return !VideoManager.#seekingIDList || VideoManager.#seekingIDList.length <= 0;
    }
    static createSeekingIDList(exemptID){
        VideoManager.#seekingIDList = VideoManager.#viewerIDList.filter(
            function(viewerId){
                return viewerId && viewerId.id != exemptID;
            }
        );
    }
    static removeFromSeekingIDList(idToRemove){
        VideoManager.#seekingIDList = VideoManager.#seekingIDList.filter(
            function(seekingId){
                return seekingId && seekingId.id != idToRemove;
            }
        );
    }
    static isInSeekingIDList(idToCheck){
        let idFound = false;
        for(let i = 0; !idFound && i < VideoManager.#seekingIDList.length; i++){
            if(VideoManager.#seekingIDList[i].id == idToCheck) idFound = true;
        }
        return idFound;
    }
    static destroySeekingIDList(){
        VideoManager.#seekingIDList = [];
    }
    static isViewerIdListEmpty(){
        return !VideoManager.#viewerIDList || VideoManager.#viewerIDList.length <= 0;
    }
    static addToViewerIDList(idToAdd){
        VideoManager.#viewerIDList.push({id: idToAdd, hasBeenPinged: true, failedCount: 0});
    }
    static removeFromViewerIDList(idToRemove){
        VideoManager.#viewerIDList = VideoManager.#viewerIDList.filter(
            function(viewerId){
                return viewerId && viewerId.id != idToRemove;
            }
        );
        VideoManager.removeFromSeekingIDList(idToRemove);         
    }
    static isInViewerIDList(idToCheck){
        let idFound = false;
        for(let i = 0; !idFound && i < VideoManager.#viewerIDList.length; i++){
            if(VideoManager.#viewerIDList[i].id == idToCheck) idFound = true;
        }
        return idFound;
    }
    static pingViewerIDList(id){
        //Check if name and id are in ping list. If not, add it.
        //nameData.name, nameData.id
        // let idHasBeenPinged = false;
        // console.log("###############");
        // console.log("ID Pinged: "+pName);
        if(VideoManager.isViewerIdListEmpty()) return;
        let idFound = false;
        for(let i = 0; !idFound && i < VideoManager.#viewerIDList.length; i++){
            if(VideoManager.#viewerIDList[i].id == id){
                // console.log("Failed count: "+NameContainer.#takenNames[i].failedCount);
                VideoManager.#viewerIDList[i].hasBeenPinged = true;
                VideoManager.#viewerIDList[i].failedCount = 0;
                idFound = true;
            }
        }
    }
    static checkPings(){
        // if(VideoManager.isViewerIdListEmpty()) return;
        for(let pingedID of VideoManager.#viewerIDList){
            if(pingedID){
                if(pingedID.hasBeenPinged){
                    pingedID.hasBeenPinged = false;
                    pingedID.failedCount = 0;
                } else {
                    //increment and check the counter. if its too much,
                    //delete the id from the server. But first let's just
                    //DC it instantly. Implement the counter after we make
                    //it work.
                    if(pingedID.failedCount > 5){
                        VideoManager.removeFromViewerIDList(pingedID.id);
                        console.log("******************");
                        console.log("Video Ping failed! Deleting: "+pingedID.id);
                    }
                    pingedID.failedCount++;
                }
            }
        }//for
    }
}

app.get('/messages', function(req, res){
    // console.log("GET CALLED");
    const messageList = MessageContainer.getMessageList()
    const messageIndex = messageList.length > 0 ? messageList.length - 1 : 0;
    req.body.message = messageList[messageIndex];
    // NameContainer.pingID(req.body.user_id);
    res.send(req.body);
});

app.post('/initialize', function(req, res){

    NameContainer.validateName(req.body, null);
    NameContainer.pingName(req.body.name);
    VideoManager.pingViewerIDList(req.body.user_id);

    res.send("SUCCESS");
});

app.post('/alter-video-settings', function(req, res){
    console.log("CLIENT("+req.body.user_id+") "+"HAS SENT STATE: "+req.body.state);

    VideoManager.universalLooping = req.body.video_looping;
    VideoManager.alterID = req.body.user_id;
    VideoManager.universalPlaybackRate = req.body.video_playbackrate;

    if(req.body.state == CustomStates.SEEKING){
        VideoManager.previousUniversalState = VideoManager.universalState;
        VideoManager.createSeekingIDList(req.body.user_id);
    }

    VideoManager.universalState = req.body.state;
    VideoManager.universalTime = req.body.video_time;

    if(req.body.video_url != VideoManager.universalUrl){
        // VideoManager.universalState = CustomStates.PLAYING;
        VideoManager.universalTime = 0;
    }

    // console.log("SERVER URL: "+VideoManager.universalUrl);
    // console.log("CLIENT URL: "+req.body.video_url);
    
    VideoManager.universalUrl = req.body.video_url;

    // NameContainer.pingName(req.body.name);
    // VideoManager.pingViewerIDList(req.body.user_id);

    let data = {
        name: req.body.name,
        user_id: req.body.user_id,
        state: VideoManager.universalState,
        video_url: VideoManager.universalUrl,
        video_time: VideoManager.universalTime,
        alter_id: VideoManager.alterID,
        video_looping: VideoManager.universalLooping
    }
    
    res.send(data);
});

app.post('/check-server-video-state', function(req, res){

    if(!VideoManager.isInViewerIDList(req.body.user_id)){
        VideoManager.addToViewerIDList(req.body.user_id);
    } else {
        VideoManager.pingViewerIDList(req.body.user_id);
    }

    let data = {
        state: VideoManager.universalState,
        video_time: VideoManager.universalTime,
        video_url: VideoManager.universalUrl,
        alter_id: VideoManager.alterID,
        video_playbackrate: VideoManager.universalPlaybackRate,
        video_looping: VideoManager.universalLooping
    }

    if(VideoManager.universalState == CustomStates.SEEKING){
        if(VideoManager.isSeekingIDListEmpty()){
            VideoManager.universalState = VideoManager.previousUniversalState;
            data.state = VideoManager.previousUniversalState;
        } else {
            if(!VideoManager.isInSeekingIDList(req.body.user_id)){
                data.state = VideoManager.previousUniversalState;
            } else if(VideoManager.timeIsWithinRange(req.body.video_time)) {
                VideoManager.removeFromSeekingIDList(req.body.user_id);
                data.state = VideoManager.previousUniversalState;
            }
        }
    } else {
        if(VideoManager.universalState != CustomStates.PAUSED &&
            VideoManager.timeIsWithinRange(req.body.video_time)){
                VideoManager.universalTime = req.body.video_time;
                data.video_time = req.body.video_time;
        }
    }

    if(VideoManager.universalState == CustomStates.ENDED){
        if(VideoManager.universalLooping){
            data.video_time = 0;
        }
    }

    NameContainer.pingName(req.body.name);
    // console.log("==========================")
    // console.log("STATE ON SERVER: "+data.state);
    // console.log("==========================")
    // console.log("TIME ON SERVER: "+data.video_time);
    // console.log("==========================")
    // console.log("TIME FROM CLIENT: "+req.body.video_time);
    res.send(data);
});

app.post('/server-ping', function(req, res){

    NameContainer.pingName(req.body.name);
    VideoManager.pingViewerIDList(req.body.user_id);

    res.send({
        list : UserListContainer.getUserList(),
        listID : UserListContainer.getUserListID()
    });
});

app.post('/user-list', function(req, res){
    // let nameLength = takenNames.length;
    // let listToSend = [];

    UserListContainer.populateUserList(NameContainer.getTakenNames());
    UserListContainer.generateNewListID();
    NameContainer.pingName(req.body.user_id);
    VideoManager.pingViewerIDList(req.body.user_id);
    //Now because they're checking the user list, ping their id.

    // console.log.("________________");
    // console.log.("PING FROM USERLIST CHECK FOR ID: "+req.body.user_id);
    // NameContainer.pingID(req.body.user_id);
    // takenNames.forEach(function(name, index){
    //     listToSend.push(name);
    // });

    // for(i = 0; nameLength > 0 && i < nameLength; i++){        
    //     if(takenNames[i]){
    //     }
    // }
    res.send({
        list : UserListContainer.getUserList(),
        listID : UserListContainer.getUserListID()
    });
});

app.post('/messages', function(req, res){
    
    const thisMessage = req.body.message;
    const nameToRelease = req.body.name;
    // if(nameToRemove){
    //     removeName(thisMessage);
    // }
    // console.log("NEW MSG("+thisMessage.user_id+")["+ thisMessage.name+"]: "+ thisMessage.message_data);
    // const nameResult = validateName(thisMessage, nameToRelease);
    const nameResult = NameContainer.validateName(thisMessage, nameToRelease);
    // let canUseName = checkIfNameInUse(thisMessage);    
    // console.log("Can use!!: " + canUseName);
    // console.log("===============")
    if (nameResult.canUse){
        UserListContainer.generateNewListID();
        MessageContainer.addMessageToDatabase(thisMessage);
        //if the name is not taken already
        /*This will stop you from using ANY name that
        has already been taken. To make old names reusable,
        we MAY need userIDs to be tracked, but we could also
        just pass the old name along with the request perhaps*/

        //takenNames.push({name : thisMessage.name, id : thisMessage.user_id});
        // thisMessage.message_id = generateNewMessageID();
        // messages.push(thisMessage);
        //console.log(messages.length + " mostrecent: " + req.body_data);
        //console.log(thisMessage.user_id +" Sending: " + thisMessage.message_data);
        // res.send(req.body);
    } else {
        //if the name is taken
        req.body.message = {
            "name": "Error",
            "message_id": -1,
            "timestamp": thisMessage.timestamp,
            "message_data": "Choose a new name! That one is already in use!",
            "user_id" : thisMessage.user_id
        };
    }
    VideoManager.pingViewerIDList(req.body.user_id);
    NameContainer.pingName(thisMessage.user_id);

    res.send(req.body);
});

app.post('/taken-names', function(req, res){
    res.send(nameWasFound);
});

app.delete('/messages', function(req, res){
    //remove the user's name from the server
    const nameToRelease = req.body;
    console.log("USER "+nameToRelease.name+"left the room. Name DELETED");
    if (!nameToRelease){
        //if there's nothing there, just end the call.
        return;
    }

    NameContainer.makeNameAvailable(nameToRelease);
    // makeNameAvailable(nameToRelease);
    UserListContainer.generateNewListID();

    VideoManager.removeFromViewerIDList(req.body.user_id);

    // NameContainer.pingName(nameToRelease.user_id);

    res.send("Delete succeeded.");
});

app.listen(port, function(){
    console.log(`Server listening on: ${port}`);
    console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
    console.log("======");
    setInterval(NameContainer.checkPings, 2500);
    setInterval(VideoManager.checkPings, 500);
});