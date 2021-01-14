class VimeoViewer extends BuddyViewer{
    constructor(videoID, parentSelectorID, thumbnail=""){
        super(videoID, thumbnail);
        this.createPlayer(videoID, parentSelectorID);      
    }

    createPlayer(videoID, parentSelectorID){
        const options = {
            controls: false,
            autoplay: false,
            muted: true,
            playsinline: true,
            byline: false,
            portrait: false,
            title: false,
            speed: true,
            url: `https://player.vimeo.com/video/${videoID}` //assuming videoID won't be stripped of the surrounding url
        }
            $(`<div id="player"></div>`).insertBefore('iframe');
            $('iframe').remove();
        this.player = new Vimeo.Player('player', options);
        this.play();
        this.setVolume(0.5);
    }

    setState(state){
        this.previousState = this.state;
        this.state = state;
    }

    play(){
        this.setState(1);
        this.player.play();
        this.showPauseIcon();
    }

    pause(){
        this.setState(2);        
        this.player.pause();
        this.showPlayIcon();
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
    }

    setVolume(vol){
        this.player.setVolume(vol);
    }

    progressBarScrub(event) {
        const progressBar = $('#progress-bar');
        const scrubTime = (event.offsetX / progressBar.offsetWidth) * this.player.getDuration();
        player.setCurrentTime(scrubTime);
        // ClientYTPlayer.currentState = CustomStates.SEEKING;
        ClientYTPlayer.updateTimeUI(scrubTime);
        socket.emit('seek', scrubTime, roomID);
        // ClientYTPlayer.SendStateToServer({});
    }
}
