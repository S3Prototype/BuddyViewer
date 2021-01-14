class VimeoViewer extends BuddyViewer{
    constructor(videoID, parentSelectorID, thumbnail="", time=0){
        super(videoID, -1, thumbnail);        
        this.playerTime = 0;
        this.buffered = 0;
        this.duration = 0;
        this.oldVolume = 0;
        this.volume = 0;
        this.muted = true;
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
        this.player.on('volumechange', data=>{
            this.oldVolume = this.volume;
            this.volume = data.volume;
        });
        this.player.on('timeupdate', update=>{
            // console.log("Time update: "+update.seconds);
            this.duration = update.duration;
            this.playerTime = update.seconds;
        });
        this.player.on('progress', progress=>{
            console.log("Buffer updatE: "+update.seconds);
            this.buffered = progress.percent * this.duration;
        });
        this.play();
        this.setVolume(0.5);
    }

    getBuffered(){
        return this.buffered;
    }
    
    setSavedTime(newTime){
        this.time = newTime;
    }

    isInitialized(){
        return this.initialized;
    }

    getSavedTime(){
        return this.time;
    }

    getPlayerTime(){
        return this.playerTime;
        // this.player.getCurrentTime()
        // .then(time=>{
        //     console.log("Your time is "+time);
        //     return time;
        // })
        // .catch(err=>{
        //     return 0;
        // });
    }
    
    getCurrentTime(){
    }

    play(){
        this.setState(1);
        this.player.play().then(function() {
            document.dispatchEvent(new Event('initialize'));            
        });;
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

    getVolume(){
        return this.volume;
    }

    setVolume(vol){
        this.muted = false;
        this.player.setVolume(parseFloat(vol));
    }

    getDuration(){
        return this.duration;
    }

    seek(time){
        this.player.setCurrentTime(time);
    }

    mute(){
        this.setVolume(0);
        this.muted = true;
    }

    unMute(){
        const returnVolume = this.oldVolume > 0 ? 
            this.oldVolume : 0.2;
        this.setVolume(returnVolume);
        this.muted = false;
    }
    
    isMuted(){
        return this.volume == 0;
    }
}
