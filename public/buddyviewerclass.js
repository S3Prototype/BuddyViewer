class BuddyViewer{
    constructor(videoID, state, videoDuration, thumbnail="", playRate=1, time=0, roomID){
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

    showPauseIcon(){
        $('#play-pause-icon').removeClass('fa-play');
        $('#play-pause-icon').addClass('fa-pause');
    }

    showPlayIcon(){
        $('#play-pause-icon').removeClass('fa-pause');
        $('#play-pause-icon').addClass('fa-play');
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