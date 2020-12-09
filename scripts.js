$(function(){

    const maxNameLength = 18;
    $("#name-input").attr("maxlength", maxNameLength);
    let letterArray = ["a", "b", "c", "x", "y", "z"];
    let localName = '';
    let userID = null; //localStorage.getItem('userID') || Math.random().toString(36).substring(7);
    let anonName = null; //'USER-' + userID;
    let nameOnServer = null;//anonName;

    const volumeSlider = document.getElementById('volume-slider');


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

        /*Used for verifying if we need to send the
        anonName to the serverlist, typically because
        we've just loaded the page.*/
    let serverListInitialized = false;

    let foundAClientSideError = false;
    //Set of clientside errors:
    const ANON_NAME_ERR = "You cannot create your own anon name!";

    // console.log(userID);

    let timeStamp = 0;
    let messageInput = $('#message-input');
    messageInput.val('');
    let chatTbody = $('#chatbox-tbody');
    let chatTable = $('#chat-table');
    let seenArray = [false, false, false];
    let nameToRemove = null;

    let userListTable = $('#userlist-table');
    let userListTbody = $('#userlist-tbody');
    let mostRecentListID = 0;

    const progressBar = document.getElementById('progress-bar');
    const seekToolTip = document.getElementById('seek-tooltip');
    let tooltipInitialized = false;

    const videoContainer = document.getElementById('video_container');

    const fullscreenButton = document.getElementById('fullscreen-button');

    const CustomStates = {
        UNSTARTED : -1,
        ENDED : 0,
        PLAYING : 1,
        PAUSED : 2,
        BUFFERING : 3,
        CUED : 5,
        SEEKING : 6
    };
    let changeTriggeredByControls = false;
    let progressBarInitialized = false;
    let playerInitialized = false;
    let tooltipDuration = "00:00";

    const youtubeInput = $('#ytsearch-input');

    class ClientYTPlayer{
        static currentState;
        static playerInfo = {
            user_name : null,
            user_id : null,
            video_time: 0,
            state: -1
        };
        static options = {
            enablejsapi: 1,
            autoplay: 0,
            rel: 0,
            controls: 0,
            origin: 'https://62f28e5b2373.ngrok.io/',
            cc_load_policy: 0,
            cc_lang_pref: 'en',
            disablekb: 1,
            modestbranding: 1
        };
        static playbackRate = 1;
        static videoTime = 0;
        static currentlySendingData = false;
        static clientURL = "hjcXNK-zUFg";
        static pingInterval = null;
        // static CustomState = {
        //     SEEKING: 6
        // };
        static videoDuration;
        static looping = false;

        static timeShouldBeSaved = false;

        static shouldSendState = true;

        static previousState = CustomStates.UNSTARTED;

        static initNewPlayer(event){
            // event.target.addEventListener("onStateChange", ClientYTPlayer.SendStateToServer);
            console.log("initNewPlayer STARTED");            
            event.target.playVideo();
            initializeYTProgressBar();
            initializeToolTip();
            // ClientYTPlayer.previousState = ClientYTPlayer.currentState;
            // ClientYTPlayer.currentState = CustomStates.PLAYING;
            // document.getElementById('play-pause-icon').className = "fas fa-pause";
            player.setVolume(parseInt(volumeSlider.value));
            playerInitialized = true;
            // if(ClientYTPlayer.timeShouldBeSaved){
            //     //if we're changing the closedcaptions, basically
            //     player.seekTo(ClientYTPlayer.videoTime);
            //     ClientYTPlayer.updateTimeUI(ClientYTPlayer.videoTime);
            //     ClientYTPlayer.timeShouldBeSaved = false;
            // } else {
            //         //If we're not changing the closedcaptions, set
            //         //it to playing
            //     // ClientYTPlayer.currentState = CustomStates.PLAYING;
            //     // document.getElementById('play-pause-icon').className = "fas fa-pause";
            // }
            // ClientYTPlayer.SendStateToServer(event);
            if(ClientYTPlayer.shouldSendState){
                console.log("SHOULD BE SENDING DATA");
                ClientYTPlayer.previousState = ClientYTPlayer.currentState;
                ClientYTPlayer.currentState = CustomStates.PLAYING;
                document.getElementById('play-pause-icon').className = "fas fa-pause";
                ClientYTPlayer.SendStateToServer(event);
            } else {
                console.log("WE ARE NOT SENDING DATA");
                ClientYTPlayer.currentState = ClientYTPlayer.previousState;
                player.seekTo(ClientYTPlayer.videoTime);
                ClientYTPlayer.updateTimeUI(ClientYTPlayer.videoTime);
                // ClientYTPlayer.timeShouldBeSaved = false;
                ClientYTPlayer.shouldSendState = true;
            }
            ClientYTPlayer.pingInterval = setInterval(pingVideoSetting, 200);
            console.log("initNewPlayer ENDED");            
        }
        static extractID(url){
            const startIndex = url.indexOf('v=') + 2;
            if(url.includes('v=')){
                url = url.substring(url.indexOf('v=') + 2)
            } else if(url.includes('youtu.be')){
                url = url.substring(url.indexOf('youtu.be/') + 9);
            } else if (url.includes('/embed/')){
                url = url.substring(url.indexOf('/embed/') + 7);
            } //could use url = url.substring(blahblah) || url;

            console.log("YOU entered ID: "+url);
            if(url.includes('&')){
                url = url.substring(0, url.indexOf('&'));
            } 
            return url;
        }
        static addNewVideo(){
            // $('#container').html("<div id='player'></div>");
            // const currURL = ClientYTPlayer.extractID(player.getVideoUrl());
            // if(currURL == ClientYTPlayer.clientURL) return;
            ClientYTPlayer.currentlySendingData = ClientYTPlayer.shouldSendState;
            console.log("ADD NEW VIDEO STARTED");
                player.destroy();
                playerInitialized = false;
                clearInterval(ClientYTPlayer.pingInterval);
                player = new YT.Player('player', {
                    height: '100%',
                    width: '100%',
                    videoId: ClientYTPlayer.clientURL,
                    events: {
                      'onReady': ClientYTPlayer.initNewPlayer,
                      "onStateChange": stopYTEvent,
                      "start": ClientYTPlayer.videoTime
                    },        
                    playerVars: ClientYTPlayer.options
                  });
            console.log("ADD NEW VIDEO ENDED");
            // ClientYTPlayer.SendStateToServer({});
        }
        static getTime(){
            if(!player || !playerInitialized){
                return 0;
            } else{
                return player.getCurrentTime();
            }
        }
        static updateTimeInterval = null;
        static updateTimeUI(time){
            ClientYTPlayer.videoTime = time;
            updateYTProgressBar(time);
            updateSeekToolTip(time);
        }
        static getYTPlayerState(){
            // if(ClientYTPlayer.currentState == ClientYTPlayer.CustomState.SEEKING){
            //     return ClientYTPlayer.CustomState.SEEKING;
            // } else {
            //     ClientYTPlayer.currentState = player.getPlayerState();
            //     return player.getPlayerState();
            // }

            return ClientYTPlayer.currentState;
        }
        static SendStateToServer(event){

            ClientYTPlayer.currentlySendingData = true;
            // ClientYTPlayer.currentState = ;            
            let sendData = {
                "name" : nameOnServer,
                "user_id" : userID,
                "state" : ClientYTPlayer.currentState,
                "video_time" : ClientYTPlayer.videoTime,
                "video_url": ClientYTPlayer.clientURL,
                "video_playbackrate": ClientYTPlayer.playbackRate,
                "video_looping": ClientYTPlayer.looping
            };

            //Here we check if the state is anything weird.

            console.log("("+ new Date().toLocaleTimeString()+") TELL SERVER TO "+sendData.state);
            $.ajax({
                url: '/alter-video-settings',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(sendData, null, 2),
                success: function (response){
                    ClientYTPlayer.currentlySendingData = false;
                    console.log("("+ new Date().toLocaleTimeString()+") Sendstate from this client done.");
                    initializeYTProgressBar();
                    // ClientYTPlayer.clientState = player.getPlayerState();
                }
            });
        }
        static alignWithServerState(response){
            //If ytplayer not made yet, or the person who altered server
            //state last was me, just end it.
            if(!player) return;
            if(!progressBarInitialized) initializeYTProgressBar();

            // console.log("PLAYBACK RATE IS NOW: "+player.getPlaybackRate());
            const serverState = response.state;
            const serverTime = Math.round(response.video_time);
            const serverURL = response.video_url;
            const serverPlaybackRate = response.video_playbackrate;
            ClientYTPlayer.looping = response.video_looping;
            const loopingButton = document.getElementById('loop-button');
            if(ClientYTPlayer.looping){
                loopingButton.style.color = "white"
            } else {
                loopingButton.style.color = "gray";
            }

            if(serverURL != ClientYTPlayer.clientURL){
                ClientYTPlayer.clientURL = ClientYTPlayer.extractID(serverURL);
                if(serverState != CustomStates.PLAYING){
                    ClientYTPlayer.videoTime = serverTime;
                }                
                ClientYTPlayer.shouldSendState = false;
                ClientYTPlayer.addNewVideo();
                return;
            }
            
            if(serverState != ClientYTPlayer.currentState){
                console.log("("+ new Date().toLocaleTimeString()+") RECEIVED STATE "+serverState);                
                changeTriggeredByControls = true;
                if(serverState == YT.PlayerState.PLAYING){
                    ClientYTPlayer.currentState = serverState;
                    player.playVideo();
                    document.getElementById('play-pause-icon').className = "fas fa-pause";
                } else if(serverState == YT.PlayerState.PAUSED){
                    ClientYTPlayer.currentState = serverState;
                    player.pauseVideo();
                    document.getElementById('play-pause-icon').className = "fas fa-play";
                } else if(serverState == YT.PlayerState.SEEKING){
                    ClientYTPlayer.currentState = serverState;
                    player.seekTo(serverTime);
                    ClientYTPlayer.updateTimeUI(serverTime);                    
                    const seekIcon = serverTime > ClientYTPlayer.videoTime ? "fas fa-forward" : "fas fa-backward";
                    document.getElementById('play-pause-icon').className = seekIcon;                    
                }
            } else if(serverState == ClientYTPlayer.currentState) {
            }

            if(serverState == CustomStates.ENDED){
                if(ClientYTPlayer.looping){
                    ClientYTPlayer.currentState = CustomStates.PLAYING;
                    ClientYTPlayer.videoTime = 0;
                    document.getElementById('play-pause-icon').className = "fas fa-pause";
                    player.seekTo(0);
                    player.playVideo();
                    ClientYTPlayer.SendStateToServer({})
                }
            }
                
            const currTime = ClientYTPlayer.videoTime;
            // console.log("TIME NOW IS: "+currTime +"| SERVER TIME: "+serverTime);
            if(currTime < serverTime - 5 || currTime > serverTime + 5){
                // console.log("Adjusting client to server time");
                // console.log("==================");
                // console.log(`Client time: ${currTime} | Server time: ${serverTime}`);
                // console.log("==================");
                player.seekTo(serverTime);
                if(serverState == CustomStates.PAUSED){
                    player.pauseVideo();
                }
                ClientYTPlayer.updateTimeUI(serverTime);                    
            }

            if(serverPlaybackRate != ClientYTPlayer.playbackRate){
                ClientYTPlayer.playbackRate = serverPlaybackRate;
                player.setPlaybackRate(serverPlaybackRate);
                document.getElementById('playrate-text').innerHTML = serverPlaybackRate +"x";
            }

            
            // ClientYTPlayer.currentState = player.getPlayerState();
        }
    }

    function pingVideoSetting(){
        if(!player) return;
        if(ClientYTPlayer.currentlySendingData) return;

        const playerData = {
            "name" : nameOnServer,
            "user_id" : userID,
            "state" : ClientYTPlayer.currentState,
            "video_time": ClientYTPlayer.videoTime,
            "video_url": ClientYTPlayer.clientURL,
        };
        $.ajax({
            url: '/check-server-video-state',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(playerData, null, 2),
            success: function (response){
                if(ClientYTPlayer.currentlySendingData) return;
                ClientYTPlayer.alignWithServerState(response); 
            }
        });

    }

    const bufferBar = document.getElementById('buffer-bar');

    const joinButton = document.getElementById('join-room-button');

    joinButton.addEventListener('click', function(event){
        // ClientYTPlayer.pingInterval = setInterval(pingVideoSetting, 200);
        document.getElementById('join-room-modal').classList.remove('active');
        document.getElementById('join-room-modal-overlay').classList.remove('active');
        
        const state = ClientYTPlayer.currentState;
        if(state == CustomStates.PLAYING){
            player.playVideo();
            document.getElementById('play-pause-icon').className = "fas fa-pause";
        } else if(state == CustomStates.PAUSED){
            player.pauseVideo();
            document.getElementById('play-pause-icon').className = "fas fa-play";
        }

        initializeYTProgressBar();
        initializeToolTip();

    });

    const increasePlayrateButton = document.getElementById('increase-playrate-button');
    const reducePlayrateButton = document.getElementById('reduce-playrate-button');
    
    const playrateText = document.getElementById('playrate-text');

    increasePlayrateButton.addEventListener('click', function(event){
        const currRate = player.getPlaybackRate();
        if(currRate == 2) return;
        let nextRate = currRate + 0.25;
        playrateText.innerHTML = nextRate+"x";
        player.setPlaybackRate(nextRate);
        playRateOptionsShowing = false
        ClientYTPlayer.playbackRate = nextRate;
        ClientYTPlayer.SendStateToServer({});
        console.log("PLAYRATE SHOULD BE: "+nextRate);
    });

    reducePlayrateButton.addEventListener('click', function(event){
        const currRate = player.getPlaybackRate();
        if(currRate == 0.25) return;
        let nextRate = currRate - 0.25;
        playrateText.innerHTML = nextRate+"x";
        player.setPlaybackRate(nextRate);
        playRateOptionsShowing = false
        ClientYTPlayer.playbackRate = nextRate;
        ClientYTPlayer.SendStateToServer({});
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
                player.setPlaybackRate(playbackRateValue);
                ClientYTPlayer.playbackRate = playbackRateValue;
                ClientYTPlayer.SendStateToServer({});
                playrateDropdown.style.display = 'none';
                playRateOptionsShowing = false;
                playrateText.innerHTML = playbackRateValue +"x";
                //Now set the clientytplayer playrate and send state to server below
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

    const loopButton = document.getElementById('loop-button');
    loopButton.addEventListener('click', function(event){
        const alreadyLooping = ClientYTPlayer.looping;
        if(alreadyLooping){
            loopButton.style.color = "gray";
        } else {
            loopButton.style.color = "white";
        }
        ClientYTPlayer.looping = !alreadyLooping
        console.log("LOOPING: "+ClientYTPlayer.looping);
        ClientYTPlayer.SendStateToServer({});
    });

    $('#ytsearch').on('submit', function(event){
        event.preventDefault();           
        const newVid = youtubeInput.val();
        if(newVid.length <= 0) return;
        const currURL = ClientYTPlayer.extractID(newVid);
        console.log("BEFORE NEW VIDEO SET. URL: "+currURL);
        if(currURL != ClientYTPlayer.clientURL){
            console.log("Trying to start URL: "+currURL);
            console.log("Client URL before change: "+ClientYTPlayer.clientURL);
            ClientYTPlayer.clientURL = currURL;
            console.log("Client URL after change: "+ClientYTPlayer.clientURL);
            ClientYTPlayer.shouldSendState = true;
            console.log("Client should send? "+ClientYTPlayer.shouldSendState);
            ClientYTPlayer.addNewVideo();
            console.log("End of search submit function");
        }
    });
    let inFullScreen = false;
    
    $('#fullscreen-button').click(function(event){
        if(!inFullScreen){
            const playerElement = document.getElementById('video_container');
            let requestFullScreen = playerElement.requestFullScreen || playerElement.mozRequestFullScreen || playerElement.webkitRequestFullScreen;
            if (requestFullScreen) {
                document.getElementById('fullscreen-icon').class = "fas fa-compress";
                requestFullScreen.bind(playerElement)();
                document.activeElement.blur();
                // document.getElementById('ytsearch').style.display = 'none';
            }
        }
        else {
            document.getElementById('fullscreen-icon').class = "fas fa-expand";
            document.exitFullscreen();
            // document.getElementById('ytsearch').style.display = '';
            // document.getElementById('ytsearch').style.removeProperty('display');
        }
        // inFullScreen = !inFullScreen;
    });

    $('#closed-captions-button').click(function(event){
        if(ClientYTPlayer.options.cc_load_policy != 1){
            ClientYTPlayer.options.cc_load_policy = 1;
            ClientYTPlayer.options.cc_lang_pref = "en";
            document.getElementById('closed-captions-icon').className = "fas fa-closed-captioning";
        } else {
            ClientYTPlayer.options.cc_load_policy = 0;
            document.getElementById('closed-captions-icon').className = "far fa-closed-captioning";
        }
        // ClientYTPlayer.timeShouldBeSaved = true;
        ClientYTPlayer.shouldSendState = false;
        ClientYTPlayer.addNewVideo();
    });

    $('#mute-button').click(function(event){
        if(player.isMuted()){
            player.unMute();
            document.getElementById('mute-icon').className = "fas fa-volume-up";
        } else {            
            player.mute();            
            document.getElementById('mute-icon').className = "fas fa-volume-mute";
        }
    });

    $('#play-pause-button').click(function(event){
        if(!player){
            console.log("PLAY BUTTON FAILED")
            return;  
        }

        if(!progressBarInitialized){
            initializeYTProgressBar();
        }
        if(!tooltipInitialized){
            initializeToolTip();
            player.setVolume(parseInt(volumeSlider.value));
        }

        changeTriggeredByControls = true;
        if(ClientYTPlayer.currentState == YT.PlayerState.PLAYING){
            if(inFullScreen){
                videoContainer.style.flexWrap = "nowrap";
                controlsToggled = true;
                setTimeout(()=>{
                    controlsToggled = false;
                    videoContainer.style.flexWrap = "wrap";                    
                }, 3000);
            }
            ClientYTPlayer.currentState = YT.PlayerState.PAUSED;
            player.pauseVideo();
            document.getElementById('play-pause-icon').className = "fas fa-play";
            ClientYTPlayer.SendStateToServer({});
        } else if(ClientYTPlayer.currentState == YT.PlayerState.UNSTARTED){
            ClientYTPlayer.currentState = YT.PlayerState.PLAYING;
            player.playVideo();
            document.getElementById('play-pause-icon').className = "fas fa-pause";
            ClientYTPlayer.SendStateToServer({});
        } else if(ClientYTPlayer.currentState == YT.PlayerState.PAUSED){
            ClientYTPlayer.currentState = YT.PlayerState.PLAYING;
            player.playVideo();
            document.getElementById('play-pause-icon').className = "fas fa-pause";
            ClientYTPlayer.SendStateToServer({});
        } else if(ClientYTPlayer.currentState == CustomStates.ENDED){
            ClientYTPlayer.currentState = CustomStates.PLAYING;
            ClientYTPlayer.videoTime = 0;
            player.seekTo(ClientYTPlayer.videoTime);
            player.playVideo();
            document.getElementById('play-pause-icon').className = "fas fa-pause";
            ClientYTPlayer.SendStateToServer({});     
        }
    });


    function updateYTVideoTime(){
        if(!player || !player.getCurrentTime ||
            ClientYTPlayer.currentState == YT.PlayerState.ENDED ||
            ClientYTPlayer.currentState == YT.PlayerState.UNSTARTED){
                return;
        }
        const playerTime = player.getCurrentTime();
        if(Math.round(playerTime) != ClientYTPlayer.videoTime){
            ClientYTPlayer.updateTimeUI(playerTime);
        }
        const bufferedTime = player.getVideoLoadedFraction() * player.getDuration();
        updateYTBufferBar(bufferedTime);
    }

    function updateYTBufferBar(updateTime){
        bufferBar.value = updateTime;
    }

    function updateYTProgressBar(updateTime){
        //You can just pass the value because youtube's
        //.getCurrentTime() always returns the value in seconds
        progressBar.value = updateTime;
    }

    function updateSeekToolTip(seekTime){
        const time = Math.round(seekTime);
        let minutes = parseInt(time / 60);
        let seconds = time % 60;

        if(minutes < 10) minutes = "0"+minutes;
        if(seconds < 10) seconds = "0"+seconds;
        
        seekToolTip.textContent = minutes+":"+seconds+" | "+tooltipDuration;        
    }

    function progressBarYTScrub(event) {
        if(!progressBarInitialized) initializeYTProgressBar();
        const scrubTime = (event.offsetX / progressBar.offsetWidth) * player.getDuration();
        changeTriggeredByControls = true;
        player.seekTo(scrubTime);
        ClientYTPlayer.currentState = CustomStates.SEEKING;
        ClientYTPlayer.updateTimeUI(scrubTime);
        ClientYTPlayer.SendStateToServer({});
    }

    function initializeToolTip(){
        if(!player.getDuration){
            tooltipInitialized = false;
            return;
        }
        const currTime = Math.round(player.getDuration());
        let maxMinutes = parseInt(currTime / 60);
        let maxSeconds = currTime % 60;
        if(maxMinutes < 10) maxMinutes = "0"+maxMinutes;
        if(maxSeconds < 10) maxSeconds = "0"+maxSeconds;
        tooltipDuration = maxMinutes+":"+maxSeconds;
        tooltipInitialized = true;
    }

    function initializeYTProgressBar(){
        if(!player.getDuration){
            progressBarInitialized = false;
            return;
        }
        const maxTime = Math.round(player.getDuration());
        progressBar.setAttribute('max', maxTime);        
        progressBarInitialized = true;
        bufferBar.setAttribute('max', maxTime);
    }

    function stopYTEvent(event){
        playerInitialized = true;
        if(event.data == CustomStates.ENDED){
            ClientYTPlayer.currentState = event.data;
            if(ClientYTPlayer.looping){
                ClientYTPlayer.videoTime = 0;
            }
            document.getElementById('play-pause-icon').className = "fas fa-play";
            ClientYTPlayer.SendStateToServer({});                
        }
        // console.log("BEFORE anything: "+event.data);
        // if(event.data == YT.PlayerState.BUFFERING){                    
        //     return;
        // }

        //     //If event is what the state already is, that's fine.
        // if(ClientYTPlayer.currentState == event.data){
        //     return;
        // } else {    
        //     //If event doesn't match state, it's been triggered
        //     //externally, so we do the reverse.
        //     switch(event.data){
        //         case YT.PlayerState.PLAYING:
        //             event.target.pauseVideo();
        //             break;
        //         case YT.PlayerState.PAUSED:
        //             event.target.playVideo();
        //             break;
        //     }
        // }
        // if(changeTriggeredByControls){
        //     changeTriggeredByControls = false;
        //     return;                
        // }

        // if(event.data == YT.PlayerState.PLAYING){
        //     changeTriggeredByControls = true;
        //     console.log("PAUSING");
        //     event.target.pauseVideo();                    
        // } else if (event.data == YT.PlayerState.PAUSED){
        //     changeTriggeredByControls = true;
        //     console.log("PLAYING");
        //     event.target.playVideo();
        // }
    }

    messageInput.keypress(function(event){
        let code = (event.keyCode ? event.keyCode : event.which);
        if (code == 13 && !event.shiftKey){
            $('#input-form').submit();
        }
    });

    function updateServerList(response){
        const incUserList = response.list;             
        const listID = response.listID;
        // if(listID != mostRecentListID){
        //     console.log('LIST: '+incUserList.length+' ID: '+listID);
        // }
        let i = 0;
        if(incUserList && incUserList.length > 0
           && listID != mostRecentListID){
            userListTbody.empty();
            incUserList.forEach(function(user, index){
                // let user = incUserList[i];
                // let userListHTML = '\
                // <tr class="userlist-row"><td class="userlist-username">'+
                // user.name +'(</td>\
                // <td class="userlist-userid">' + user.id +
                // ')</td> <td class="userlist-index">[' + index +']\
                // </td></tr>';

                let userListHTML = '\
                <tr class="userlist-row"><td class="userlist-name">'+
                user.name +'('+user.id +')</td></tr>'; 
                userListTbody.append(userListHTML.toString());
                // userListTable.scrollTop(chatTable.height() * chatMessage.message_id);                        
                // let messageID = parseInt(chatMessage.message_id);
                // seenArray[messageID] = true;                          
                // console.log("USER: "+user.name+"("+user.id+") ADDED TO LIST("+i+")");
                i++;
            });
            mostRecentListID = listID;
            //console.log();
        }//if
    }

    function checkForMessages(){
        let checkData = {
            "name" : nameOnServer,
            "user_id" : userID,
            "initialized" : serverListInitialized
        }
        $.ajax({
            url: '/messages',
            method: 'GET',
            contentType: 'application/json',
            data: JSON.stringify(checkData, null, 2),
            success: function (response){
                let incMessage = response.message;
                if(!incMessage) return;
                incMessage.fromAnotherUser = true;
                if(incMessage.message_id){
                    let localID = parseInt(incMessage.message_id);
                    if(incMessage.name != nameOnServer && !seenArray[localID]){
                        console.log("Response: " + incMessage.message_data);
                        addMessageToChat(response);
                        if(isNaN(localID)) console.log("LOCAL ID BROKE!");                    
                        seenArray[localID] = true;
                    }
                }
            }
        });
    }

    function checkForUserList(){
        // player.playVideo();
        let checkData = {
            "name" : nameOnServer,
            "user_id" : userID,
            "initialized" : serverListInitialized
        }
        $.ajax({
            url: '/user-list',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(checkData, null, 2),
            success: function (response){                  
                updateServerList(response);
            }//success: function
        });      
        serverListInitialized = true;
    }

    // const initializeInterval = setInterval(initializeServerList, 300);

    function initializeServerList(){
        console.log("("+new Date().toLocaleTimeString()+") Server List Initialized");
        // if(!serverListInitialized){
            $.ajax({
                url: '/initialize',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({"name" : nameOnServer, "user_id" : userID}, null, 2),
                success: function (response){                    
                    serverListInitialized = true;
                }
            });
        // } else {
        //     clearInterval(initializeInterval);
        // }
        // clearInterval(initializeInterval);

    }

    function pingServer(){
        $.ajax({
            url: '/server-ping',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({"name" : nameOnServer, "user_id" : userID}, null, 2),
            success: function (response){
                updateServerList(response);
            }
        });
    }

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
        if(!player) return;
        if(player.isMuted()){
            player.unMute();
            document.getElementById('mute-icon').className = "fas fa-volume-up";
        }
        player.setVolume(parseInt(volumeSlider.value));
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

            $.ajax({
                url: '/messages',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(tempMessage, null, 2),
                success: addMessageToChat
            });       
    });

    window.onbeforeunload = function(event){
        /*doesn't work on IE*/
        //if the user closes the window
 
        // if(nameOnServer == anonName){
        //     return;//If it's the anonName, nothing to do
        // }
        let nameToRelease = {
            "name" : nameOnServer,
            "id" : userID
        };

        $.ajax({
            url: '/messages',
            method: 'DELETE',
            contentType: 'application/json',
            data: JSON.stringify(nameToRelease, null, 2),
            success: function(response){
                console.log(this.url);
            }
        });//$.ajax

    }

    let controlsToggled = false;
    document.addEventListener('readystatechange', event => { 
    
        // When window loaded ( external resources are loaded too- `css`,`src`, etc...) 
        if(event.target.readyState === "complete"){            

            validateUserID();
            initializeServerList();

            volumeSlider.addEventListener("change", changeVolume);
            volumeSlider.addEventListener("input", changeVolume)
            // volumeSlider.addEventListener("mousemove", );

            ClientYTPlayer.pingInterval = setInterval(pingVideoSetting, 200);
        
            setInterval(pingServer, 2500);
        
            setInterval(checkForMessages, 500);
        
            setInterval(checkForUserList, 650);
            player.addEventListener("onStateChange", stopYTEvent);
            ClientYTPlayer.currentState = YT.PlayerState.UNSTARTED;

            setInterval(updateYTVideoTime, 500);

            initializeYTProgressBar();
            progressBar.addEventListener('click', progressBarYTScrub);
            inFullScreen = false;

            // const mouseDetector = document.getElementById('fullscreen-mouse-detector');
            // const videoControls = document.getElementById('video_controls');
            const searchBar = document.getElementById('ytsearch');

            videoContainer.addEventListener('mousemove', function(event){
                // console.log(new Date().toLocaleTimeString()+" mouse moved at: "+event.screenY);
                if(!inFullScreen) return;
                const screenHeight = window.screen.height;
                // console.log(videoContainer.style.flexWrap);
                if(event.screenY < screenHeight*0.85 &&
                    !controlsToggled){
                    videoContainer.style.flexWrap = "wrap";
                } else {
                    videoContainer.style.flexWrap = "nowrap";
                }
            });

            document.addEventListener('fullscreenchange', function(event){
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
                    if(activeElement.tagName.toLowerCase() != 'input'){
                        event.preventDefault();
                        const playEvent = new Event('click');
                        document.getElementById('play-pause-button').dispatchEvent(playEvent);
                    }
                }
            });

            document.getElementById('join-room-modal').classList.add('active');
            document.getElementById('join-room-modal-overlay').classList.add('active');
        }
    });

});