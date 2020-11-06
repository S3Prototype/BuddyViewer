var express = require('express');
var bodyparser = require('body-parser');
var events = require('events');
const fs = require('fs');
const e = require('express');

var app = express();

let rawData = fs.readFileSync('messages.json');
let messages = JSON.parse(rawData);
let mostRecentMessageID = 0
let maxUnwritten = 5;
let isItTimeToWrite = false;

var messageSentEmitter = new events.EventEmitter();
let messageCameFromHere = false;
messageSentEmitter.on('message-sent', function(messageData){
    res.send(messages[messages.length]);
});

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

var port = process.env.PORT || 8084


app.use(express.static(__dirname));
app.use(bodyparser.json());

app.get('/messages', function(req, res){
    // console.log("GET CALLED");
    let messagesLength = messages.length - 1;
    if (messagesLength < 0) messagesLength = 0;
    // console.log(messagesLength);
    res.send(messages[messagesLength]);
});

app.post('/messages', function(req, res){
    req.body.message_id = messages.length;
    messages.push(req.body);
    console.log(messages.length + " mostrecent: " + req.body.message_data);

    //messageSentEmitter.emit('message-sent', req.body);

    res.send(req.body);
});

app.put('/messages/:id', function(req, res){
    //let id = req.params.id;
    //let found = false;
    let newName = req.body.newName;

    products.forEach(function(product, index){
        if(!found && product.id === Number(id)){
            product.name = newName;
        }
    });

    res.send('successfully updated products!');

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