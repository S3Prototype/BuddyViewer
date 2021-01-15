class VimeoViewer extends BuddyViewer{
    constructor(data){
        super(data.videoID, -1, data.thumbnail);
        this.source = VideoSource.VIMEO;       
        // this.playerTime = 0;
        this.buffered = 0;
        this.duration = 0;
        this.oldVolume = 0;
        this.volume = 0;
        this.muted = true;
        this.createPlayer(data);      
    }

    createPlayer({videoSource, videoTitle, videoID,
        videoTime, playRate, videoState, thumbnail,
        roomID}){
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
        this.player.getTextTracks().then(tracks=>{
            if(tracks){
                this.hasCaptions = true;
            }
        });
        if(!videoTitle){
            this.player.getVideoTitle()
            .then(title=>{
                this.videoTitle = title;
                //insert code for showing title on page here.
            });
        }
        // this.play();
        this.player.setCurrentTime(videoTime);
        this.setPlayRate(playRate);
        this.setVolume(0.5);
        if(videoState){
            if(videoState == CustomStates.PLAYING) this.play();
        }
    }

    setPlayRate(newRate){
        if(newRate == this.playRate) return;
        this.playRate = newRate;
        this.player.setPlaybackRate(newRate);
    }

    getBuffered(){
        return this.buffered;
    }

    getPlayerTime(){
        return this.playerTime;
    }

    play(){
        this.setState(CustomStates.PLAYING);
        this.player.play().then(function() {
            document.dispatchEvent(new Event('initialize'));            
        });
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
    }

    playFromServer({videoTime, playRate, isHost}){
        if(isHost){
            if(this.playerTime > videoTime + 5 ||
            this.playerTime < videoTime - 5
            ){
                this.seek(videoTime)
                .then(done=>{
                    this.setPlayRate(playRate);
                    this.play();
                });
            }
        } else {                        
            this.setPlayRate(playRate);
            this.play();
        }
    }

    setVolume(vol){
        this.muted = false;
        this.player.setVolume(parseFloat(vol));
    }

    getDuration(){
        return this.duration;
    }

    seek(time){
        this.player.setCurrentTime(time)
        .then(done=>{
            if(this.state == CustomStates.PAUSED ||
               this.state == CustomStates.ENDED){
                this.pause();
            }
        });
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

}
