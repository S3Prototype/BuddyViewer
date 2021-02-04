$(function(){
    const tips = [
        `Press the reconnect button (the little sattelite) if your video player ever starts acting weird.`,
        `The host button (the little star) is white when you're host and black when you aren't.`,
        `Press the host button (the little star) to become the host.`,
        `Some videos require a login to play. Use the login button (the little id card) to securely enter your info.`,
        `BuddyViewer was made by Benjamin August. Check him out on youtube!`,
        `Found an issue? Email ben@benjaminaugust.net, or go to our discord!`
    ];
    
    function getRandomTip(){
        return tips[Math.floor(Math.random() * tips.length)];
    }

    function getReadyToSend(){
        document.addEventListener('videoReadyToSend', event=>{
            console.log("Sending my video now that it's ready");
            socket.emit('startNew', event.detail.data, roomID);                
        });
    }

    function doNotSend(){
        if(BuddyViewer.SendVideoHandler){
            document.removeEventListener('videoReadyToSend', BuddyViewer.SendVideoHandler, false);
        }
    }

    let failureCount = 0;
    const maxFailures = 1;
    let ytInterval;
        //!Need code to set up the player controls separate from the player itself, checking certain vars like below.
        //!Not sure individual video players should have individual cc settings. Like if one is set to cc active, all should start that way.
    if(parseInt(localStorage.getItem('cc_load_policy')) != 0){
        $('#closed-captions-icon').removeClass("far");        
        $('#closed-captions-icon').addClass("fas");
    }

    const maxRecommended = 10;

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
    
    const recommendedContainer = document.getElementById('rec-container');
    
    let mobileMode = false;

    let buddyPlayer = null;

    const playrateText = document.getElementById('playrate-text');

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

    let messageInput = $('#message-input');
    messageInput.val('');

    const progressBar = document.getElementById('progress-bar');
    const seekToolTip = document.getElementById('seek-tooltip');

    const videoContainer = document.getElementById('video_container');

    console.log("ROOM ID: "+roomID);
    let tooltipDuration = "00:00";

    const youtubeInput = $('#search-input');
    const searchResultsContainer = document.getElementById('search-results');

    function changePlayRate(newRate){
        playrateText.innerHTML = newRate +"x";
        // player.setPlaybackRate(newRate)
    }

    function youtubeSearch(query){
        $.ajax({
            url: '/search',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({user_id: userID, query: query}, null, 2),
            success: function (results){       
                // console.log(JSON.stringify(results, null, 2));
                addRecommendedVideos(results);
                addSearchResults(results);
            }
        });
    }

    function addRecommendedVideos(results){
        recommendedContainer.innerHTML = "";
        for(let i = 0; i < maxRecommended && i < results.length; i++){
            if(results[i].type !== "video") return;
            const recDiv = document.createElement('div');
            recDiv.setAttribute('class', 'rec-div');

            const title = document.createElement('span');
            title.setAttribute('class', 'rec-title');
            const titleText = document.createTextNode(results[i].title);
            title.appendChild(titleText);
            recDiv.append(title);
            
            const channelTitle = document.createElement('span');
            channelTitle.setAttribute('class', 'channel-title');            
            channelTitle.innerHTML = results[i].channelTitle;
            recDiv.append(channelTitle);
        
            const thumbDiv = document.createElement('div');
            thumbDiv.setAttribute('class', 'rec-thumbnail-div');

            const thumbnail = document.createElement('img');
            thumbnail.setAttribute('class', 'rec-thumbnail');
            thumbnail.setAttribute('src', results[i].thumbnail);
            thumbDiv.append(thumbnail)            
            
            recDiv.append(thumbDiv);

            recDiv.addEventListener('click', (event)=>{
                data = {       
                    videoTime: 0,
                    thumbnail: results[i].thumbnail,                    
                    videoID: results[i].videoID,
                    videoState: CustomStates.PLAYING,
                    videoTitle: results[i].title,
                    videoSource: VideoSource.YOUTUBE,
                    channelTitle: results[i].channelTitle,
                    username: playerUsername,
                    password: playerPassword
                }
                changeVolumeSettings(VideoSource.YOUTUBE);
                data.volume = volumeSlider.value;
                alignPlayerWithData(data);
                // socket.emit('startNew', data, roomID);
            });

            recommendedContainer.append(recDiv);
        }
    }

    function addSearchResults(results){
        console.log(JSON.stringify("Add search results: "+results, null, 2));
        searchResultsContainer.innerHTML = "";
        results.forEach(function(result){
            if(result.type !== "video") return;
            const resultDiv = document.createElement('div');
            resultDiv.setAttribute('class', 'result');

            const thumbDiv = document.createElement('div');
            thumbDiv.setAttribute('class', 'result-thumbnail-div');
            resultDiv.append(thumbDiv);

            function addFromResult(){
                data = {       
                    videoTime: 0,
                    thumbnail: result.thumbnail,                    
                    videoID: result.videoID,
                    videoState: CustomStates.PLAYING,
                    videoTitle: result.title,
                    videoSource: VideoSource.YOUTUBE,
                    channelTitle: result.channelTitle,
                    username: playerUsername,
                    password: playerPassword
                }
                changeVolumeSettings(VideoSource.YOUTUBE);
                data.volume = volumeSlider.value;
                alignPlayerWithData(data);
                // socket.emit('startNew', data, roomID);
            }

            resultDiv.addEventListener('click', function(event){
                addFromResult();
                console.log("Clickety!");
            });

            const thumbnail = document.createElement('img');
            thumbnail.setAttribute('class', 'result-thumbnail');
            thumbnail.setAttribute('src', result.thumbnail);
            thumbDiv.append(thumbnail)


            const title = document.createElement('span');
            title.setAttribute('class', 'result-title');
            const titleText = document.createTextNode(result.title);
            title.appendChild(titleText);
            title.addEventListener('click', function(event){
                addFromResult();
            });
            resultDiv.append(title);
            
            const channelTitle = document.createElement('span');
            channelTitle.setAttribute('class', 'channel-title');            
            channelTitle.innerHTML = result.channelTitle;
            resultDiv.append(channelTitle);

            // const description = document.createElement('span');
            // description.setAttribute('class', 'result-description');
            // const shortenedDescription = result.description.substring(0, 120) + "..."; 
            // const descriptionText = document.createTextNode(shortenedDescription);
            // description.appendChild(descriptionText);
            // resultDiv.append(description);

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
        loopButton.style.color = "gray";
    }

    const loopButton = document.getElementById('loop-button');
    loopButton.addEventListener('click', function(event){
        const alreadyLooping = buddyPlayer.getLooping();
        if(alreadyLooping){
            disableLoopingIcon();
        } else {
            enableLoopingIcon();
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

        let videoTime = 0;
        if (url.includes('?t=')){
            videoTime = Number(url.substring(url.indexOf('?t=') + 3));
            url = url.substring(0, url.indexOf('?t='));
        } else if(url.includes('&t=')){
            videoTime = parsEInt(url.substring(url.indexOf('&t=') + 3));
            url = url.substring(0, url.indexOf('&t='));
        }

        console.log("Your time should be "+videoTime);

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

        const newID = url;
        return {newID, videoTime};
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
            data: JSON.stringify({query, roomID,
                        options: [  `--username=${playerUsername}`, 
                                    `--password=${playerPassword}`]},
                null, 2),
            success: result=>{
                if(result.error){
                    if(failureCount < maxFailures){
                        enableVideoLoginModal();
                        failureCount++;
                    }
                    console.log("Error. Video not found.");
                    return;
                }
                failureCount = 0;
                    //search youtube if there's a title to use.
                youtubeSearch(result.videoTitle);
                addToRoomHistory(result);
                result.volume = volumeSlider.value;
                // socket.emit('startNew', result, roomID);
                disableLoopingIcon();
                createNewPlayer[result.videoSource](result);
                searchResultsContainer.scrollTop = 0;
                document.dispatchEvent(
                    new CustomEvent('addToRoomHistory', {
                        bubbles: false,
                        detail: { historyItem: result }
                    })
                );
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
        let source = buddyPlayer?.getSource() ?? VideoSource.OTHERONE;
        let newID;
        let videoTime = 0;
        let ytData = tryForYoutube(url);

        newID = ytData?.newID;
        videoTime = ytData?.videoTime || 0;

        if(newID)source = VideoSource.YOUTUBE;

        // if(!result) result = tryForOtherOne(url);
        if(!newID){
            newID = tryforVimeo(url);
            if(newID) source = VideoSource.VIMEO;
        }

        //Keep checking if !result and trying for others.
        return {newID, source, videoTime};
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
        const {newID, source, videoTime} = getIDandSource(inputText);
        if(newID){
                //If it's the same video, do nothing;
                //unless the url is set to a different time.
            if(buddyPlayer && newID == buddyPlayer.getID() &&
                source == buddyPlayer.getSource()){
                    if(videoTime > 0) buddyPlayer.seek(videoTime);
                    return;
            }
            startNewVideo(newID, source, videoTime);
            youtubeSearch(newID);
        } else {
            console.log("Searching for other one with query: "+inputText);
            if(!searchForOtherOne(inputText)){
                console.log("Got nothing. Executing youtube search");
                youtubeSearch(inputText);
            }
        }
    });

    function startNewVideo(videoID, source, videoTime){
        const data = {
            videoID,
            videoSource: source, 
            videoTitle: "",
            videoTime,
            playRate: 1,
            videoState: CustomStates.PLAYING,
            thumbnail: "",
            roomID,
            username: playerUsername,
            password: playerPassword
        }

        disableLoopingIcon();
        console.log(`Sending new of: ${JSON.stringify(data, null, 2)}`);
        changeVolumeSettings(source);
        data.volume = volumeSlider.value;

        //Prepare listener to send new video to others.
        getReadyToSend();
        //create the new player
        createNewPlayer[source](data);
        // socket.emit('startNew', data, roomID);
    }

    function scriptExists(source){
        //Check if the script already exists
        return $(`script[src="${source}"]`).length > 0;
    }

    function changeVolumeSettings(source){
        let step = 0.01;
        let value = 0.2;
        let max = 1;
        switch(source){
            case VideoSource.YOUTUBE:
                step = 1;
                value = 20;
                max = 100;
            break;
        }
        volumeSlider.setAttribute('step', step);
        volumeSlider.setAttribute('value', value);
        volumeSlider.setAttribute('max', max);
        console.log(`Step: ${step} | Value: ${value} | Max: ${max}`);
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
        if(buddyPlayer){
            buddyPlayer.destroy();
            clearInterval(ytInterval);
        }
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
                console.log("URL before change: "+buddyPlayer.getID());               
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
        if(buddyPlayer){
            if(buddyPlayer.getSource() == data.videoSource &&
                buddyPlayer.getID() != data.videoID){
                    clearInterval(ytInterval);
                }
            buddyPlayer.destroy();
        }
        if(!scriptExists(PlayerScripts.YOUTUBE_A)){
            document.addEventListener('ytReady', _=>{
                loadPlayerScript('../youtubeViewer.js', _=>{
                    console.log("Loading up new youtubeviewer");
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
                console.log("URL before change: "+buddyPlayer.getID());                
                buddyPlayer = new YouTubeViewer(data);
            }
        }//else
        ytInterval = setInterval(updateVideoTime, 250);
    }

    function vimeoCreatePlayer(data){
        changeVolumeSettings(VideoSource.VIMEO);
        if(buddyPlayer){
            buddyPlayer.destroy();
            clearInterval(ytInterval);
        }
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
        if(buddyPlayer){
            buddyPlayer.destroy();
            clearInterval(ytInterval);
        }
        console.log("Trying to create OTherPlayer");
        buddyPlayer = new OtherPlayer(otherData);
        buddyPlayer.getState() == CustomStates.PLAYING ?
            buddyPlayer.play() : buddyPlayer.pause();
        buddyPlayer.seek(otherData.videoTime ?? 0);
        buddyPlayer.setPlayRate(buddyPlayer.getPlayRate());
        // buddyPlayer.showPauseIcon();
        buddyPlayer.initVolume();
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

    $('#play-pause-button').click(function(event){
        event.preventDefault();
        buddyPlayer.playPause();
        socket.emit('playPause', buddyPlayer.generateData(), roomID);
    });

    function updateVideoTime(){
        if(!buddyPlayer ||
            isNaN(buddyPlayer.getDuration()) ||
            buddyPlayer.getState() != CustomStates.PLAYING ||
            !buddyPlayer.player){
                return;
            }
        if(!buddyPlayer.isInitialized()){
            console.log(`Not initialized! Also duration: ${buddyPlayer.getDuration()}`);
            const duration = buddyPlayer.getDuration();
            initializeToolTip(duration);
            initializeProgressBar(duration);            
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
        data = buddyPlayer.generateData();
        data.videoTime = scrubTime;
        socket.emit('seek', data, roomID);
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
        buddyPlayer.showPauseIcon();
    })

    messageInput.keypress(function(event){
        let code = (event.keyCode ? event.keyCode : event.which);
        if (code == 13 && !event.shiftKey){
            $('#chat-input').submit();
        }
    });

    function addMessageToChat(message){
        const messageDiv = document.createElement('div');
        messageDiv.setAttribute('class', 'message');

        const formattedMessage = `${message.name} (${userID})[${message.timestamp}]: ${message.text}`;

        const messageText = document.createTextNode(formattedMessage);
        messageDiv.appendChild(messageText)

        const chatMessages = document.getElementById('chat-messages');
        chatMessages.append(messageDiv);               
    }

    function clientSideChatError(errorCode){        
        let errorMessage = {
            name: "Error",
            id: -1,
            timestamp: "00:00",
            text: errorCode,
            userID
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
        document.activeElement.blur();
    });

    $('#text-form').on('submit', function(event){
        event.preventDefault();

        setName();
    
        if(foundAClientSideError){
            //Probably should put code that sends an error
            //into the chat here instead of in setName()
            foundAClientSideError = false;
            return;
        }

        const message = {
            name : localName,
            messageID : 0,
            timestamp : new Date().toLocaleTimeString(),
            text : $('#chat-input').val(),
            userID       
        };

        $('#chat-input').val('');
        addMessageToChat(message);
        $('#chat-messages').scrollTop($('#chat-messages').height());
        socket.emit('sendMessage', message, roomID); 
    });

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

    function alignPlayerWithData(data){
        if(data.videoTime === undefined) return;
        if(data.videoSource < 0) return;
        console.log("I'm trying to align my player.");
        // console.log(`Data is: ${JSON.stringify(data, null, 2)}`);
        console.log("The video time is "+data.videoTime);
        const {videoSource, videoID, videoTime, videoTitle, videoDuration} = data;
        
        if(videoDuration){
            initializeToolTip(data.videoDuration);
            initializeProgressBar(data.videoDuration);
            progressBar.value = Math.round(videoTime);
            updateSeekToolTip(Math.round(videoTime));
        }

        data.volume = volumeSlider.value;

            //We don't want to send this new video out, since
            //we're the ones receiving it.
        doNotSend();
        if(!buddyPlayer || buddyPlayer.getSource() != videoSource){
            //* If it's not the same player, then make a new player
            changeVolumeSettings(videoSource);
            disableLoopingIcon();
            createNewPlayer[videoSource](data);                                              
        } else {
            //if It's the same player, make sure it's a different ID
            if(videoID != buddyPlayer.getID()){
                console.log("same source, diff ID");
                buddyPlayer.newVideo(data);
            } else {
                if(videoTime > 0){
                    seekAndSetUI(Math.round(videoTime));
                }
            }
        }

        youtubeSearch(data.title || videoTitle || videoID || "Benjamin August");
    }

    function createRoomHistory(history){
        if(!history) return;
        const historyContainer = document.getElementById('history');
        historyContainer.innerHTML = "";

        history.forEach(historyItem=>{
            addToRoomHistory(historyItem);
        });
    }

    function addToRoomHistory(historyItem){

            //First make sure we're not duplicating the last item
        const lastHistoryItem = $('#history').children().last();
        const lastTitle = lastHistoryItem
                        .find('.history-item-title').html();
        console.log(`Comparing ${historyItem.videoTitle} to ${lastTitle}`);
            //If we're duplicating, just stop.
        if(historyItem.videoTitle === lastTitle) return;

        const historyContainer = document.getElementById('history');
        const itemDiv = document.createElement('div');
        itemDiv.setAttribute('class', 'history-item');

        const title = document.createElement('span');
        title.setAttribute('class', 'history-item-title');
        const titleText = document.createTextNode(historyItem.videoTitle);
        title.appendChild(titleText);
        itemDiv.append(title);
        
        const channelTitle = document.createElement('span');
        channelTitle.setAttribute('class', 'channel-title');            
        channelTitle.innerHTML = historyItem.channelTitle;
        itemDiv.append(channelTitle);

        const thumbDiv = document.createElement('div');
        thumbDiv.setAttribute('class', 'history-item-thumbnail-div');

        const thumbnail = document.createElement('img');
        thumbnail.setAttribute('class', 'history-item-thumbnail');
        thumbnail.setAttribute('src', historyItem.thumbnail);
        thumbDiv.append(thumbnail)            
        
        itemDiv.append(thumbDiv);

        itemDiv.addEventListener('click', (event)=>{
            data = {       
                videoTime: 0,
                thumbnail: historyItem.thumbnail,                    
                videoID: historyItem.videoID,
                videoState: CustomStates.PLAYING,
                videoTitle: historyItem.videoTitle,
                videoSource: historyItem.videoSource,
                channelTitle: historyItem.channelTitle,
                username: playerUsername,
                password: playerPassword
            }            
            alignPlayerWithData(data);
            // $('body').scrollTop(0);
            document.getElementById("video_container").scrollIntoView();
            // socket.emit('startNew', data, roomID);                
        });

        historyContainer.append(itemDiv);
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

        socket.on('getMessage', messageData=>{
            messageData.timeStamp = new Date().toLocaleTimeString();
            addMessageToChat(messageData);
        });

        socket.on('accessRoom', _=>{
            disablePasswordModal();
            userData.passwordSuccess = true;
            socket.emit('joinRoom', userData, roomID);
        });

        socket.on('wrongPassword', message=>{
            if(!message) message = 'Wrong password. Please try again.';
            $('#room-password-status').val(message);
            $('#room-password-input').val('');
        })

        socket.on('passwordRequest', roomName=>{
            enablePasswordModal(roomName, false);
        });

        socket.on('setUpPassword', roomName=>{
            enablePasswordModal(roomName, true);
        });

        socket.on('setLooping', loopValue=>{
            loopValue ? enableLoopingIcon() : disableLoopingIcon();
            buddyPlayer.setLooping(loopValue);
        });
        
        socket.on('initPlayer', data=>{
            $('#sync-icon').addClass('active');
            alignPlayerWithData(data);
        });

        socket.on('initHistory', history=>{
            createRoomHistory(history);
        });

        socket.on('noOneElseInRoom', _=>{
            BuddyViewer.isHost = true;
            enableHostIcon();
            console.log("You are the only user left in the room.");
        });

        socket.on('getRoomState', room=>{
            alignPlayerWithData(room);
        });

        socket.on('setHost', newHostID=>{
            if(newHostID){
                BuddyViewer.isHost = newHostID == socket.id;
                if(BuddyViewer.isHost){
                    console.log("Setting this browser to host.");
                    enableHostIcon();
                } else {
                    disableHostIcon();
                }
            }
        });
    
        socket.on('requestState', requestData=>{            
            const requesterSocketID = requestData.socketID;
            console.log("someone requested my state");
            let sendData;
            if(!buddyPlayer){
                sendData = {};
            } else {
                sendData = buddyPlayer?.generateData();
            }
            console.log('Im sending a time of: '+sendData?.videoTime);
            sendData.requesterSocketID = requesterSocketID;
            // sendData.hostTimeout = requestData.hostTimeout;
            socket.emit('sendState', sendData);        
        });
        
        socket.on('syncFromOther', videoTime=>{   
            if(videoTime > buddyPlayer.getPlayerTime() + 5 ||
                videoTime < buddyPlayer.getPlayerTime() - 5
            ){
                seekAndSetUI(videoTime);
                buddyPlayer.play();
            }
        });

        socket.on('sendUpTime', requesterSocketID=>{
            socket.emit('syncFromMe', 
                    buddyPlayer.getPlayerTime(),
                    requesterSocketID);
        });

        socket.on('playrateChange', playRate=>{
            buddyPlayer.setPlayRate(playRate);
            changePlayRate(playRate);
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
    
        socket.on('seek', data=>{            
            seekAndSetUI(data.videoTime);
        });        
    
        socket.on('startNew', (data)=>{
            console.log(`Start new with: ${JSON.stringify(data)}`);
            alignPlayerWithData(data);
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

            document.addEventListener('addToRoomHistory', event=>{
                console.log("Should be adding history item: ");
                console.log(JSON.stringify(event.detail.historyItem, null, 2));
                addToRoomHistory(event.detail.historyItem);
            });
            document.getElementById('join-room-modal').classList.add('active');
            document.getElementById('join-room-modal-overlay').classList.add('active');
            document.addEventListener('videotime', updateVideoTime);
            document.addEventListener('initialize', (event)=>{
                console.log("Initialize event called!");
                updateVideoTime();
                buddyPlayer.initialized = true;
            }, false);
            document.addEventListener('trytosync', ()=>{                
                socket.emit('requestSync', roomID);
            });
            document.addEventListener('hideRecommended', ()=>{
                const recCard = document.getElementById('rec-card');
                recCard.style.display = 'none';
            });
            document.addEventListener('showRecommended', ()=>{
                if(!recommendedContainer.innerHTML){
                    console.log("Recommendeds empty. Trying to fill.");
                    youtubeSearch(buddyPlayer.getTitle() || "Benjamin August");                    
                }
                const recCard = document.getElementById('rec-card');
                const randomTip = document.getElementById('tip-text');            
                randomTip.innerHTML = getRandomTip();

                const cardTitle = document.getElementById('card-title');
                cardTitle.innerHTML = buddyPlayer.getTitle() ?? "Buddy Viewer";                
                recCard.style.display = 'flex';
            });
                                  
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