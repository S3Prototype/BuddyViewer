class YouTubeViewer extends BuddyViewer{
    constructor(data){
        super(data.videoID, CustomStates.UNSTARTED,
            data.videoState, data.videoDuration,
            data.videoTime, data.playRate);

        this.source = VideoSource.YOUTUBE;       
        // this.playerTime = 0;
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
        const options = {
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
        }
        $(`<div id="player"></div>`).insertBefore('iframe');
        $('iframe').remove();
        this.player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoID,
            events: {
                'onReady': initNewPlayer,
                "onStateChange": stopYTEvent,
                "start": videoTime
            },
            playerVars: options
        });
    }

    initNewPlayer(){
        console.log("initNewPlayer STARTED");
        this.seek(videoTime);
        this.getState() == CustomStates.PLAYING ?
            this.play() : this.pause();

        this.player.setPlayRate(this.playRate);

        console.log(`Starting video with state: ${this.getState()}`);
        console.log("===================");
        
        this.unMute();
        this.player.setVolume(parseInt(this.volume ?? 50));
        console.log("initNewPlayer ENDED");
    }

    startVideoOver(){
        // this.setState(CustomStates.PLAYING);
        this.seek(0);
        this.play();
        document.dispatchEvent(new Event('loop'));            
    }

    setPlayRate(newRate){
        if(newRate == this.playRate) return;
        this.playRate = newRate;
        this.player.setPlaybackRate(newRate);
    }

    getBuffered(){
        return this.player.getVideoLoadedFraction()
            * this.player.getDuration();
    }

    getPlayerTime(){
        return this.playerTime;
    }

    play(){
        this.setState(CustomStates.PLAYING);
        this.player.play();
        this.showPauseIcon();
    }

    pause(){
        this.setState(CustomStates.PAUSED);        
        this.player.pause();
        this.showPlayIcon();
    }

    playPause(){
        if(this.isPaused()){
            this.play();
        } else {
            this.pause();
        }
        return !this.isPaused();
    }

    playPauseFromServer({videoTime, isHost, videoState}){
        videoState == CustomStates.PAUSED ?
            this.pause() : this.play();
        if(isHost){
            if(this.playerTime > videoTime + 5 ||
            this.playerTime < videoTime - 5
            ){
                this.seek(videoTime);
            }
        }
    }

    setVolume(vol){
        if(this.player.isMuted()) this.unMute();
        this.player.setVolume(parseInt(vol));
    }

    seek(time){
        this.player.seekTo(time);
        this.sendTimeEvent()        
    }

    mute(){
        this.player.mute();
        this.muted = true;
    }

    unMute(){
        this.player.unMute();
        this.muted = false;
    }
    
    isMuted(){
        return this.player.muted;
    }

    toggleCaptions(){
        if(this.captionsEnabled){
            this.player.disableTextTrack();
            localStorage.removeItem('vimeo_cc_lang');
        } else {
            this.player.enableTextTrack('en', 'captions');
            localStorage.setItem('vimeo_cc_lang', 'en');            
        }
        this.captionsEnabled = !this.captionsEnabled;
        return this.captionsEnabled;
    }

    finalizeVideo(data){
        if(!data.videoTitle){
            this.player.getVideoTitle()
            .then(title=>{
                this.videoTitle = title;
                //insert code for showing title on page here.
            });
        } else {
            this.videoTitle = data.videoTitle;
        }
        this.duration = data.videoDuration;
        this.time = data.videoTime;
        this.playerTime = data.videoTime;
        this.seek(data.videoTime);
        this.setPlayRate(data.playRate);
        this.setVolume(this.volume ?? 0.5);
        if(data.videoState && 
            data.videoState == CustomStates.PLAYING){
            this.play();
        }
    }

    newVideo(data){        
        this.player.loadVideo(data.videoID)
        .then(_=>{         
            this.time = data.videoTime;
            this.playerTime = data.videoTime;   
            this.initListeners();
            this.finalizeVideo(data);
            this.player.getDuration()
            .then(duration=>{
                this.duration = duration;
                document.dispatchEvent(new Event('initialize'));
            });
        })
        .catch(error=>{
            switch (error.name) {
                case 'TypeError':
                    console.log("Vimeo id not sent as a number");
                    break;
          
                case 'PasswordError':
                    console.log("Vimeo video is password protected");
                    break;
          
                case 'PrivacyError':
                    console.log("This video is private");                    
                    break;
          
                default:
                    console.log("Error occurred" + error);
                    break;
            }
        });
    }

}
