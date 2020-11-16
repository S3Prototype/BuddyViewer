var express = require('express');
var bodyparser = require('body-parser');
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

// let messages = [{}];//was: JSON.parse(rawData);
// let takenNames = [];

class NameContainer{
    static #takenNames = [];
    constructor(){ 
        
    }

    static initialize(){
        NameContainer.#takenNames = [];
    }

    static addToTakenNames(thisMessage){
        NameContainer.#takenNames.push({name : thisMessage.name, id : thisMessage.user_id});
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
            if (NameContainer.#takenNames[i] && NameContainer.#takenNames[i].name == thisMessage.name){
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
        console.log('Is '+thisMessage.name+ ' available?: \
        '+currentName.canUse+'| Already owned? '+currentName.alreadyOwnedByUser);

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
    constructor(){

    }

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
        // const allMessages = MessageContainer.#messages;
        return MessageContainer.#messages;
    }
}

var port = process.env.PORT || 8090;

app.use(express.static(__dirname));
app.use(bodyparser.json());

app.get('/messages', function(req, res){
    // console.log("GET CALLED");
    const messageList = MessageContainer.getMessageList()
    const messageIndex = messageList.length > 0 ? messageList.length - 1 : 0;
    req.body.message = messageList[messageIndex];
    res.send(req.body);
});

app.post('/initialize', function(req, res){

    var nameValidated;
    if(req.body){
        nameValidated = NameContainer.validateName(req.body, null);
    }

    res.send("SUCCESS");
});

app.get('/user-list', function(req, res){
    // let nameLength = takenNames.length;
    // let listToSend = [];

    UserListContainer.populateUserList(NameContainer.getTakenNames());

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
    if (!req.body){
        //if there's nothing there, just end the call.
        return;
    }

    NameContainer.makeNameAvailable(nameToRelease);
    // makeNameAvailable(nameToRelease);
    UserListContainer.generateNewListID();
    res.send("Delete succeeded.");
});

app.listen(port, function(){
    console.log(`Server listening on: ${port}`);
    console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
    console.log("======");
});