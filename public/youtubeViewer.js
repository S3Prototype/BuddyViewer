class YouTubeViewer extends BuddyViewer{

    static timeInterval;
    static startTime;
    static options = {
        enablejsapi: 1,
        autoplay: 0,
        rel: 0,
        controls: 0,
        origin: 'anonymous',
        disablekb: 1,
        modestbranding: 1,
        cc_load_policy: parseInt(
                localStorage.getItem('cc_load_policy')) || 0,
        cc_lang_pref: localStorage.getItem('cc_lang_pref')
            || 'en',
        mute: 1
    };

    static timeInterval;

    constructor(data){        
        super(data);
        // YouTubeViewer.startTime = data.videoTime;

        this.source = VideoSource.YOUTUBE;
        console.log("Duration when video created: "+data.videoDuration);
        this.duration = data.videoDuration;
        console.log("Time when video created: "+data.videoTime);
        this.time = data.videoTime;
        this.playerTime = data.videoTime;
        this.buffered = 0;
        this.oldVolume = 0;
        this.volume = data.volume;
        this.muted = true;        
        this.initialized = false;
        this.createPlayer(data);      
    }

    createPlayer(data){
        const {videoSource, videoTitle, videoID,
            videoTime, playRate, videoState, thumbnail,
            roomID, videoDuration} = data;
        // $(`<div id="player"></div>`).insertBefore('iframe');
        // $('iframe').remove();

        this.setState(videoState);
        this.videoTitle = videoTitle;
        this.getVideoInfoFromServer(data);
        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoID,
            events: {
                'onReady': this.initNewPlayer.bind(this),
                "onStateChange": this.stopYTEvent,
                "start": videoTime
            },
            playerVars: YouTubeViewer.options
        });
    }

    getVideoInfoFromServer(data){        
        $.ajax({
            url: '/getYouTubeInfo',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({videoID: data.videoID}, null, 2),
            success: result=>{
                    //search youtube if there's a title to use.
                if(!result) return;
                this.videoTitle = result.videoTitle;
                this.description = result.description;
                this.thumbnail = result.thumbnail;
                this.channelTitle = result.channelTitle;                
                result.videoSource = VideoSource.YOUTUBE;
                    document.dispatchEvent(
                        new CustomEvent('addToRoomHistory', {
                            bubbles: false,
                            detail: { historyItem: result }
                        }));
            },
            error: (xhr, status, error)=>{
                console.log('Failed to get yt video info with youtubedl.');
                console.log(error);
            }
        });
    }

    initNewPlayer(event){
        const thisBuddyPlayer = YouTubeViewer.currentPlayer;
        console.log("initNewPlayer STARTED");
        
        console.log("Duration we're taking is: "+event.target.getDuration())
        this.duration = this.player.getDuration();

        document.dispatchEvent(new Event('initialize'));
        this.seek(this.playerTime);
        // this.seek(YouTubeViewer.startTime);
        this.sendTimeEvent();  

        this.getState() == CustomStates.PLAYING ?
            this.play() : this.pause();

        this.setPlayRate(this.playRate);
        
        this.setVolume(parseInt(this.volume ?? 50));
        // thisBuddyPlayer.initialized = true;
        this.captionsEnabled = YouTubeViewer.options.cc_load_policy == 1;

        this.sendReadyVideo();
    }

    newVideo(data){ 
        const {videoSource, videoTitle, videoID,
            videoTime, playRate, videoState, thumbnail,
            roomID, videoDuration} = data;
        console.log('**************');
        console.log("NEW VIDEO CALLED");
        console.log('**************');
        this.destroy();
        this.playerTime = videoTime;
        this.time = videoTime;
        this.videoTitle = videoTitle;
        this.setState(videoState);
        this.initialized = false;
        this.videoID = videoID;
        this.getVideoInfoFromServer(data);
        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoID,
            events: {
                'onReady': this.initNewPlayer.bind(this),
                "onStateChange": this.stopYTEvent.bind(this),
                "start": videoTime
            },
            playerVars: YouTubeViewer.options
        });
        YouTubeViewer.currentPlayer = this;
    }

    getPlayerTime(){
        if(!this.player.getCurrentTime){
            this.playerTime = 0;
        } else {
            this.playerTime = this.player.getCurrentTime();
        }
        return this.playerTime;
    }

    static sendSyncEvent(){
        document.dispatchEvent(new Event('trytosync'));
    }

    stopYTEvent(event){
        // const thisBuddyPlayer = YouTubeViewer.currentPlayer;
        if(event.data == CustomStates.ENDED){
            this.showRestartIcon();                        
            this.setState(CustomStates.ENDED);
            if(this.getLooping()){
                this.startVideoOver();
                socket.emit('startOver', this.roomID);
            } else {
                //Show the recommended overlay
            }
        } else if (event.data == CustomStates.PLAYING){
            SyncManager.syncIfNecessary();
        }

        if(event.data !== CustomStates.PLAYING)
        {
            BuddyViewer.showRecommendedCard();
        } else {
            BuddyViewer.hideRecommendedCard();
        }
    }

    setPlayRate(newRate){
        if(newRate == this.playRate) return;
        this.playRate = newRate;
        this.player.setPlaybackRate(newRate);
    }

    getDuration(){
        if(!this.player.getDuration) return this.duration;

        return this.player.getDuration();
    }

    getBuffered(){
        let buffered = 0;
        
        if(this.player.getVideoLoadedFraction){
            buffered = this.player.getVideoLoadedFraction()
            * this.player.getDuration()
        }

        return buffered;
    }

    play(){
        SyncManager.triggeredByControls = true;
        console.log(this.getThumbnail());
        this.setState(CustomStates.PLAYING);
        this.player.playVideo();
        this.showPauseIcon();
    }

    pause(){      
        this.setState(CustomStates.PAUSED);        
        this.player.pauseVideo();
        this.showPlayIcon();
    }

    setVolume(vol){
        if(this.player.isMuted()) this.unMute();
        this.player.setVolume(parseInt(vol));
    }

    seek(time){ 
        this.player.seekTo(time);
        if(this.getState() == CustomStates.ENDED){
            this.pause();
        }
    }

    mute(){
        this.player.mute();
        this.muted = true;
        this.showMuteIcon();
    }
    
    unMute(){
        this.player.unMute();
        this.muted = false;
        this.showVolumeIcon();
    }

    toggleCaptions(){
        if(!this.captionsEnabled){
            YouTubeViewer.options.cc_load_policy = 1;
            this.enableCaptionsIcon();
            localStorage.setItem('cc_lang_pref', YouTubeViewer.options.cc_lang_pref);
            localStorage.setItem('cc_load_policy', YouTubeViewer.options.cc_load_policy);
        } else {
            localStorage.removeItem('cc_load_policy');
            localStorage.removeItem('cc_lang_pref');
            YouTubeViewer.options.cc_load_policy = 0;
            this.disableCaptionsIcon();
        }
        const data = this.generateData();
        data.videoTime = 0;
        this.newVideo(data);

        this.captionsEnabled = !this.captionsEnabled;
        return this.captionsEnabled;
    }

    destroy(){
        try{
            if(this.player) this.player.destroy();
        } catch(error){
            console.log("Tried destroying player, but got error:");
            console.log(error);
            console.log("Manually destroying player");
            this.player = null;
            $(`<div id="player"></div>`).insertBefore('iframe');
            $('iframe').remove();        
        }
    }

}
