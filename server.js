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

let takenNames = [{}];

var products = [
    {
        id:1,
        name: 'laptop'
    },
    {
        id:2,
        name: 'microwave'
    }
];

let emptyIds = [];

var currentId = 2;

var port = process.env.PORT || 8090

function isNameAvailable(thisMessage){
    let nameAvailable = true;
    for (i = 0; nameAvailable == true && i < takenNames.length; i++){
        if (takenNames[i] && takenNames[i].name == thisMessage.name){
            /*if the name is already taken, then check if the userID
            matches. If so, then the name belongs to this user.*/
            if (takenNames[i].id == thisMessage.user_id){
                /*if the name is already in use, and it's
                being used by this user, then we're done.*/
                break;
            } else {
                nameAvailable = false;
            }//else
        }//if (takenNames ...
    }//for

    return nameAvailable;
}

function makeNameAvailable(nameToRelease){
    let nameWasFound = false;
    for(i = 0; !nameWasFound && i < takenNames.length; i++){
        
        if(takenNames[i]){
            console.log("NAME TO RELEASE: "+nameToRelease.name);        
            console.log("NAME WE'RE LOOKING AT: "+takenNames[i].name);
            console.log("~~~~~~~~~~~~");
            if(takenNames[i].name == nameToRelease.name){
                console.log("TAKEN NAME: "+takenNames[i].name+" Name to release: "+nameToRelease.name);
                delete takenNames[i];
                nameWasFound = true;
            }
        }  
    }//for
}

function validateName(thisMessage, nameToRelease){
        /*First make sure the current username is safe,
        because the user may have changed their name before
        sending this message.*/
    //let userIsChangingName = nameToRelease ? true : false;
    let canUseName = isNameAvailable(thisMessage);

    console.log("Is "+thisMessage.name+" available?: "+canUseName);
    if (nameToRelease){
        /*If there is a nameToRelease,
        make that name available to the server.*/
        makeNameAvailable(nameToRelease);             
    }

    return canUseName;
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

app.post('/messages', function(req, res){
    
    const thisMessage = req.body.message;
    const nameToRelease = req.body.name;
    // if(nameToRemove){
    //     removeName(thisMessage);
    // }
    console.log("NEW MSG("+thisMessage.user_id+"): "+ thisMessage.message_data);
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

        takenNames.push({name : thisMessage.name, id : thisMessage.user_id});
        thisMessage.message_id = messages.length;
        messages.push(thisMessage);
        //console.log(messages.length + " mostrecent: " + req.body_data);
        //console.log(thisMessage.user_id +" Sending: " + thisMessage.message_data);
        // res.send(req.body);
    } else {
        //if the name is taken
        req.body.message = {
            "name": "Error",
            "message_id": thisMessage.message_id,
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

app.delete('/products/:id', function(req, res){
    let id = req.params.id;
    let found = false;

    products.forEach(function(individualProduct, index){
        if(!found && individualProduct.id === Number(id)){
            products.splice(index, 1);
            found = true;
            emptyIds.push(Number(id));
        }
    });

    res.send('successfully deleted product');
});

app.listen(port, function(){
    // console.log(`Server listening on: ${port}`);
    // console.log(messages[0].message_data);
});