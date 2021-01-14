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
        // const paused = this.player.getPaused();
        // const ended = this.player.getEnded();
        // if(paused){
        //     this.previousState = CustomStates.PAUSED;
        // } else if (ended){
        //     this.previousState = CustomStates.ENDED;
        // }
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
        // this.player.getPaused().then(result=>{return result});
        return this.state == 2;
    }

    isEnded(){
        return this.state == 0;       
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
}
