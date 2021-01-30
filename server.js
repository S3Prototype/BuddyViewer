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

const socketManager = require('./utils/socketManager');

const roomExpTime = 60*60*24;
const searchExpTime = 60*15;

const redisMongoQueries = require('./utils/redisMongoQueries');

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

const io = socketManager.createIO(server);

class RoomSecurity{
    static OPEN = 0;
    static LOCKED = 1;
    static PRIVATE = 2;
}

const defaultDescription = "A lovely room for watching videos! Join!";
const defaultSecuritySetting = RoomSecurity.OPEN;

io.on('connection', socket=>{
    socketManager.initIO(socket);
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
    redisMongoQueries.createEmptyRoom(securityResult, roomName, roomDescription, rawID)
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
    redisMongoQueries.getRoomsList(res, true);
});

app.post('/getYouTubeInfo', (req, res)=>{
    const options = [];
    ytsrGetOneResult(req.body.videoID, res);
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