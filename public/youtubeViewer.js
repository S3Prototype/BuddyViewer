class YouTubeViewer extends BuddyViewer{

    static currentPlayer;
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

    constructor(data){        
        super(data);
        YouTubeViewer.startTime = data.videoTime;

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
        this.createPlayer(data);      
    }

    createPlayer(data){
        const {videoSource, videoTitle, videoID,
            videoTime, playRate, videoState, thumbnail,
            roomID, videoDuration} = data;
        // $(`<div id="player"></div>`).insertBefore('iframe');
        // $('iframe').remove();
        this.setState(videoState);
        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoID,
            events: {
                'onReady': YouTubeViewer.initNewPlayer,
                "onStateChange": this.stopYTEvent,
                "start": videoTime
            },
            playerVars: YouTubeViewer.options
        });

        YouTubeViewer.currentPlayer = this;
    }

    static initNewPlayer(){
        const thisBuddyPlayer = YouTubeViewer.currentPlayer;
        console.log("initNewPlayer STARTED");
        if(!thisBuddyPlayer.duration){
            thisBuddyPlayer.duration = thisBuddyPlayer.player.getDuration();
        }

        thisBuddyPlayer.seek(YouTubeViewer.startTime);
        thisBuddyPlayer.sendTimeEvent();  

        thisBuddyPlayer.getState() == CustomStates.PLAYING ?
            thisBuddyPlayer.play() : thisBuddyPlayer.pause();

        thisBuddyPlayer.setPlayRate(thisBuddyPlayer.playRate);

        console.log(`Starting video with state: ${thisBuddyPlayer.getState()}`);
        console.log("===================");
        
        thisBuddyPlayer.setVolume(parseInt(thisBuddyPlayer.volume ?? 50));
        thisBuddyPlayer.initialized = true;
        thisBuddyPlayer.captionsEnabled = YouTubeViewer.options.cc_load_policy == 1;
        console.log("initNewPlayer ENDED");
    }

    getPlayerTime(){
        if(!this.player.getCurrentTime){
            this.playerTime = 0;
        } else {
            this.playerTime = this.player.getCurrentTime();
        }
        return this.playerTime;
    }

    stopYTEvent(event){
        const thisBuddyPlayer = YouTubeViewer.currentPlayer;
        if(event.data == CustomStates.ENDED){
            thisBuddyPlayer.showPlayIcon();                        
            thisBuddyPlayer.setState(CustomStates.ENDED);
            if(thisBuddyPlayer.getLooping()){
                thisBuddyPlayer.startVideoOver();
                socket.emit('startOver', this.roomID);
            }           
        }
    }

    setPlayRate(newRate){
        if(newRate == this.playRate) return;
        this.playRate = newRate;
        this.player.setPlaybackRate(newRate);
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

    newVideo(data){ 
        const {videoSource, videoTitle, videoID,
            videoTime, playRate, videoState, thumbnail,
            roomID, videoDuration} = data;
        this.player.destroy();
        $(`<div id="player"></div>`).insertBefore('iframe');
        $('iframe').remove();
        this.setState(CustomStates.PLAYING);
        this.initialized = false;
        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoID,
            events: {
                'onReady': YouTubeViewer.initNewPlayer,
                "onStateChange": this.stopYTEvent,
                "start": videoTime
            },
            playerVars: YouTubeViewer.options
        });
        YouTubeViewer.currentPlayer = this;
    }

    destroy(){
        this.player.destroy();
        $(`<div id="player"></div>`).insertBefore('iframe');
        $('iframe').remove();        
    }

}
