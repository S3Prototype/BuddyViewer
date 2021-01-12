$(function(){
    
    console.log(`Welcome to ${roomID}`);
    const storedRoomID = localStorage.getItem('roomID');
    console.log(`STORED ID IS ${storedRoomID}`);
    if(storedRoomID && storedRoomID != roomID){
        // $.ajax({
        //     url: '/check-saved-roomID',
        //     method: 'POST',
        //     contentType: 'application/json',
        //     data: JSON.stringify({storedRoomID, currRoomID: roomID}, null, 2),
        //     success: function(res){
        //         console.log("RESULT IS "+res.shouldRedirect);
        //         if(res.shouldRedirect){
        //             const roomIndex = location.href.indexOf('2/') + 2;
        //             const linkWithoutRoom = window.location.href.substring(0, roomIndex);
        //             location.href = linkWithoutRoom+storedRoomID;
        //         }
        //     }
        // });
    } else {
        localStorage.setItem('roomID', roomID);
    }

    const VideoSource = {
        YOUTUBE: 1,
        VIMEO: 2,
        TWITTER: 3,
        OTHERONE: 4
    }
    let videoSource = VideoSource.YOUTUBE;
    let previousSource = VideoSource.YOUTUBE;
    
    const maxNameLength = 18;
    $("#name-input").attr("maxlength", maxNameLength);
    let localName = '';
    let userID = null; //localStorage.getItem('userID') || Math.random().toString(36).substring(7);
    let anonName = null; //'USER-' + userID;
    let nameOnServer = null;//anonName;
    let pfp = null;

    const volumeSlider = document.getElementById('volume-slider');
    let stayMuted = false;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
    let mobileMode = false;

    const playrateText = document.getElementById('playrate-text');

    let socket = {};
    
    // socket.emit('message', letterArray);

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

    console.log("ROOM ID: "+roomID);

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
    const searchResultsContainer = document.getElementById('search-results');

    function changePlayRate(newRate){
        playrateText.innerHTML = newRate +"x";
        player.setPlaybackRate(newRate)
    }

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
            cc_load_policy: parseInt(localStorage.getItem('cc_load_policy')) || 0,
            cc_lang_pref: localStorage.getItem('cc_lang_pref') || 'en',
            disablekb: 1,
            modestbranding: 1,
            mute: 1
        };
        
        static videoTitle = "";
        static videoLength = 0;
        static playbackRate = 1;
        static videoTime = 0;
        static currentlySendingData = false;
        static clientURL = "hjcXNK-zUFg";
        static pingInterval = null;
        static thumbnail = "";
        // static CustomState = {
        //     SEEKING: 6
        // };
        static videoDuration;
        static looping = localStorage.getItem('looping') == 'true';

        static timeShouldBeSaved = false;

        static shouldSendState = true;

        static previousState = CustomStates.UNSTARTED;

        static initNewPlayer(event){
            // event.target.addEventListener("onStateChange", ClientYTPlayer.SendStateToServer);
            console.log("initNewPlayer STARTED");
            initializeYTProgressBar();
            initializeToolTip();
            player.seekTo(ClientYTPlayer.videoTime);
            ClientYTPlayer.updateTimeUI(ClientYTPlayer.videoTime);
            // event.target.playVideo();            
            if(ClientYTPlayer.currentState == CustomStates.PLAYING ||
                ClientYTPlayer.currentState == CustomStates.UNSTARTED ||
                ClientYTPlayer.currentState == CustomStates.ENDED)
            {
                playVideo();
            } else {
                pauseVideo();
            }

            changePlayRate(ClientYTPlayer.playbackRate);

            console.log(`Starting video with state: ${ClientYTPlayer.currentState}`);
            console.log("===================");

            // ClientYTPlayer.previousState = ClientYTPlayer.currentState;
            // ClientYTPlayer.currentState = CustomStates.PLAYING;
            // document.getElementById('play-pause-icon').className = "fas fa-pause";
            player.setVolume(parseInt(volumeSlider.value));
            playerInitialized = true;

            while(!progressBarInitialized){
                initializeYTProgressBar();
            }

            while(!tooltipInitialized){
                initializeToolTip();
            }
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
            // if(ClientYTPlayer.shouldSendState){
            //     console.log("SHOULD BE SENDING DATA");
            //     ClientYTPlayer.previousState = ClientYTPlayer.currentState;
            //     ClientYTPlayer.currentState = CustomStates.PLAYING;
            //     document.getElementById('play-pause-icon').classList.remove("fa-play");
            //     document.getElementById('play-pause-icon').classList.add("fa-pause");
            //     ClientYTPlayer.SendStateToServer(event);
            // } else {
            //     console.log("WE ARE NOT SENDING DATA");
            //     // ClientYTPlayer.currentState = ClientYTPlayer.previousState;
            //     player.seekTo(ClientYTPlayer.videoTime);
            //     ClientYTPlayer.updateTimeUI(ClientYTPlayer.videoTime);
            //     // ClientYTPlayer.timeShouldBeSaved = false;
            //     ClientYTPlayer.shouldSendState = true;
            // }

            // if(ClientYTPlayer.currentState == CustomStates.PLAYING){
            //     document.getElementById('play-pause-icon').classList.remove("fa-play");
            //     document.getElementById('play-pause-icon').classList.add("fa-pause");
            // } else if (ClientYTPlayer.currentState == CustomStates.PAUSED){
            //     player.pauseVideo();
            // }
            // stayMuted || player.unMute();
            player.unMute();
                //Where do we clear the ping interval first?
            // ClientYTPlayer.pingInterval = setInterval(pingVideoSetting, 200);
            // console.log("initNewPlayer ENDED");            
        }
        static extractID(url){
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

            if(url) console.log("YOU entered ID: "+url);            

            return url;
        }
        static addNewVideo(){
            // $('#container').html("<div id='player'></div>");
            // const currURL = ClientYTPlayer.extractID(player.getVideoUrl());
            // if(currURL == ClientYTPlayer.clientURL) return;

            tooltipInitialized = false;
            progressBarInitialized = false;
            ClientYTPlayer.currentlySendingData = ClientYTPlayer.shouldSendState;
            // console.log("ADD NEW VIDEO STARTED");
                player.destroy();
                playerInitialized = false;
                // clearInterval(ClientYTPlayer.pingInterval);
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
            // console.log("ADD NEW VIDEO ENDED");
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

        static searchInterval;
        static searchCount = 0;

        static keepCheckingForResults(){
            setTimeout(
                _=>ClientYTPlayer.getSearchResults(),
                100); 
        }

        static getSearchResults(){
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

        static videoSearch(query){
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

        static addSearchResults(results){
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
                        videoID: result.videoID,
                        playRate: ClientYTPlayer.playbackRate,
                        videoState: ClientYTPlayer.currentState,
                        thumbnail: ClientYTPlayer.thumbnail,
                        videoTitle: ClientYTPlayer.videoTitle
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
                    // ClientYTPlayer.shouldSendState = true;
                    // ClientYTPlayer.clientURL = result.videoID;
                    // ClientYTPlayer.addNewVideo();
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
        static SendStateToServer(event){

            // ClientYTPlayer.currentlySendingData = true;
            // // ClientYTPlayer.currentState = ;            
            // let sendData = {
            //     "name" : nameOnServer,
            //     "user_id" : userID,
            //     "state" : ClientYTPlayer.currentState,
            //     "video_time" : ClientYTPlayer.videoTime,
            //     "video_url": ClientYTPlayer.clientURL,
            //     "video_playbackrate": ClientYTPlayer.playbackRate,
            //     "video_looping": ClientYTPlayer.looping
            // };

            // //Here we check if the state is anything weird.

            // console.log("("+ new Date().toLocaleTimeString()+") TELL SERVER TO "+sendData.state);
            // $.ajax({
            //     url: '/alter-video-settings',
            //     method: 'POST',
            //     contentType: 'application/json',
            //     data: JSON.stringify(sendData, null, 2),
            //     success: function (response){
            //         console.log(`${new Date().toLocaleTimeString()} Reults are: ${response.name}`);
            //         ClientYTPlayer.currentlySendingData = false;
            //         // ClientYTPlayer.addSearchResults(response.results);
            //         console.log("("+ new Date().toLocaleTimeString()+") Sendstate from this client done.");
            //         initializeYTProgressBar();
            //         // ClientYTPlayer.clientState = player.getPlayerState();
            //     }
            // });
        }
        static alignWithServerState(response){
            // //If ytplayer not made yet, or the person who altered server
            // //state last was me, just end it.
            // if(!player) return;
            // if(!progressBarInitialized) initializeYTProgressBar();

            // // console.log("PLAYBACK RATE IS NOW: "+player.getPlaybackRate());
            // const serverState = response.state;
            // const serverTime = Math.round(response.video_time);
            // const serverURL = response.video_url;
            // const serverPlaybackRate = response.video_playbackrate;
            // ClientYTPlayer.looping = response.video_looping;
            // const loopingButton = document.getElementById('loop-button');
            // if(ClientYTPlayer.looping){
            //     loopingButton.style.color = "white"
            //     localStorage.setItem('looping', "true");
            // } else {
            //     loopingButton.style.color = "gray";
            //     localStorage.setItem('looping', "false");
            // }
            

            // if(serverURL != ClientYTPlayer.clientURL){
            //     ClientYTPlayer.clientURL = serverURL;
            //     if(serverState != CustomStates.PLAYING){
            //         ClientYTPlayer.videoTime = serverTime;
            //     }                
            //     ClientYTPlayer.shouldSendState = false;
            //     ClientYTPlayer.addNewVideo();
            //     return;
            // }
            
            // if(serverState != ClientYTPlayer.currentState){
            //     console.log("("+ new Date().toLocaleTimeString()+") RECEIVED STATE "+serverState);                
            //     changeTriggeredByControls = true;
            //     if(serverState == YT.PlayerState.PLAYING){
            //         ClientYTPlayer.currentState = serverState;
            //         player.playVideo();
            //         document.getElementById('play-pause-icon').classList.remove("fa-play");
            //         document.getElementById('play-pause-icon').classList.add("fa-pause");
            //     } else if(serverState == YT.PlayerState.PAUSED){
            //         ClientYTPlayer.currentState = serverState;
            //         player.pauseVideo();
            //         document.getElementById('play-pause-icon').classList.remove("fa-pause");
            //         document.getElementById('play-pause-icon').classList.add("fa-play");
            //     } else if(serverState == YT.PlayerState.SEEKING){
            //         ClientYTPlayer.currentState = serverState;
            //         player.seekTo(serverTime);
            //         ClientYTPlayer.updateTimeUI(serverTime);                    
            //         // const seekIcon = serverTime > ClientYTPlayer.videoTime ? "fas fa-forward" : "fas fa-backward";
            //         // document.getElementById('play-pause-icon').className = seekIcon;                    
            //     }
            // } else if(serverState == ClientYTPlayer.currentState) {
            // }

            // if(serverState == CustomStates.ENDED){
            //     if(ClientYTPlayer.looping){
            //         ClientYTPlayer.currentState = CustomStates.PLAYING;
            //         ClientYTPlayer.videoTime = 0;
            //         document.getElementById('play-pause-icon').classList.remove("fa-play");
            //         document.getElementById('play-pause-icon').classList.add("fa-pause");
            //         player.seekTo(0);
            //         player.playVideo();
            //         ClientYTPlayer.SendStateToServer({})
            //     }
            // }
                
            // const currTime = ClientYTPlayer.videoTime;
            // // console.log("TIME NOW IS: "+currTime +"| SERVER TIME: "+serverTime);
            // if(currTime < serverTime - 5 || currTime > serverTime + 5){
            //     // console.log("Adjusting client to server time");
            //     // console.log("==================");
            //     // console.log(`Client time: ${currTime} | Server time: ${serverTime}`);
            //     // console.log("==================");
            //     player.seekTo(serverTime);
            //     if(serverState == CustomStates.PAUSED){
            //         // player.pauseVideo();
            //     }
            //     ClientYTPlayer.updateTimeUI(serverTime);                                   
            // }

            // if(serverPlaybackRate != ClientYTPlayer.playbackRate){
            //     ClientYTPlayer.playbackRate = serverPlaybackRate;
            //     player.setPlaybackRate(serverPlaybackRate);
            //     document.getElementById('playrate-text').innerHTML = serverPlaybackRate +"x";
            // }

            
            // // ClientYTPlayer.currentState = player.getPlayerState();
        }
    }

    function pingVideoSetting(){
        // if(!player) return;
        // if(ClientYTPlayer.currentlySendingData) return;

        // const playerData = {
        //     "name" : nameOnServer,
        //     "user_id" : userID,
        //     "state" : ClientYTPlayer.currentState,
        //     "video_time": ClientYTPlayer.videoTime,
        //     "video_url": ClientYTPlayer.clientURL,
        // };
        // $.ajax({
        //     url: '/check-server-video-state',
        //     method: 'POST',
        //     contentType: 'application/json',
        //     data: JSON.stringify(playerData, null, 2),
        //     success: function (response){
        //         if(ClientYTPlayer.currentlySendingData) return;
        //         ClientYTPlayer.alignWithServerState(response); 
        //     }
        // });

    }

    const bufferBar = document.getElementById('buffer-bar');
    const joinButton = document.getElementById('join-room-button');

    joinButton.addEventListener('click', function(event){
        // ClientYTPlayer.pingInterval = setInterval(pingVideoSetting, 200);
        document.getElementById('join-room-modal').classList.remove('active');
        document.getElementById('join-room-modal-overlay').classList.remove('active');
        initSocket();
        // socket.emit('queryState', {}, roomID);
        // const state = ClientYTPlayer.currentState;
        // if(state == CustomStates.PLAYING){
        //     // player.playVideo();
        //     document.getElementById('play-pause-icon').classList.remove("fa-play");
        //     document.getElementById('play-pause-icon').classList.add("fa-pause");
        // } else if(state == CustomStates.PAUSED){
        //     // player.pauseVideo();
        //     document.getElementById('play-pause-icon').classList.remove("fa-pause");
        //     document.getElementById('play-pause-icon').classList.add("fa-play");
        // }

        // initializeYTProgressBar();
        // initializeToolTip();

    });

    const increasePlayrateButton = document.getElementById('increase-playrate-button');
    const reducePlayrateButton = document.getElementById('reduce-playrate-button');
    
    increasePlayrateButton.addEventListener('click', function(event){
        const currRate = player.getPlaybackRate();
        if(currRate == 2) return;
        let nextRate = currRate + 0.25;
        playrateText.innerHTML = nextRate+"x";
        player.setPlaybackRate(nextRate);
        playRateOptionsShowing = false
        ClientYTPlayer.playbackRate = nextRate;
        // ClientYTPlayer.SendStateToServer({});
        socket.emit('playrateChange', ClientYTPlayer.playbackRate, roomID);
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
        socket.emit('playrateChange', ClientYTPlayer.playbackRate, roomID);
        // ClientYTPlayer.SendStateToServer({});
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
                // ClientYTPlayer.SendStateToServer({});
                playrateDropdown.style.display = 'none';
                playRateOptionsShowing = false;
                playrateText.innerHTML = playbackRateValue +"x";
                socket.emit('playrateChange', ClientYTPlayer.playbackRate, roomID);
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
        // ClientYTPlayer.SendStateToServer({});
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

    function tryForOtherOne(url){
        
        let viewKeyIndex = url.indexOf('viewkey=');
        if(viewKeyIndex > -1){
            url = url.substring(viewKeyIndex+8);
            // let viewKeyVal = url.substring(viewKeyIndex, viewKeyIndex+8);
            // url = url.substring(0, url.indexOf('view_video'));
            // url = url + 'embed/'+viewKeyVal;
            videoSource = VideoSource.OTHERONE;
        } else {
            return null;
        }

        return url;
    }

    function extractID(url){
        let result = null;
        
        result = tryForYoutube(url);

        if(!result) result = tryForOtherOne(url);
        //Keep checking if !result and trying for others.

        return result;
    }

    $('#ytsearch').on('submit', function(event){
        event.preventDefault();           
        const inputText = youtubeInput.val();
        if(inputText == '') return;
        const currURL = extractID(inputText);
        // console.log("BEFORE NEW VIDEO SET. URL: "+currURL);
        if(currURL){
            switch(videoSource){
                case VideoSource.YOUTUBE:
                    if(currURL){
                        ytCreatePlayer(currURL);
                    } else{
                        console.log("SEARCHING FOR! "+ inputText);
                        ClientYTPlayer.videoSearch(inputText);
                    }
                    break;
                case VideoSource.OTHERONE:
                    otherOneCreatePlayer(currURL);
                    break;
            }//switch
        } else {

        }
        searchResultsContainer.scrollTop = 0;
    });

    function otherOneCreatePlayer(currURL){
        if(previousSource == VideoSource.YOUTUBE){
            if(player) player.destroy();
        }
        const iframeCode = `<iframe 
                src="https://www.pornhub.com/embed/${currURL}"
                frameborder="0" width="100%" id="otherOne"
                height="100%" scrolling="no"
                allowfullscreen></iframe>`;
        // $('#player').append(newElement);
        console.log(iframeCode);        
        $('#player').html(iframeCode);
    }

    function ytCreatePlayer(currURL){
            if(currURL != ClientYTPlayer.clientURL){
                console.log("Trying to start URL: "+currURL);
                console.log("Client URL before change: "+ClientYTPlayer.clientURL);
                ClientYTPlayer.clientURL = currURL;
                console.log("Client URL after change: "+ClientYTPlayer.clientURL);
                ClientYTPlayer.shouldSendState = true;
                console.log("Client should send? "+ClientYTPlayer.shouldSendState);
                ClientYTPlayer.videoTime = 0;
                ClientYTPlayer.addNewVideo();
                ClientYTPlayer.currentState = CustomStates.PLAYING;
                socket.emit('startNew', {
                    videoID: currURL,
                    videoTime: 0,
                    playRate: ClientYTPlayer.playbackRate,
                    videoState: ClientYTPlayer.currentState,
                    thumbnail: ClientYTPlayer.thumbnail,
                    videoTitle: ClientYTPlayer.videoTitle
                },
                roomID)
                console.log("End of search submit function");
            }
    }
    
    let inFullScreen = false;
    $('#fullscreen-button').click(function(event){
        if(!document.fullscreenElement){
            const playerElement = document.getElementById('video_container');
            let requestFullScreen = playerElement.requestFullScreen || playerElement.mozRequestFullScreen || playerElement.webkitRequestFullScreen;
            if (requestFullScreen) {
                document.getElementById('fullscreen-icon').classList.remove("fa-expand");
                document.getElementById('fullscreen-icon').classList.add("fa-compress");
                requestFullScreen.bind(playerElement)().then(data=>{
                    // document.getElementById('video_container').setAttribute('rotate', 90);
                });
                // document.getElementById('ytsearch').style.display = 'none';
            }
        }
        else {
            document.getElementById('fullscreen-icon').classList.remove("fa-compress");
            document.getElementById('fullscreen-icon').classList.add("fa-expand");
            document.exitFullscreen();
            // document.getElementById('ytsearch').style.display = '';
            // document.getElementById('ytsearch').style.removeProperty('display');
        }
        document.activeElement.blur();
        // inFullScreen = !inFullScreen;
    });

    $('#closed-captions-button').click(function(event){
        if(ClientYTPlayer.options.cc_load_policy != 1){
            ClientYTPlayer.options.cc_load_policy = 1;
            ClientYTPlayer.options.cc_lang_pref = "en";
            document.getElementById('closed-captions-icon').classList.remove("far");
            document.getElementById('closed-captions-icon').classList.add("fas");
        } else {
            ClientYTPlayer.options.cc_load_policy = 0;
            document.getElementById('closed-captions-icon').classList.remove("fas");
            document.getElementById('closed-captions-icon').classList.add("far");
        }

        localStorage.setItem('cc_load_policy', ClientYTPlayer.options.cc_load_policy);
        localStorage.setItem('cc_lang_pref', ClientYTPlayer.options.cc_lang_pref);
        // ClientYTPlayer.timeShouldBeSaved = true;
        // ClientYTPlayer.shouldSendState = false;
        ClientYTPlayer.addNewVideo();
    });

    $('#mute-button').click(function(event){
        if(player.isMuted()){
            stayMuted = false;
            player.unMute();         
            document.getElementById('mute-icon').classList.remove("fa-volume-mute");
            document.getElementById('mute-icon').classList.add("fa-volume-up");
        } else {            
            stayMuted = true;
            player.mute();  
            document.getElementById('mute-icon').classList.remove("fa-volume-up");
            document.getElementById('mute-icon').classList.add("fa-volume-mute"); 
        }
    });

    function pauseVideo(){
        if(inFullScreen){
            videoContainer.style.flexWrap = "nowrap";
            controlsToggled = true;
            setTimeout(()=>{
                controlsToggled = false;
                videoContainer.style.flexWrap = "wrap";                    
            }, 3000);
        }
        ClientYTPlayer.currentState = CustomStates.PAUSED;
        player.pauseVideo();
        document.getElementById('play-pause-icon').classList.remove("fa-pause");
        document.getElementById('play-pause-icon').classList.add("fa-play");
        // socket.emit('pause', {});
    }

    function playVideo(){
        ClientYTPlayer.currentState = CustomStates.PLAYING;
        player.playVideo();
        document.getElementById('play-pause-icon').classList.remove("fa-play");
        document.getElementById('play-pause-icon').classList.add("fa-pause");        
        // socket.emit('play', {});
    }

    function startVideoOver(){
        ClientYTPlayer.videoTime = 0;
        player.seekTo(ClientYTPlayer.videoTime);
        ClientYTPlayer.updateTimeUI(0);
        playVideo();    
    }

    $('#sync-button').click(e=>{        
        socket.emit('sync', roomID);
    });

    $('#play-pause-button').click(function(event){
        switch(videoSource){
            case VideoSource.YOUTUBE:
                ytPlayPause(event);
                break;
            case VideoSource.OTHERONE:
                otherOnePlayPause(event);
                break;
        }
    });

    function otherOnePlayPause(event){
        console.log('trying to play otherone');
        let player =  $('#otherOne').contents()
            .find('#player').css({"color": "red", "border": "50px solid red"});
        // player.trigger('click');
    }

    function ytPlayPause(event){
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
        
        
        const data = {
            videoTime: ClientYTPlayer.videoTime,
            videoID: ClientYTPlayer.clientURL,
            thumbnail: ClientYTPlayer.thumbnail,
            playRate: ClientYTPlayer.playbackRate,
            videoLength: ClientYTPlayer.videoLength                
        };

        changeTriggeredByControls = true;
        if(ClientYTPlayer.currentState == CustomStates.PLAYING){
            pauseVideo();
            data.videoState = ClientYTPlayer.currentState;
            socket.emit('pause', data, roomID);
            // if(inFullScreen){
            //     videoContainer.style.flexWrap = "nowrap";
            //     controlsToggled = true;
            //     setTimeout(()=>{
            //         controlsToggled = false;
            //         videoContainer.style.flexWrap = "wrap";                    
            //     }, 3000);
            // }
            // ClientYTPlayer.currentState = YT.PlayerState.PAUSED;
            // player.pauseVideo();
            // document.getElementById('play-pause-icon').classList.remove("fa-pause");
            // document.getElementById('play-pause-icon').classList.add("fa-play");
            // socket.emit('pause', {});
        } else if(ClientYTPlayer.currentState == CustomStates.UNSTARTED ||
                ClientYTPlayer.currentState == CustomStates.PAUSED){
            playVideo();
            const data = {
                videoTime: ClientYTPlayer.videoTime,
                videoID: ClientYTPlayer.clientURL,
                thumbnail: ClientYTPlayer.thumbnail,
                playRate: ClientYTPlayer.playbackRate,
                videoLength: ClientYTPlayer.videoLength                
            };
            data.videoState = ClientYTPlayer.currentState;
            socket.emit('play', data, roomID);
            // ClientYTPlayer.currentState = YT.PlayerState.PLAYING;
            // player.playVideo();
            // document.getElementById('play-pause-icon').classList.remove("fa-play");
            // document.getElementById('play-pause-icon').classList.add("fa-pause");        
            // socket.emit('play', {});
        } else if(ClientYTPlayer.currentState == CustomStates.ENDED){
            startVideoOver();
            socket.emit('startOver', roomID);
            // ClientYTPlayer.currentState = CustomStates.PLAYING;
            // ClientYTPlayer.videoTime = 0;
            // player.seekTo(ClientYTPlayer.videoTime);
            // player.playVideo();
            // document.getElementById('play-pause-icon').classList.remove("fa-play");
            // document.getElementById('play-pause-icon').classList.add("fa-pause");
            // socket.emit('play', {});
        }
    }

    function updateYTVideoTime(){
        if(!player || !player.getCurrentTime ||
            ClientYTPlayer.currentState == YT.PlayerState.ENDED ||
            ClientYTPlayer.currentState == YT.PlayerState.UNSTARTED ||
            ClientYTPlayer.currentState == CustomStates.PAUSED){
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

    function progressBarYTScrub(event) {
        if(!progressBarInitialized) initializeYTProgressBar();
        const scrubTime = (event.offsetX / progressBar.offsetWidth) * player.getDuration();
        changeTriggeredByControls = true;
        player.seekTo(scrubTime);
        // ClientYTPlayer.currentState = CustomStates.SEEKING;
        ClientYTPlayer.updateTimeUI(scrubTime);
        socket.emit('seek', scrubTime, roomID);
        // ClientYTPlayer.SendStateToServer({});
    }

    function initializeToolTip(){
        if(!player.getDuration){
            tooltipInitialized = false;
            return;
        }
        const currTime = Math.round(player.getDuration());
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

    function initializeYTProgressBar(){
        if(!player.getDuration){
            progressBarInitialized = false;
            return;
        }
        ClientYTPlayer.videoLength = player.getDuration();
        const maxTime = Math.round(ClientYTPlayer.videoLength);
        progressBar.setAttribute('max', maxTime);        
        progressBarInitialized = true;
        bufferBar.setAttribute('max', maxTime);
    }

    function stopYTEvent(event){
        playerInitialized = true;
        if(event.data == CustomStates.ENDED){
            document.getElementById('play-pause-icon').classList.remove("fa-pause");
            document.getElementById('play-pause-icon').classList.add("fa-play");            
            ClientYTPlayer.currentState = CustomStates.ENDED;
            if(ClientYTPlayer.looping){
                startVideoOver();
                socket.emit('startOver', roomID);
                // socket.emit('startNew', {
                //     startTime: 0,
                //     id: ClientYTPlayer.clientURL
                // });
            }
            // document.getElementById('play-pause-icon').classList.remove("fa-pause");
            // document.getElementById('play-pause-icon').classList.add("fa-play");
            // ClientYTPlayer.SendStateToServer({});                
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
        // let checkData = {
        //     "name" : nameOnServer,
        //     "user_id" : userID,
        //     "initialized" : serverListInitialized
        // }
        // $.ajax({
        //     url: '/messages',
        //     method: 'GET',
        //     contentType: 'application/json',
        //     data: JSON.stringify(checkData, null, 2),
        //     success: function (response){
        //         let incMessage = response.message;
        //         if(!incMessage) return;
        //         incMessage.fromAnotherUser = true;
        //         if(incMessage.message_id){
        //             let localID = parseInt(incMessage.message_id);
        //             if(incMessage.name != nameOnServer && !seenArray[localID]){
        //                 console.log("Response: " + incMessage.message_data);
        //                 addMessageToChat(response);
        //                 if(isNaN(localID)) console.log("LOCAL ID BROKE!");                    
        //                 seenArray[localID] = true;
        //             }
        //         }
        //     }
        // });
    }

    function checkForUserList(){
        // // player.playVideo();
        // let checkData = {
        //     "name" : nameOnServer,
        //     "user_id" : userID,
        //     "initialized" : serverListInitialized
        // }
        // $.ajax({
        //     url: '/user-list',
        //     method: 'POST',
        //     contentType: 'application/json',
        //     data: JSON.stringify(checkData, null, 2),
        //     success: function (response){                  
        //         updateServerList(response);
        //     }//success: function
        // });      
        // serverListInitialized = true;
    }

    // const initializeInterval = setInterval(initializeServerList, 300);

    function initializeServerList(){
        console.log("("+new Date().toLocaleTimeString()+") Server List Initialized");
        // if(!serverListInitialized){
            // $.ajax({
            //     url: '/initialize',
            //     method: 'POST',
            //     contentType: 'application/json',
            //     data: JSON.stringify({"name" : nameOnServer, "user_id" : userID}, null, 2),
            //     success: function (response){                    
            //         serverListInitialized = true;
            //     }
            // });
        // } else {
        //     clearInterval(initializeInterval);
        // }
        // clearInterval(initializeInterval);
    }

    function pingServer(){
        // $.ajax({
        //     url: '/server-ping',
        //     method: 'POST',
        //     contentType: 'application/json',
        //     data: JSON.stringify({"name" : nameOnServer, "user_id" : userID}, null, 2),
        //     success: function (response){
        //         updateServerList(response);
        //     }
        // });
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
            document.getElementById('mute-icon').classList.remove("fa-volume-mute");
            document.getElementById('mute-icon').classList.add("fa-volume-up");
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
        //if the user closes the window
 
        // if(nameOnServer == anonName){
        //     return;//If it's the anonName, nothing to do
        // }
        let nameToRelease = {
            "name" : nameOnServer,
            "id" : userID
        };

        // $.ajax({
        //     url: '/messages',
        //     method: 'DELETE',
        //     contentType: 'application/json',
        //     data: JSON.stringify(nameToRelease, null, 2),
        //     success: function(response){
        //         console.log(this.url);
        //     }
        // });//$.ajax

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

        const videoData = {
            videoID: ClientYTPlayer.clientURL,
            videoTime: ClientYTPlayer.videoTime
        };

        console.log(`Trying to join room ${roomID}`);

        socket.emit('joinRoom', userData, videoData, roomID);
        
        socket.on('initPlayer', data=>{
            console.log("I'm trying to init my player.");
            const {state, videoID, startTime, playRate} = data;
            ClientYTPlayer.currentState = state;
            ClientYTPlayer.playbackRate = playRate;
            if(videoID != ClientYTPlayer.clientURL){
                ClientYTPlayer.clientURL = videoID;
                ClientYTPlayer.videoTime = startTime;
                ClientYTPlayer.addNewVideo();
            } else {        
                if(startTime > 0){
                    player.seekTo(startTime);
                }
                ClientYTPlayer.updateTimeUI(startTime);
                if(state == CustomStates.PLAYING){
                    playVideo();
                    player.unMute();
                }
            }
            initializeToolTip();
            initializeYTProgressBar();
        });
    
        socket.on('requestState', requesterSocketID=>{
            console.log("someone requested my state");
            socket.emit('sendState', {
                state: ClientYTPlayer.currentState,
                videoID: ClientYTPlayer.clientURL,
                startTime: ClientYTPlayer.videoTime,
                requesterSocketID,
                playRate: ClientYTPlayer.playbackRate,            
                localName,
                roomID
            });        
        });
    
        socket.on('playrateChange', playRate=>{
            if(playRate != ClientYTPlayer.playbackRate){
                ClientYTPlayer.playbackRate = playRate;
                changePlayRate(ClientYTPlayer.playbackRate);
                // document.getElementById('playrate-text').innerHTML = playRate +"x";
            }
        });
    
        socket.on('play', data=>{
            initializeToolTip();
            initializeYTProgressBar();
            if(data.isHost){
                if(ClientYTPlayer.videoTime > data.videoTime + 5 ||
                   ClientYTPlayer.videoTime < data.videoTime - 5){
                    player.seekTo(data.videoTime);
                    ClientYTPlayer.updateTimeUI(data.videoTime);
                }
            }
            playVideo();
            // player.playVideo();
            // player.setVolume(parseInt(volumeSlider.value));
        });
    
        const maxGap = 5;
        socket.on('pause', data=>{
            if(data.isHost){
                if(ClientYTPlayer.videoTime > data.videoTime + maxGap ||
                   ClientYTPlayer.videoTime < data.videoTime - maxGap){
                    player.seekTo(data.videoTime);
                    ClientYTPlayer.updateTimeUI(data.videoTime);
                }
            }
            pauseVideo();
        });
    
        socket.on('seek', videoTime=>{
            player.seekTo(videoTime);
            ClientYTPlayer.updateTimeUI(videoTime);
        });
    
        socket.on('startNew', ({videoTitle, videoID, videoTime, playRate, videoState, thumbnail})=>{
            ClientYTPlayer.currentState = videoState;
            ClientYTPlayer.playbackRate = playRate;
            if(videoID != ClientYTPlayer.clientURL){
                ClientYTPlayer.videoTitle = videoTitle;
                ClientYTPlayer.clientURL = videoID;
                ClientYTPlayer.videoTime = videoTime;
                ClientYTPlayer.thumbnail = thumbnail;
                ClientYTPlayer.addNewVideo();
            } else {
                player.seekTo(startTime);
                ClientYTPlayer.updateTimeUI(startTime);
                playVideo();
            }
            initializeToolTip();
            initializeYTProgressBar();
        });
    
        socket.on('startOver', _=>{
            player.seekTo(0);
            ClientYTPlayer.updateTimeUI(0);
            playVideo();
        });
    
        socket.on('chatJoined', data=>{
            console.log(JSON.stringify(data));
        });
    }


    let controlsToggled = false;
    document.addEventListener('readystatechange', event => { 
    
        // When window loaded ( external resources are loaded too- `css`,`src`, etc...) 
        if(event.target.readyState === "complete"){                       
            validateUserID();        
            // socket.emit('joinChat', localName);

            initializeServerList();

            volumeSlider.addEventListener("change", changeVolume);
            volumeSlider.addEventListener("input", changeVolume)
            // volumeSlider.addEventListener("mousemove", );

            // ClientYTPlayer.pingInterval = setInterval(pingVideoSetting, 200);
        
            // setInterval(pingServer, 2500);
        
            // setInterval(checkForMessages, 500);
        
            // setInterval(checkForUserList, 650);
            player.addEventListener("onStateChange", stopYTEvent);
            ClientYTPlayer.currentState = YT.PlayerState.UNSTARTED;

            setInterval(updateYTVideoTime, 500);

            initializeYTProgressBar();
            initializeToolTip();

            // const playerTime = player.getCurrentTime();
            // if(Math.round(playerTime) != ClientYTPlayer.videoTime){
            //     ClientYTPlayer.updateTimeUI(playerTime);
            // }
            // const bufferedTime = player.getVideoLoadedFraction() * player.getDuration();
            // updateYTBufferBar(bufferedTime);
            updateSeekToolTip(ClientYTPlayer.videoTime);

            progressBar.addEventListener('click', progressBarYTScrub);
            // inFullScreen = false;

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

            videoContainer.addEventListener('fullscreenchange', function(event){
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

            document.getElementById('join-room-modal').classList.add('active');
            document.getElementById('join-room-modal-overlay').classList.add('active');
        }
    });

});