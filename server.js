const path = require('path');
const http = require('http');
var express = require('express');
var bodyparser = require('body-parser');
const router = express.Router();
// var events = require('events');
// const fs = require('fs');
const e = require('express');
const request = require('request');
// const cheerio = require('cheerio');
require('dotenv').config();
const { google } = require('googleapis');
const { title } = require('process');

const {v4: uuidV4} = require('uuid');

const socketio = require('socket.io');

const rooms = {name:{}};

var app = express();
const server = http.createServer(app);
const io = socketio(server);

//let rawData = fs.readFileSync('messages.json');
let allStatesAligned = true;
let socketCount = 0;

io.on('connection', socket=>{

    socket.on('joinRoom', ({localName, roomID})=>{
        socket.join(roomID);
    })

    socketCount++;

    socket.on('joinChat', userData=>{
        socket.broadcast.emit('chatJoined', `${userData.name} has joined the chat!`);
    });

    socket.on('sendState', data=>{
        if(!allStatesAligned && socketCount > 1){
            io.to(data.socketID).emit('initPlayer', data);
            allStatesAligned = true;
            console.log("STATE SENT");
        }
    });

    function getStateIfNeeded(){
    }                                               

    // getStateIfNeeded();

    socket.on('queryState', data=>{
        if(socketCount > 1){        
            allStatesAligned = false;
            socket.broadcast.emit('getState', socket.id);
        }
    });

    socket.on('playrateChange', playRate=>{
        socket.broadcast.emit('playrateChange', playRate);
    });

    socket.on('play', videostate=>{
        socket.broadcast.emit('play', videostate);
    });

    socket.on('pause', videostate=>{
        socket.broadcast.emit('pause', videostate);
    });

    socket.on('seek', time=>{
        socket.broadcast.emit('seek', time);
    });

    socket.on('message', letterArray=>{
        console.log(letterArray);
    });

    socket.on('startOver', time=>{
        socket.broadcast.emit('startOver', time);
    });

    socket.on('startNew', data=>{
        socket.broadcast.emit('startNew', data);
    });

    socket.on('disconnect', _=>{
        socketCount--;
    });
});

var port = process.env.PORT || 8092;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public/')));
app.use(bodyparser.json());
app.use(router);

app.get('/watch', (req, res)=>{
    res.redirect(`/watch.html?roomID=${uuidV4()}`);
});

app.post('/room', (req, res)=>{
    rooms[req.body.room] = {users: {}};
    res.redirect(res.body.room);
});

app.get('/watch?:roomID', (req, res)=>{
    res.render('watch', {roomID: req.params.roomID});
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

class YouTubeSearchManager{
    static searchResults = [];
}

app.post('/search', function(req, res){
    // console.log(`${new Date().toLocaleTimeString()} Searching for: ${JSON.stringify(req.body, null, 2)}`);
    // console.log('===================================');    
    google.youtube('v3').search.list({
        key: process.env.YOUTUBE_TOKEN,
        part: "snippet",
        q: req.body.query,
        maxResults: 20
    }).then((res)=>{
        const searchData = [];
        const { data } = res;
        data.items.forEach(function(item){
            if(item.id.kind == "youtube#video"){
                const snippet = item.snippet;
                searchData.push({
                    title: snippet.title,
                    description: snippet.description,
                    published: snippet.publishedAt,
                    thumbnail: snippet.thumbnails['high'].url,
                    videoID: item.id.videoId
                });
            }
        });
        YouTubeSearchManager.searchResults[req.body.user_id] = searchData;
    })
    .catch(e=>console.log(e));
    res.send(YouTubeSearchManager.searchResults[req.body.user_id]);
});

app.post('/get-search-results', function(req, res){
    
    const results = YouTubeSearchManager.searchResults[req.body.user_id];
    if(results){
        results.forEach(result=>console.log(`${new Date().toLocaleTimeString()} Result is: ${JSON.stringify(result, null, 2)}`));
        YouTubeSearchManager.searchResults[req.body.user_id] = null;
    }// if(results) YouTubeSearchManager.searchResults[req.body.user_id] = null;

    res.send(results);
});

server.listen(port, function(){
    console.log(`Server listening on: ${port}`);
    console.log("Server start date/time: "+new Date().toLocaleDateString() + " / " + new Date().toLocaleTimeString());
    console.log("======");
    // setInterval(NameContainer.checkPings, 2500);
    // setInterval(VideoManager.checkPings, 1000);
});