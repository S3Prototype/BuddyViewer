class BuddyViewer{
    constructor(videoID, state, thumbnail="", playRate=1){
        this.videoID = videoID;
        this.state = state;
        this.thumbnail = thumbnail;
        this.playRate = playRate;
        this.previousState = CustomStates.UNSTARTED;
        this.player;          
    }

    showPauseIcon(){
        document.getElementById('play-pause-icon').classList.remove("fa-play");
        document.getElementById('play-pause-icon').classList.add("fa-pause");                
    }

    showPlayIcon(){
        document.getElementById('play-pause-icon').classList.remove("fa-pause");
        document.getElementById('play-pause-icon').classList.add("fa-play");        
    }
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