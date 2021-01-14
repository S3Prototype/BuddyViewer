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
        $('#play-pause-icon').removeClass('fa-play');
        $('#play-pause-icon').addClass('fa-pause');
    }

    showPlayIcon(){
        $('#play-pause-icon').removeClass('fa-pause');
        $('#play-pause-icon').addClass('fa-play');
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