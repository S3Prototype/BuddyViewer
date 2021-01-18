class BuddyViewer{
    constructor(videoID, state, videoDuration, thumbnail="", time=0, playRate, roomID){
        this.roomID = roomID;
        this.videoID = videoID;
        this.state = state;
        this.thumbnail = thumbnail;
        this.playRate = playRate;
        this.previousState = CustomStates.UNSTARTED;
        this.player;
        this.initialized = false;
        this.playerTime = time;
        this.time = time;
        this.buffered = 0;
        this.source = VideoSource.OTHERONE;
        this.roomID = roomID;
        this.videoTitle = "";
        this.captionsEnabled = false;
        this.hasCaptions = false;
        this.looping = false;
        this.duration = videoDuration;
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

    playPause(){
        if(this.isPaused()){
            this.play();
        } else {
            this.pause();
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

    generateData(){
        return {
            videoID: this.getID(),
            videoSource: this.getSource(),
            videoTime: this.getPlayerTime(),
            playRate: this.getPlayRate(),
            videoState: this.getState(),
            thumbnail: this.getThumbnail(),
            videoTitle: this.getTitle(),
            videoDuration: this.getDuration()
        }
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
        $('#play-pause-icon').removeClass('fa-play');
        $('#play-pause-icon').addClass('fa-pause');
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
    TWITTER: 3,
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