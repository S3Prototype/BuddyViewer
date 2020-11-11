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

let messages = [{}];//was: JSON.parse(rawData);
let takenNames = [];

userListID = 0;

let nameBelongsToUser = false;

// let userList = [{}];
// userList.hasChanged = false;

var port = process.env.PORT || 8090;

function isNameAvailable(thisMessage){
    console.log("%%Is Name Available called%%");
    let nameAvailable = true;
    for (i = 0; nameAvailable == true && i < takenNames.length; i++){
        if (takenNames[i] && takenNames[i].name == thisMessage.name){
            /*if the name is already taken, then check if the userID
            matches. If so, then the name belongs to this user.*/
            if (takenNames[i].id == thisMessage.user_id){
                /*if the name is already in use, and it's
                being used by this user, then we're done.*/
                nameBelongsToUser = true;
                break;
            } else {
                nameAvailable = false;
            }//else
        }//if (takenNames ...
    }//for

    return nameAvailable;
}

function makeNameAvailable(nameToRelease){
    console.log("**Make name available called**")
    let nameWasFound = false;
    for(i = 0; !nameWasFound && i < takenNames.length; i++){        
        if(takenNames[i]){
            console.log("NAME TO RELEASE: "+nameToRelease.name);        
            console.log("NAME WE'RE LOOKING AT: "+takenNames[i].name);
            console.log("~~~~~~~~~~~~");
            if(takenNames[i].name == nameToRelease.name){
                console.log("RELEASING: "+takenNames[i].name);
                console.log("BECAUSE IT MATCHED: "+nameToRelease.name);
                delete takenNames[i];
                nameWasFound = true;
            }
        }  
    }//for
}

function addToTakenNames(thisMessage){
    // userList.push({name : thisMessage.name, id : thisMessage.user_id});
    // userList.hasChanged = true;
    takenNames.push({name : thisMessage.name, id : thisMessage.user_id});
    console.log("USER LIST ID: "+userListID);
}

function generateNewListID(){
    userListID = Math.floor(Math.random()* 10000);
}

function generateNewMessageID(){
    return Math.floor(Math.random()* 10000);
}

function validateName(thisMessage, nameToRelease){
        /*First make sure the current username is safe,
        because the user may have changed their name before
        sending this message.*/
        // console.log("BEFORE ANY CHECKS, THIS");
        // console.log("IS THE NAME TO RELEASE: " + nameToRelease.name);

    nameBelongsToUser = false;
        
    if(nameToRelease){
        // console.log("MAKING NAME AVAILABLE: "+nameToRelease.name);
        // if(nameToRelease.name.substr(0, 5) != 'ANON-'){
            // console.log("MAKING NAME AVAILABLE: "+nameToRelease.name);
            /*If it's not an anon-name.
             Other users can't have the same anon name
             anyway.*/
            /*If there is a nameToRelease,
            make that name available to the server.*/       
            makeNameAvailable(nameToRelease);  
        //  }      
    }
        //let userIsChangingName = nameToRelease ? true : false;
    let canUseName = isNameAvailable(thisMessage);
    console.log('Is '+thisMessage.name+ ' available?: \
    '+canUseName);

    if(canUseName && !nameBelongsToUser){//was && nameToRelease
        //If you're changing your name
        //if(thisMessage.name.substr(0, 5) != 'ANON-'){
            addToTakenNames(thisMessage);
            generateNewListID();
        //}
    }
    
    return canUseName;
}

function addMessageToDatabase(thisMessage){
    thisMessage.message_id = generateNewMessageID();
    messages.push(thisMessage);
}

app.use(express.static(__dirname));
app.use(bodyparser.json());

app.get('/messages', function(req, res){
    // console.log("GET CALLED");
    let messagesLength = messages.length - 1;
    if (messagesLength < 0){
        //If there are no messages:
        messagesLength = 0;
    }
    // console.log(messagesLength);
    //send the latest message.
    //This bullshit will not work when the message
    //id's are not sequential numbers
    req.body.message = messages[messagesLength];
    res.send(req.body);
});

app.post('/initialize', function(req, res){

    let nameValidated = false;
    if(req.body){
        nameValidated = validateName(req.body, null);
    }

    res.send("SUCCESS");
});

app.get('/user-list', function(req, res){
    // let nameLength = takenNames.length;
    let listToSend = [];

    takenNames.forEach(function(name, index){
        listToSend.push(name);
    });

    // for(i = 0; nameLength > 0 && i < nameLength; i++){        
    //     if(takenNames[i]){
    //     }
    // }
    res.send({list : listToSend, listID : userListID});
});

app.post('/messages', function(req, res){
    
    const thisMessage = req.body.message;
    const nameToRelease = req.body.name;
    // if(nameToRemove){
    //     removeName(thisMessage);
    // }
    console.log("NEW MSG("+thisMessage.user_id+")["+ thisMessage.name+"]: "+ thisMessage.message_data);
    let canUseName = validateName(thisMessage, nameToRelease);
    // let canUseName = checkIfNameInUse(thisMessage);    
    console.log("Can use!!: " + canUseName);
    console.log("===============")
    if (canUseName){
        //if the name is not taken already
        /*This will stop you from using ANY name that
        has already been taken. To make old names reusable,
        we MAY need userIDs to be tracked, but we could also
        just pass the old name along with the request perhaps*/

        //takenNames.push({name : thisMessage.name, id : thisMessage.user_id});
        // thisMessage.message_id = generateNewMessageID();
        // messages.push(thisMessage);
        addMessageToDatabase(thisMessage);
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

    makeNameAvailable(nameToRelease);
    generateNewListID();
    res.send("Delete succeeded.");
});

app.listen(port, function(){
    // console.log(`Server listening on: ${port}`);
    // console.log(messages[0].message_data);
});