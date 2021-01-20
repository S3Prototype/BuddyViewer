$(function(){
    
        //!Need code to set up the player controls separate from the player itself, checking certain vars like below.
        //!Not sure individual video players should have individual cc settings. Like if one is set to cc active, all should start that way.
    if(parseInt(localStorage.getItem('cc_load_policy')) != 0){
        $('#closed-captions-icon').removeClass("far");        
        $('#closed-captions-icon').addClass("fas");
    }
    if(localStorage.getItem('looping') == 'true'){
        enableLoopingIcon();
        socket.emit('setLooping', true, roomID);
    }

    console.log(`Welcome to ${roomID}`);
    const storedRoomID = localStorage.getItem('roomID');
    console.log(`STORED ID IS ${storedRoomID}`);
    if(storedRoomID && storedRoomID != roomID){        
    } else {
        localStorage.setItem('roomID', roomID);
    }
    
    const maxNameLength = 18;
    $("#name-input").attr("maxlength", maxNameLength);
    let localName = '';
    let userID = null; //localStorage.getItem('userID') || Math.random().toString(36).substring(7);
    let anonName = null; //'USER-' + userID;
    let nameOnServer = null;//anonName;
    let pfp = null;

    const volumeSlider = document.getElementById('volume-slider');                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    
    let mobileMode = false;

    let buddyPlayer = null;

    const playrateText = document.getElementById('playrate-text');

    let socket = {};

    function validateUserID(){
        const savedID = localStorage.getItem('userID');
        console.log("LOCAL STORAGE EXISTS? "+ (savedID&&true));
        if(savedID){
            userID = savedID;
        } else {
            userID = Math.random().toString(36).substring(7);
            localStorage.setItem('userID', userID);
            $('#name-input').val('');//reset name
        }
        /*If we have an ID saved, then we potentially have a name on the
        server. That name would still potentially be saved in our name input.
        If so, get it and make that the nameOnServer. If not, make the anonNAme
        the nameOnServer instead.*/
        anonName = 'USER-' + userID;
        localName = $('#name-input').val() ? $('#name-input').val() : anonName;
        nameOnServer = savedID ? localName : anonName;
        console.log(userID+" Is the ID after validate");
    }

    let foundAClientSideError = false;
    //Set of clientside errors:
    const ANON_NAME_ERR = "You cannot create your own anon name!";

    let timeStamp = 0;
    let messageInput = $('#message-input');
    messageInput.val('');
    let chatTbody = $('#chatbox-tbody');
    let chatTable = $('#chat-table');
    let seenArray = [false, false, false];
    let nameToRemove = null;

    const progressBar = document.getElementById('progress-bar');
    const seekToolTip = document.getElementById('seek-tooltip');

    const videoContainer = document.getElementById('video_container');

    console.log("ROOM ID: "+roomID);
    let tooltipDuration = "00:00";

    const youtubeInput = $('#ytsearch-input');
    const searchResultsContainer = document.getElementById('search-results');

    function changePlayRate(newRate){
        playrateText.innerHTML = newRate +"x";
        // player.setPlaybackRate(newRate)
    }

    let searchInterval;
    let searchCount = 0;

    function keepCheckingForResults(){
        setTimeout(
            _=>ClientYTPlayer.getSearchResults(),
            100); 
    }
    function getSearchResults(){
        $.ajax({
            url: '/get-search-results',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({user_id: userID}, null, 2),
            success: function (results){
                console.log(`${new Date().toLocaleTimeString()} Results are: ${results}`);
                // ClientYTPlayer.currentlySendingData = false;
                if(results){
                    // clearInterval(ClientYTPlayer.searchInterval);
                    console.log(results[0]);
                    ClientYTPlayer.addSearchResults(results);
                    ClientYTPlayer.searchCount = 0;
                } else {
                    ClientYTPlayer.searchCount++;
                    if(ClientYTPlayer.searchCount >= 10){
                        ClientYTPlayer.searchCount = 0;
                        // clearInterval(ClientYTPlayer.searchInterval);
                        //code has failed
                    } else {
                        ClientYTPlayer.keepCheckingForResults();
                    }
                }
                // console.log("("+ new Date().toLocaleTimeString()+") Sendstate from this client done.");
                // initializeYTProgressBar();
                // ClientYTPlayer.clientState = player.getPlayerState();
            }
        });
    }

    function videoSearch(query){
        $.ajax({
            url: '/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({user_id: userID, query: query}, null, 2),
            success: function (results){
            console.log(`${new Date().toLocaleTimeString()} Executed search. Preliminary results are: ${JSON.stringify(results, null, 2)}`);
                // if(!results || results.length < 1){
                //     ClientYTPlayer.keepCheckingForResults();                        
                // } else {
                    console.log(results[0]);
                    ClientYTPlayer.addSearchResults(results);
                    ClientYTPlayer.searchCount = 0;
                // }
            }
        });
    }

    function addSearchResults(results){
        console.log(JSON.stringify("Add search results: "+results, null, 2));
        searchResultsContainer.innerHTML = "";
        results.forEach(function(result){
            const resultDiv = document.createElement('div');
            resultDiv.setAttribute('class', 'result');

            const thumbDiv = document.createElement('div');
            thumbDiv.setAttribute('class', 'result-thumbnail-div');
            resultDiv.append(thumbDiv);

            function addFromResult(){
                ClientYTPlayer.shouldSendState = true;
                ClientYTPlayer.videoTime = 0;
                ClientYTPlayer.thumbnail = result.thumbnail;
                ClientYTPlayer.clientURL = result.videoID;
                ClientYTPlayer.currentState = CustomStates.PLAYING;
                ClientYTPlayer.videoTitle = result.title;
                ClientYTPlayer.addNewVideo();  
                // ClientYTPlayer.videoLength = player.getDuration();
                socket.emit('startNew', {
                    videoTime: 0,
                    videoSource: buddyPlayer.getSource(),
                    videoID: result.videoID,
                    playRate: buddyPlayer.getPlayRate(),
                    videoState: buddyPlayer.getState(),
                    thumbnail: buddyPlayer.getThumbnail(),
                    videoTitle: buddyPlayer.getTitle()
                },
                roomID);
            }

            const thumbnail = document.createElement('img');
            thumbnail.setAttribute('class', 'result-thumbnail');
            thumbnail.setAttribute('src', result.thumbnail);
            thumbnail.addEventListener('click', function(event){
                addFromResult();
            });
            thumbDiv.append(thumbnail)


            const title = document.createElement('span');
            title.setAttribute('class', 'result-title');
            const titleText = document.createTextNode(result.title);
            title.appendChild(titleText);
            title.addEventListener('click', function(event){
                addFromResult();
            });
            resultDiv.append(title);

            const description = document.createElement('span');
            description.setAttribute('class', 'result-description');
            const shortenedDescription = result.description.substring(0, 120) + "..."; 
            const descriptionText = document.createTextNode(shortenedDescription);
            description.appendChild(descriptionText);
            resultDiv.append(description);

            searchResultsContainer.append(resultDiv);
        });
        if(mobileMode){
            document.activeElement.blur();
        }

    }
    
    const bufferBar = document.getElementById('buffer-bar');
    const joinButton = document.getElementById('join-room-button');

    joinButton.addEventListener('click', function(event){
        document.getElementById('join-room-modal').classList.remove('active');
        document.getElementById('join-room-modal-overlay').classList.remove('active');
        initSocket();
    });

    const increasePlayrateButton = document.getElementById('increase-playrate-button');
    const reducePlayrateButton = document.getElementById('reduce-playrate-button');

    increasePlayrateButton.addEventListener('click', function(event){
        const currRate = buddyPlayer.getPlayRate();
        if(currRate == 2) return;
        let nextRate = currRate + 0.25;
        playrateText.innerHTML = nextRate+"x";
        buddyPlayer.setPlayRate(nextRate);
        playRateOptionsShowing = false
        socket.emit('playrateChange', nextRate, roomID);
        console.log("PLAYRATE SHOULD BE: "+nextRate);
    });

    reducePlayrateButton.addEventListener('click', function(event){
        const currRate = buddyPlayer.getPlayRate();
        if(currRate == 0.25) return;
        let nextRate = currRate - 0.25;
        playrateText.innerHTML = nextRate+"x";
        buddyPlayer.setPlayRate(nextRate);
        playRateOptionsShowing = false
        socket.emit('playrateChange', nextRate, roomID);
        // ClientYTPlayer.playbackRate = nextRate;
        // socket.emit('playrateChange', ClientYTPlayer.playbackRate, roomID);
        console.log("PLAYRATE SHOULD BE: "+nextRate);
    });

    const playrateButton = document.getElementById('playrate-button');
    let playRateOptionsShowing = false;
    playrateButton.addEventListener('click', function(event){
        if(inFullScreen) return;
        
        const playrateButtonChildren = document.getElementById('playrate-options').children;
        const playrateButtonArray = Array.from(playrateButtonChildren);
        
        playrateButtonArray.forEach((button)=>{
            button.addEventListener('click', function(event){
                if(inFullScreen) return;
                const xIndex = button.innerHTML.indexOf('x');
                console.log(button.innerHTML);
                const playbackRateValue = parseFloat(button.innerHTML.substring(0, xIndex));
                buddyPlayer.setPlayRate(playbackRateValue);
                playrateDropdown.style.display = 'none';
                playRateOptionsShowing = false;
                playrateText.innerHTML = playbackRateValue +"x";
                socket.emit('playrateChange', playbackRateValue, roomID);
            });
        });

        const playrateDropdown = document.getElementById('playrate-dropdown');
        const videoContainer = document.getElementById('video_container');
        if(playRateOptionsShowing){
            //If it's already showing, toggle it off
            playrateDropdown.style.display = 'none';
        } else {
            //If it's not showing, toggle it on
            playrateDropdown.style.display = 'inline-flex';            
            videoContainer.addEventListener('mouseleave', function(event){
                playrateDropdown.style.display = 'none';
                playRateOptionsShowing = false;
            });
        }
        playRateOptionsShowing = !playRateOptionsShowing;
    });

    function enableLoopingIcon(){
        loopButton.style.color = "white";
    }

    function disableLoopingIcon(){
        loopButton.style.color = "white";
    }

    const loopButton = document.getElementById('loop-button');
    loopButton.addEventListener('click', function(event){
        const alreadyLooping = buddyPlayer.getLooping();
        if(alreadyLooping){
            enableLoopingIcon();
        } else {
            disableLoopingIcon();
        }
        buddyPlayer.setLooping(!alreadyLooping);
        socket.emit('setLooping', buddyPlayer.getLooping(), roomID);
    });

    function tryForYoutube(url){
// const startIndex = url.indexOf('v=') + 2;
        if(url.indexOf('y') != 0 && url.indexOf('https:') != 0){
            //if the url is not the first thing in the text, fail.
            url = null
            return url;
        }
        if(url.includes('&')){
            url = url.substring(0, url.indexOf('&'));
        }

        if(url.includes('v=')){
            url = url.substring(url.indexOf('v=') + 2)
        } else if(url.includes('youtu.be')){
            url = url.substring(url.indexOf('youtu.be/') + 9);
        } else if (url.includes('/embed/')){
            url = url.substring(url.indexOf('/embed/') + 7);
        } else if (url.includes('yt.be/')){
            url = url.substring(url.indexOf('yt.be/') + 6);            
        } else {
            url = null;
        }

        if(url){
            console.log("YOU entered ID: "+url);         
            videoSource = VideoSource.YOUTUBE;
        }

        return url;
    }

    function searchForOtherOne(query){

        //send an ajax request to the server. Try to find the video
        //on youtubedl. If you get nothing, execute a search.
        if(query.indexOf('http') != 0){
            return false;
        }
        console.log('query is '+query);
        $.ajax({
            url: '/otherone',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({query}, null, 2),
            success: result=>{
                createNewPlayer[VideoSource.OTHERONE](result);
                searchResultsContainer.scrollTop = 0;
            },
            error: (xhr, status, error)=>{
                console.log('Failed to get otherone.');
                console.log(error);
            }
        });
        return true;
    }

    function tryforVimeo(url){
        if( url.indexOf('https') == 0 ||
            url.indexOf('vimeo') == 0 ||
            url.indexOf('player') == 0){
                if(url.includes('player')){
                    url = url.substring(url.indexOf('player')+23);
                } else if(url.includes('vimeo')){
                    url = url.substring(url.indexOf('vimeo')+10);
                } else {
                    return null;
                }
                console.log(url);
                videoSource = VideoSource.VIMEO;
        } else {
            return null;
        }

        return url;
    }

    function getIDandSource(url){
        let newID = null;
        let source = buddyPlayer?.getSource() ?? VideoSource.OTHERONE;
        newID = tryForYoutube(url);
        if(newID) source = VideoSource.YOUTUBE;

        // if(!result) result = tryForOtherOne(url);
        if(!newID){
            newID = tryforVimeo(url);
            if(newID) source = VideoSource.VIMEO;
        }

        //Keep checking if !result and trying for others.
        return {newID, source};
    }

    const PlayerScripts = {
        YOUTUBE_A: "https://apis.google.com/js/api.js",
        YOUTUBE_B: "https://www.youtube.com/iframe_api",
        VIMEO: "https://player.vimeo.com/api/player.js",
        SPOTIFY: "https://sdk.scdn.co/spotify-player.js",
        OTHERONE: "",
        TWITCH: "https://player.twitch.tv/js/embed/v1.js"
    };

    $('#ytsearch').on('submit', function(event){
        event.preventDefault();           
        const inputText = youtubeInput.val();
        if(inputText == '') return;
        const {newID, source} = getIDandSource(inputText);
        // console.log("BEFORE NEW VIDEO SET. URL: "+currURL);
        if(newID){
            startNewVideo(newID, source);
        } else {
            console.log("Trying for other one with query: "+inputText);
            if(!searchForOtherOne(inputText)){
                //If we fail to find a video of type other,
                //then do a youtube search.
            }
        }
        //? Do we really need the search here?
        //? It should be in the ajax call code
        //? For when we try to use youtubedl
        // else {
        //     //If we didn't extract a url, search youtube 
        //     console.log("SEARCHING FOR! "+ inputText);
        //     // ClientYTPlayer.videoSearch(inputText);
        // }
    });

    function startNewVideo(videoID, source){
        const data = {
            videoID,
            videoSource: source, 
            videoTitle: "",
            videoTime: 0,
            playRate: 1,
            videoState: CustomStates.PLAYING,
            thumbnail: "",
            roomID
        }
        changeVolumeSettings(source);
        data.volume = volumeSlider.value;
        createNewPlayer[source](data);
        socket.emit('startNew', data, roomID);
    }

    function scriptExists(source){
        //Check if the script already exists
        return $(`script[src="${source}"]`).length > 0;
    }

    function changeVolumeSettings(source){
        let step = 0.01;
        let value = 0.5;
        let max = 1;
        switch(source){
            case VideoSource.YOUTUBE:
                step = 1;
                value = 50;
                max = 100;
            break;
        }
        volumeSlider.setAttribute('step', step);
        volumeSlider.setAttribute('value', value);
        volumeSlider.setAttribute('max', max);
    }

    //Maybe make this an import. Make a JS file that exports
    //these functions in an array. Have createNewPlayer = it.
    //Then you're good.
    createNewPlayer = [
        ytCreatePlayer,
        ytCreatePlayer,
        vimeoCreatePlayer,
        spotifyCreatePlayer,
        otherOneCreatePlayer,
        twitchCreatePlayer
    ];

    function twitchCreatePlayer(data){
        if(buddyPlayer) buddyPlayer.destroy();
        if(!scriptExists(PlayerScripts.TWITCH)){
            loadPlayerScript(PlayerScripts.TWITCH, ()=>{
                loadPlayerScript('../twitchPlayer.js', _=>{
                    buddyPlayer = new TwitchPlayer(data);
                    initializeProgressBar(data.videoDuration);
                    initializeToolTip(data.videoDuration);
                });                            
            });
        } else {
            //Scripts already exist.
            if(data.videoID != buddyPlayer.getID()){
                console.log("Trying to start URL: "+data.videoID);
                console.log("Client URL before change: "+buddyPlayer.getID());                
                buddyPlayer.newVideo(data);
                console.log("End of search submit function");
            }
        }//else 

    }

    function spotifyCreatePlayer(data){
        // if(buddyPlayer) buddyPlayer.destroy();
        // if(!scriptExists(PlayerScripts.SPOTIFY)){
        //     document.addEventListener('spotifyReady', _=>{
        //         loadPlayerScript('../spotifyListener.js', _=>{
        //             console.log("Loading up new spotify, line 457");
        //             buddyPlayer = new SpotifyListener(data);
        //         });
        //     });
        //     loadPlayerScript(PlayerScripts.SPOTIFY, ()=>{
        //         console.log("Spotify loaded!");                
        //     });
        // } else {
        //     //Scripts already exist.
        //     if(data.videoID != buddyPlayer.getID()){
        //         console.log("Trying to start URL: "+data.videoID);
        //         console.log("Client URL before change: "+buddyPlayer.getID());                
        //         buddyPlayer.newVideo(data);
        //         console.log("End of search submit function");
        //     }
        // }//else 
        console.log("Spotify not implemented yet.");
    }
    
    function ytCreatePlayer(data){
        if(buddyPlayer) buddyPlayer.destroy();
        if(!scriptExists(PlayerScripts.YOUTUBE_A)){
            document.addEventListener('ytReady', _=>{
                loadPlayerScript('../youtubeViewer.js', _=>{
                    console.log("Loading up new youtubeviewer, line 444");
                    buddyPlayer = new YouTubeViewer(data);
                });
            });
            loadPlayerScript(PlayerScripts.YOUTUBE_A, ()=>{
                console.log("First script loaded!");
                //must load script b after a.
                loadPlayerScript(PlayerScripts.YOUTUBE_B, ()=>{
                    console.log("Second script loaded!");
                });
            });
        } else {
            //Scripts already exist.
            if(data.videoID != buddyPlayer.getID()){
                console.log("Trying to start URL: "+data.videoID);
                console.log("Client URL before change: "+buddyPlayer.getID());                
                buddyPlayer.newVideo(data);
                console.log("End of search submit function");
            }
        }//else
        timeInterval = setInterval(updateVideoTime, 250);
    }

    function vimeoCreatePlayer(data){
        changeVolumeSettings(data.videoSource);
        if(buddyPlayer) buddyPlayer.destroy();
        if(!scriptExists(PlayerScripts.VIMEO)){
            loadPlayerScript(PlayerScripts.VIMEO, ()=>{
                //Initialize a video.
                loadPlayerScript('../vimeoPlayer.js', _=>{
                    buddyPlayer = new VimeoViewer(data);
                    initializeProgressBar(data.videoDuration);
                    initializeToolTip(data.videoDuration);
                });
            });            
        } else {
            buddyPlayer = new VimeoViewer(data);
            initializeProgressBar(data.videoDuration);
            initializeToolTip(data.videoDuration);
        }
    }

    function loadPlayerScript(scriptURL, callback) {                
        var script = document.createElement("script")
        script.type = "text/javascript";

        if (script.readyState) { //IE
            script.onreadystatechange = function () {
                if (script.readyState == "loaded" || script.readyState == "complete") {
                    script.onreadystatechange = null;
                    callback();
                }
            };
        } else { //Others
            script.onload = function () {
                callback();
            };
        }

        script.src = scriptURL;
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    function otherOneCreatePlayer(otherData){
        changeVolumeSettings(VideoSource.OTHERONE);
        otherData.volume = volumeSlider.value;
        if(buddyPlayer) buddyPlayer.destroy();
        buddyPlayer = new OtherPlayer(otherData);
        // document.getElementById('otherone').play();
        buddyPlayer.play();
        buddyPlayer.showPauseIcon();
        buddyPlayer.setVolume(volumeSlider.value);
        socket.emit('startNew', buddyPlayer.generateData(), roomID);
    }
    
    let inFullScreen = false;
    $('#fullscreen-button').click(function(event){
        if(!document.fullscreenElement){
            const playerElement = document.getElementById('video_container');
            let requestFullScreen = playerElement.requestFullScreen || playerElement.mozRequestFullScreen || playerElement.webkitRequestFullScreen;
            if (requestFullScreen) {
                buddyPlayer.showContractIcon();
                requestFullScreen.bind(playerElement)().then(data=>{
                    // document.getElementById('video_container').setAttribute('rotate', 90);
                });
                // document.getElementById('ytsearch').style.display = 'none';
            }
        }
        else {
            buddyPlayer.showExpandIcon();
            document.exitFullscreen();
            // document.getElementById('ytsearch').style.display = '';
            // document.getElementById('ytsearch').style.removeProperty('display');
        }
        document.activeElement.blur();
        // inFullScreen = !inFullScreen;
    });

    $('#closed-captions-button').click(function(event){
        buddyPlayer.toggleCaptions();
    });

    $('#mute-button').click(function(event){
        if(buddyPlayer.isMuted()){
            // stayMuted = false;
            buddyPlayer.unMute();         
            volumeSlider.value = buddyPlayer.getVolume();
        } else {            
            // stayMuted = true;
            buddyPlayer.mute();              
        }
    });

    $('#sync-button').click(e=>{        
        socket.emit('sync', roomID);
    });

    $('#play-pause-button').click(function(event){
        buddyPlayer.playPause();
        socket.emit('playPause', buddyPlayer.generateData(), roomID);
    });

    function updateVideoTime(){
        if(!buddyPlayer ||
            buddyPlayer.getState() != CustomStates.PLAYING ||
            !buddyPlayer.player){
                return;
            }
        if(!buddyPlayer.isInitialized()){
            initializeToolTip(buddyPlayer.getDuration());
            initializeProgressBar(buddyPlayer.getDuration());
            buddyPlayer.initialized = true;
        }
        const playerTime = Math.round(buddyPlayer.getPlayerTime());
        if(playerTime != buddyPlayer.getSavedTime()){
            buddyPlayer.setSavedTime(playerTime);
        }
        updateTimeUI(playerTime);
        updateBufferBar(buddyPlayer.getBuffered());
    }

    function updateBufferBar(buffVal){
        bufferBar.value = buffVal;
    }
    
    function updateYTProgressBar(updateTime){
        progressBar.value = updateTime;
    }

    function updateSeekToolTip(seekTime){
        let minutes = parseInt(seekTime / 60);
        let seconds = seekTime % 60;
        let hours = 0;
        if(minutes >= 60){
            hours = parseInt(minutes / 60);
            minutes = minutes % 60;
        }

        if(minutes < 10) minutes = "0"+minutes;
        if(seconds < 10) seconds = "0"+seconds;

        let timeDisplay = minutes+":"+seconds;
        if(hours > 0) timeDisplay = hours+":"+timeDisplay;
        
        seekToolTip.textContent = timeDisplay+" | "+tooltipDuration;
    }

    function progressBarScrub(event) {
        const scrubTime = Math.round(
            (event.offsetX / progressBar.offsetWidth) *
            buddyPlayer.getDuration()
        );
        changeTriggeredByControls = true;
        seekAndSetUI(scrubTime);
        socket.emit('seek', scrubTime, roomID);
    }

    function seekAndSetUI(time){
        buddyPlayer.seek(time);
        updateTimeUI(time);
    }

    function updateTimeUI(time){
        progressBar.value = time;
        updateSeekToolTip(time);
    }

    function initializeToolTip(duration){
        const currTime = Math.round(duration);
        let maxMinutes = parseInt(currTime / 60);
        let maxSeconds = currTime % 60;
        let maxHours = 0;
        if(maxMinutes >= 60){
            maxHours = parseInt(maxMinutes / 60);
            maxMinutes = maxMinutes % 60;
        }
        if(maxMinutes < 10) maxMinutes = "0"+maxMinutes;
        if(maxSeconds < 10) maxSeconds = "0"+maxSeconds;
        tooltipDuration = maxMinutes+":"+maxSeconds;
        if(maxHours > 0) tooltipDuration = maxHours+":"+tooltipDuration;
        tooltipInitialized = true;
    }

    function initializeProgressBar(duration){
        const maxTime = Math.round(duration);
        progressBar.setAttribute('max', maxTime);        
        bufferBar.setAttribute('max', maxTime);
    }    

    document.addEventListener('loop', event=>{
        socket.emit('startOver', roomID);
    })

    messageInput.keypress(function(event){
        let code = (event.keyCode ? event.keyCode : event.which);
        if (code == 13 && !event.shiftKey){
            $('#input-form').submit();
        }
    });

    function addMessageToChat(response){
        const chatMessage = response.message;
        let localTimeStamp = new Date().toLocaleTimeString();
        
        if(!chatMessage) return;

        // console.log("THE MESSAGE IS "+chatMessage.message_data);

        if(chatMessage.name == localName){
            //If we were allowed to keep the name we sent,
            nameOnServer = chatMessage.name;
            $('#name-input').attr('placeholder', 'Enter Your Name Here');
            //And we no longer have a name to remove.
            nameToRemove = null;
            messageInput.val(''); //clear the input field
        } else {      
            if(chatMessage.fromAnotherUser){                                
                //If message is from another user
                //Check if it's @-ing anyone.
                const atIndex = chatMessage.message_data.indexOf('@');
                if(atIndex !== -1){
                    let endOfAtIndex = chatMessage.message_data.indexOf(' ', atIndex);
                    if(endOfAtIndex === -1){
                        //If there is no space after @ is called, then
                        endOfAtIndex = chatMessage.message_data.length;
                        //The name that's being @-ed must be the end of the message.
                    }

                    const attedUser = chatMessage.message_data.substring(atIndex+1, endOfAtIndex);
                    // let thisUserHasBeenAtted = false;
                    console.log()
                    if(attedUser == nameOnServer){
                        console.log("USER HAS BEEN ATTED! "+attedUser);
                        //Now we check if we have permission to
                        //send the @ Notification.
                        if(Notification.permission !== "granted"){
                            //If we haven't been granted permission,
                            // Notification.requestPermission()
                        }                        
                        //Now we try to send the @ Notification
                        const atNotification = new Notification("New Message from Watch2Gether Clone!",{
                            body : chatMessage.message_data
                        });

                        window.document.title = "ATTED!";
                    }
                }
            } else {                
                //if we weren't allowed the name, clear it.
                $('#name-input').val('');
                $('#name-input').attr('placeholder', 'Sorry! Try another name!');
            }
        }//else
  

        //Now we insert the data into the table.
        //console.log("YOU KNOW WHO IT IS");
        let chatHTML = '\
                <tr class="chat-row"><td class="chatter-timestamp">['+
                localTimeStamp +']</td>\
                <td class="chatter-name">' + chatMessage.name +
                ': </td><td class="chatter-message">' +
                chatMessage.message_data + '</td></tr>';
             
        chatTbody.append(chatHTML.toString());
        // chatTable.scrollTop(chatTable.height() * chatMessage.message_id);                        
        chatTable.scrollTop(chatTable.height() * seenArray.length);                        
        let messageID = parseInt(chatMessage.message_id);
        console.log("Above message's ID: "+messageID);
        seenArray[messageID] = true;                 
    }

    function clientSideChatError(errorCode){        
        let errorMessage = {
            "message" : {
                "name": "Error",
                "message_id": -1,
                "timestamp": timeStamp,
                "message_data": errorCode,
                "user_id" : userID
            }
        };
        addMessageToChat(errorMessage);
    }

    function checkNameForErrors(){
        let errorDected = false;
        if(localName.substr(0, 5) == 'USER-' && localName != anonName){
            localName = anonName;
            clientSideChatError(ANON_NAME_ERR);
            errorDected = true;
        }
        return errorDected;
    }

    function setName(){        
        localName = $('#name-input').val();

        let nameIsChanged = false;

        let nameHasErrors = checkNameForErrors();
        if(!nameHasErrors){

            /*if there's a client-side error,
            try to catch it*/
            if(localName == ''){
                localName = anonName;           
            }
    
            if (localName != nameOnServer){                        
                //If the name has been changed,
                //tell the server            
                nameToRemove = {"name" : nameOnServer, "id" : userID};
                nameIsChanged = true;
            } else {
                //otherwise there is no name to remove
                nameToRemove = null;
            }
        } else {
            foundAClientSideError = true;
        }

        return(nameIsChanged);
    }

    function changeVolume(event){
        if(!buddyPlayer) return;
        if(buddyPlayer.isMuted()){
            buddyPlayer.unMute();            
        }
        buddyPlayer.setVolume(volumeSlider.value);
    }

    $('#name-form').on('submit', function(event){
        event.preventDefault();
        //setName();
    });

    //PUT/UPDATE
    //message input
    $('#input-form').on('submit', function(event){
        // console.log(messageInput.val());
        event.preventDefault();
        timeStamp = new Date().toLocaleTimeString();
        // messageInput = $('#message-input');
        chatTbody = $('#chatbox-tbody');
        chatTable = $('#chat-table');

        setName();
    
        if(foundAClientSideError){
            //Probably should put code that sends an error
            //into the chat here instead of in setName()
            foundAClientSideError = false;
            return;
        }

        let tempMessage =
        {
                "message" :
                    {
                        "name" : localName,
                        "message_id" : 0,
                        "timestamp" : timeStamp,
                        "message_data" : messageInput.val(),
                        "user_id": userID
                    },
                "name" : nameToRemove
                            
        };//tempMessage

            // $.ajax({
            //     url: '/messages',
            //     method: 'POST',
            //     contentType: 'application/json',
            //     data: JSON.stringify(tempMessage, null, 2),
            //     success: addMessageToChat
            // });       
    });

    window.onbeforeunload = function(event){
        /*doesn't work on IE*/
        let nameToRelease = {
            "name" : nameOnServer,
            "id" : userID
        };
    }

    const bigIcon = 'fa-3x';
    const smallIcon = 'fa-lg';
    window.onresize = function(event){
        if(window.innerWidth < 1000){
            setIconsBig();
            mobileMode = true;
        } else if (window.innerWidth > 1000) {
            setIconsSmall();
            mobileMode = false;
        }
    }

    function setIconsBig(){
            unsetIconSize(smallIcon);
            document.getElementById('play-pause-icon').classList.add(bigIcon);
            document.getElementById('mute-icon').classList.add(bigIcon);
            document.getElementById('closed-captions-icon').classList.add(bigIcon);
            document.getElementById('fullscreen-icon').classList.add(bigIcon);
            document.getElementById('reduce-playrate-icon').classList.add(bigIcon);
            document.getElementById('increase-playrate-icon').classList.add(bigIcon);
            document.getElementById('loop-icon').classList.add(bigIcon);
    }

    function setIconsSmall(){
        unsetIconSize(bigIcon);
        document.getElementById('play-pause-icon').classList.add(smallIcon);
        document.getElementById('mute-icon').classList.add(smallIcon);
        document.getElementById('closed-captions-icon').classList.add(smallIcon);
        document.getElementById('fullscreen-icon').classList.add(smallIcon);
        document.getElementById('reduce-playrate-icon').classList.add(smallIcon);
        document.getElementById('increase-playrate-icon').classList.add(smallIcon);
        document.getElementById('loop-icon').classList.add(smallIcon);
    }

    function unsetIconSize(iconSize){
        document.getElementById('play-pause-icon').classList.remove(iconSize);
        document.getElementById('mute-icon').classList.remove(iconSize);
        document.getElementById('closed-captions-icon').classList.remove(iconSize);
        document.getElementById('fullscreen-icon').classList.remove(iconSize);
        document.getElementById('reduce-playrate-icon').classList.remove(iconSize);
        document.getElementById('increase-playrate-icon').classList.remove(iconSize);
        document.getElementById('loop-icon').classList.remove(iconSize);
    }

    if (/Mobi|Android/i.test(navigator.userAgent)) {
        setIconsBig();
        mobileMode = true;
    }

    function lockScreenOrientation () {
        screen.lockOrientationUniversal =
            screen.lockOrientation ||
            screen.mozLockOrientation ||
            screen.msLockOrientation;

        if (screen.lockOrientationUniversal("landscape-primary")) {
        // Orientation was locked
        } else {
        // Orientation lock failed
        }
    }

    function initSocket(){
        socket = io();
        const userData = {
            localName,
            nameOnServer,
            userID,
            pfp
        };

        console.log(`Trying to join room ${roomID}`);

        socket.emit('joinRoom', userData, roomID);

        socket.on('setLooping', loopValue=>{
            loopValue ? enableLoopingIcon() : disableLoopingIcon();
            buddyPlayer.setLooping(loopValue);
        })
        
        socket.on('initPlayer', data=>{
            if(data.videoTime === undefined) return;
            console.log("I'm trying to init my player.");
            console.log(`Data is: ${JSON.stringify(data, null, 2)}`);
            const {videoState, videoSource, videoID, videoTime, playRate} = data;
            initializeToolTip(data.videoDuration);
            initializeProgressBar(data.videoDuration);
            progressBar.value = Math.round(videoTime);
            updateSeekToolTip(Math.round(videoTime));
            if(!buddyPlayer || buddyPlayer.getSource() != videoSource){
                //* If it's not the same player, then make a new player
                createNewPlayer[videoSource](data);
            } else {
                //We have a buddy player and its the same source.
                if(videoID != buddyPlayer.getID()){
                    data.videoTime = 0;
                    buddyPlayer.newVideo(data);
                    updateTimeUI(videoTime);
                } else {
                    if(videoTime > 0){
                        seekAndSetUI(videoTime);
                    }
                }
            }
        });
    
        socket.on('requestState', requesterSocketID=>{
            console.log("someone requested my state");
            let sendData;
            if(!buddyPlayer){
                sendData = {};
            } else {
                sendData = buddyPlayer?.generateData();
            }
            console.log('Im sending a time of: '+sendData?.videoTime);
            sendData.requesterSocketID = requesterSocketID;
            socket.emit('sendState', sendData);        
        });
    
        socket.on('playrateChange', playRate=>{
            buddyPlayer.setPlayRate(playRate);
        });

        socket.on('playPause', data=>{
            buddyPlayer.playPauseFromServer(data);
        });
    
        socket.on('play', data=>{
            buddyPlayer.playFromServer(data);
        });
    
        const maxGap = 5;
        socket.on('pause', data=>{
            buddyPlayer.pauseFromServer(data);
        });
    
        socket.on('seek', videoTime=>{
            seekAndSetUI(videoTime);
        });
    
        socket.on('startNew', (data)=>{
            const {videoSource, videoTitle,
                videoID, videoTime, playRate,
                videoState, thumbnail, roomID} = data;
            if(!buddyPlayer || buddyPlayer.getSource() != videoSource){
                //* If it's not the same player, then make a new player
                createNewPlayer[videoSource](data);                                              
            } else {
                //if It's the same player, make sure it's a different ID
                if(videoID != buddyPlayer.getID()){
                    console.log("source is set for some reason.");
                    buddyPlayer.newVideo(data);
                } else {
                    buddyPlayer.seek(videoTime);
                    updateTimeUI(videoTime);
                }
            }
        });
    
        socket.on('startOver', _=>{
            seekAndSetUI(0);
            buddyPlayer.play();
        });
    
        socket.on('chatJoined', data=>{
            console.log(JSON.stringify(data));
        });
    }


    let controlsToggled = false;

    initPage();
    
    function initPage(){
        // When window loaded ( external resources are loaded too- `css`,`src`, etc...) 
        // if(document.readyState === "complete"){
            console.log("ready state changed!");
            document.getElementById('join-room-modal').classList.add('active');
            document.getElementById('join-room-modal-overlay').classList.add('active');
            document.addEventListener('videotime', updateVideoTime);
            document.addEventListener('initialize', (event)=>{
                console.log("Initializing toolbars at duration"+buddyPlayer.getDuration());
                updateVideoTime();
                // initializeProgressBar(buddyPlayer.getDuration());
                // initializeToolTip(buddyPlayer.getDuration());
            }, false);
                                  
            validateUserID();        
            volumeSlider.addEventListener("change", changeVolume);
            volumeSlider.addEventListener("input", changeVolume);
            // player.addEventListener("onStateChange", stopYTEvent);
            // ClientYTPlayer.currentState = YT.PlayerState.UNSTARTED;
            // updateSeekToolTip(ClientYTPlayer.videoTime);

            progressBar.addEventListener('click', progressBarScrub);
            const searchBar = document.getElementById('ytsearch');

            videoContainer.addEventListener('mousemove', function(event){
                if(!inFullScreen) return;
                const screenHeight = window.screen.height;
                if(event.screenY < screenHeight*0.85 &&
                    !controlsToggled){
                    videoContainer.style.flexWrap = "wrap";
                } else {
                    videoContainer.style.flexWrap = "nowrap";
                }
            });

            videoContainer.addEventListener('fullscreenchange', function(event){
                inFullScreen ? toggleFullScreenOff() : toggleFullScreenOn();
                inFullScreen = !inFullScreen;
            })

            videoContainer.addEventListener('click', function(eventi){
                /*If you click in the video during fullscreen, bring
                the controls up. After 3 secs, put them away again */
                if(inFullScreen){
                    videoContainer.style.flexWrap = "nowrap";                    
                    controlsToggled = true;
                    setTimeout(()=>{
                        controlsToggled = false;
                        videoContainer.style.flexWrap = "wrap";                    
                    }, 3000);
                }
            });

            document.addEventListener('keypress', function(event){
                let code = (event.code ? event.code : event.key);
                const activeElement = document.activeElement;
                if (code == " " || code == "Space"){
                    if(activeElement.tagName.toLowerCase() != 'input' &&
                        activeElement.tagName.toLowerCase() != 'textarea'){
                        event.preventDefault();
                        const playEvent = new Event('click');
                        document.getElementById('play-pause-button').dispatchEvent(playEvent);
                    }
                }
            });

        // }
    }
});