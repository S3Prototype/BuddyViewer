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

let userWhoSent = null;
let universalSetting = "PAUSE";

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
        if(nameToRelease.user_id == VideoManager.bufferingID){
            VideoManager.bufferingID = "EMPTY";
        }
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

class CustomYTStates{
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
    // -1 (unstarted)
    // 0 (ended)
    // 1 (playing)
    // 2 (paused)
    // 3 (buffering)
    // 5 (video cued)
    static universalState = CustomYTStates.UNSTARTED;
    static universalTime = 0;
    static bufferingID = "EMPTY";
    static universalUrl = "hjcXNK-zUFg";
    static seekingID = "";
    static settingsAltered = false;
    static alterID = "";
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

    var nameValidated;
    if(req.body){
        nameValidated = NameContainer.validateName(req.body, null);
    }

    NameContainer.pingName(req.body.name);

    res.send("SUCCESS");
});

app.post('/alter-video-settings', function(req, res){
    console.log("CLIENT("+req.body.user_id+") "+"HAS SENT STATE: "+req.body.state);
    // if(req.body.state == CustomYTStates.BUFFERING &&
    //     VideoManager.bufferingID == "EMPTY"){
    //     //If someone starts buffering, let the server know who.
    //     VideoManager.bufferingID = req.body.user_id;
    // }

    // if(req.body.state == CustomYTStates.PAUSED){
    //     if(VideoManager.universalState == CustomYTStates.BUFFERING &&
    //         VideoManager.bufferingID == req.body.user_id){
    //             VideoManager.universalState = CustomYTStates.PLAYING;
    //             VideoManager.bufferingID = "EMPTY";
    //     } else {
    //         VideoManager.universalState = CustomYTStates.PAUSED;
    //     }
    // } else {
    //     VideoManager.universalState = req.body.state;
    // }

    // if(req.body.state == CustomYTStates.CUED){
    //     console.log("CUED to "+req.body.video_time);
    //     VideoManager.universalState = req.body.state;
    // }

    // if(req.body.state == CustomYTStates.SEEKING){
    //     VideoManager.seekingID = req.body.user_id;
    // }

    VideoManager.alterID = req.body.user_id;

    VideoManager.universalState = req.body.state;
    
    VideoManager.universalTime = req.body.video_time;

    if(req.body.video_url != VideoManager.universalUrl){
        VideoManager.universalState = CustomYTStates.UNSTARTED;
        VideoManager.universalTime = 0;
    }
    
    VideoManager.universalUrl = req.body.video_url;

    NameContainer.pingName(req.body.name);

    const data = {
        name: req.body.name,
        user_id: req.body.user_id,
        state: VideoManager.universalState,
        video_url: VideoManager.universalUrl,
        video_time: VideoManager.universalTime,
        alter_id: VideoManager.alterID        
    }
    
    res.send("SUCCESS");
});

app.post('/check-server-video-state', function(req, res){

    // if(req.body.state != CustomYTStates.SEEKING &&
    //     (req.body.video_time < VideoManager.universalTime - 5 ||
    //     req.body.video_time > VideoManager.universalTime + 5)){
    //     //If it's within the safe space, we don't need to change the time
    //     // console.log("TIME ON SERVER: "+VideoManager.universalTime);
    //         if(VideoManager.universalState == CustomYTStates.CUED){
    //             //If someone just used the seekTo function, set the
    //             //time anyway.
    //             //Probably need the ID of whoever just used seekTo
    //             //so it's only based on them
    //             VideoManager.universalTime = req.body.video_time;                
    //         }
    // } else {
    //     VideoManager.universalTime = req.body.video_time;
    // }

    //     //If the person who started buffering has now finished, and
    //     //is paused, then we need to tell everyone to play their videos.
    // if(req.body.state == CustomYTStates.PAUSED &&
    //     req.body.user_id == VideoManager.bufferingID){
    //     VideoManager.bufferingID = "EMPTY";
    //     VideoManager.universalState = CustomYTStates.PLAYING;
    // }

    //     //If the person who started seeking is done
    // if(req.body.state != VideoManager.universalState &&
    //     VideoManager.universalState == CustomYTStates.SEEKING){
    //         if(req.body.user_id == VideoManager.seekingID){
    //             //If they finished seeking and switched state, switch
    //             //the universal state to match it.
    //             VideoManager.universalState = req.body.state;
    //         }
    // }


    let data = {
        // user_name : null,
        // user_id : null,
        // state: -
        state: VideoManager.universalState,
        video_time: VideoManager.universalTime,
        video_url: VideoManager.universalUrl,
        alter_id: VideoManager.alterID
    }

    NameContainer.pingName(req.body.name);

    res.send(data);
});

app.post('/server-ping', function(req, res){

    NameContainer.pingName(req.body.name);

    res.send({
        list : UserListContainer.getUserList(),
        listID : UserListContainer.getUserListID()
    });
});

app.get('/user-list', function(req, res){
    // let nameLength = takenNames.length;
    // let listToSend = [];

    UserListContainer.populateUserList(NameContainer.getTakenNames());
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

    NameContainer.pingName(thisMessage.user_id);
    res.send(req.body);
});

app.post('/taken-names', function(req, res){
    res.send(nameWasFound);
});

app.put('/messages/:id', function(req, res){
    res.send("This is a PUT request");
});

app.delete('/messages', function(req, res){
    //remove the user's name from the server
    const nameToRelease = req.body;
    console.log(nameToRelease.name+" DELETED");
    if (!nameToRelease){
        //if there's nothing there, just end the call.
        return;
    }

    NameContainer.makeNameAvailable(nameToRelease);
    // makeNameAvailable(nameToRelease);
    UserListContainer.generateNewListID();

    NameContainer.pingName(nameToRelease.user_id);
    res.send("Delete succeeded.");
});

app.listen(port, function(){
    console.log(`Server listening on: ${port}`);
    console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
    console.log("======");
    setInterval(NameContainer.checkPings, 5000);
});