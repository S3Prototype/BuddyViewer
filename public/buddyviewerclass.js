
class BuddyViewer{

    static SendVideoHandler;

    static showRecommendedCard(){
        document.dispatchEvent(new Event('showRecommended'));
    }

    static hideRecommendedCard(){
        document.dispatchEvent(new Event('hideRecommended'));
    }

    constructor(data){
        this.username = data.username ?? "";
        this.password = data.password ?? "";

        this.channelTitle = data.channelTitle || "Unknown Channel";

        this.roomID = data.roomID;
        this.videoID = data.videoID;
        this.state = data.videoState ?? CustomStates.PLAYING;
        
        this.thumbnail = data.thumbnail;
        this.playRate = data.playRate ?? 1;
        this.previousState = CustomStates.UNSTARTED;
        this.player;
        this.initialized = false;
        
        this.playerTime = data.videoTime ?? 0;
        this.time = this.playerTime;
        
        this.volume = data.volume ?? 0.2;

        this.buffered = 0;
        this.source = VideoSource.OTHERONE;
        this.videoTitle = data.videoTitle;
        this.captionsEnabled = false;
        this.hasCaptions = false;
        this.looping = data.looping ?? false;
        this.duration = data.videoDuration;

        this.controlsTriggered = false;
    }

    sendTimeEvent(){
        document.dispatchEvent(new Event('videotime'));
    }

    getDuration(){
        return this.duration;
    }

    getLooping(){
        return this.looping;        
    }

    setLooping(loop){
        this.looping = loop;
    }

    isPaused(){
        return this.state == CustomStates.PAUSED;
    }

    isEnded(){
        return this.state == CustomStates.ENDED;       
    }

    toggleCaptions(){
        //This is just filler for child classes who don't
        //use captions.
        this.captionsEnabled = !this.captionsEnabled;
    }

    playPause(){
        if(this.isPaused()){
            this.play();
            this.showPauseIcon();
        } else if(this.isEnded()){
            this.startVideoOver();
        } else {
            this.pause();
            this.showPlayIcon();
        }
        return this.isPaused();
    }

    getPlayerTime(){
        return this.playerTime;
    }

    playPauseFromServer({videoTime, isHost, videoState}){
        videoState == CustomStates.PAUSED ?
            this.pause() : this.play();
            //Next, if the person sending the data is host,
            //align ourselves to their time.
        if(isHost){
            if(this.playerTime > videoTime + 5 ||
            this.playerTime < videoTime - 5
            ){
                this.seek(videoTime);
            }
        }
    }
    
    getVolume(){
        return this.volume;
    }

    getSavedTime(){
        return this.time;
    } 

    isInitialized(){
        return this.initialized;
    }

    setSavedTime(newTime){
        this.time = newTime;
    }

    getPlayRate(){
        return this.playRate;
    }
    
    isMuted(){
        return this.muted;
    }

    getChannelTitle(){
        return this.channelTitle;
    }

    sendReadyVideo(){
        BuddyViewer.SendVideoHandler = 
            new CustomEvent('videoReadyToSend', {
                bubbles: false,
                detail: { data: this.generateData() }
            });
        document.dispatchEvent(BuddyViewer.SendVideoHandler);
    }

    generateData(){
        return {
            videoID: this.getID(),
            videoSource: this.getSource(),
            videoTime: this.getPlayerTime(),
            playRate: this.getPlayRate(),
            videoState: this.getState(),
            thumbnail: this.getThumbnail(),
            channelTitle: this.getChannelTitle(),
            videoTitle: this.getTitle(),
            videoDuration: this.getDuration()
        }
    }

    setLoginDetails(username, password){
        this.username = username;
        this.password = password;
    }

    getTitle(){
        return this.videoTitle;
    }

    getTime(){
        return this.time;
    }

    getSource(){
        return this.source;
    }

    setSource(source){
        this.source = source;
    }

    getID(){
        return this.videoID;
    }

    setState(state){
        this.previousState = this.state;
        this.state = state;
    }
    
    getState(){
        return this.state;
    }

    getThumbnail(){
        return this.thumbnail;
    }

    startVideoOver(){
        this.seek(0);
        this.play();
        document.dispatchEvent(new Event('loop'));            
    }

    enableCaptionsIcon(){
        $('#closed-captions-icon').removeClass("far");
        $('#closed-captions-icon').addClass("fas");
    }

    disableCaptionsIcon(){
        $('#closed-captions-icon').removeClass("fas");
        $('#closed-captions-icon').addClass("far");
    }

    showPauseIcon(){
        $('#play-pause-icon').removeClass('fa-sync-alt');
        $('#play-pause-icon').removeClass('fa-play');
        $('#play-pause-icon').addClass('fa-pause');
    }

    showRestartIcon(){
        $('#play-pause-icon').removeClass('fa-pause');
        $('#play-pause-icon').addClass('fa-sync-alt');
    }

    showPlayIcon(){
        $('#play-pause-icon').removeClass('fa-pause');
        $('#play-pause-icon').addClass('fa-play');
    }

    showVolumeIcon(){
        $('#mute-icon').removeClass("fa-volume-mute");
        $('#mute-icon').addClass("fa-volume-up");
    }

    showMuteIcon(){
        $('#mute-icon').removeClass("fa-volume-up");
        $('#mute-icon').addClass("fa-volume-mute");
    }

    showContractIcon(){
        $('fullscreen-icon').removeClass("fa-expand");
        $('fullscreen-icon').addClass("fa-compress");                
    }

    showExpandIcon(){
        $('fullscreen-icon').removeClass("fa-compress");   
        $('fullscreen-icon').addClass("fa-expand");
    }
}

const VideoSource = {
    YOUTUBE: 0,
    VIMEO: 2,
    SPOTIFY: 3,
    OTHERONE: 4
}

const CustomStates = {
    UNSTARTED : -1,
    ENDED : 0,
    PLAYING : 1,
    PAUSED : 2,
    BUFFERING : 3,
    CUED : 5,
    SEEKING : 6
};

const SyncManager = {
    sendSyncEvent: function(){
            document.dispatchEvent(new Event('trytosync'));
        },
    triggeredByControls: false,
    syncIfNecessary: function(){
            if(this.triggeredByControls){
                this.sendSyncEvent();
                console.log("SyncManager is trying to sync ...");
            }
            this.triggeredByControls = false;
        }
}