class VimeoViewer extends BuddyViewer{
    constructor(data){
        super(data.videoID, -1, data.videoState, data.videoDuration, data.videoTime, data.playRate);
        this.source = VideoSource.VIMEO;       
        // this.playerTime = 0;
        this.buffered = 0;
        this.oldVolume = 0;
        this.volume = 0;
        this.muted = true;
        this.createPlayer(data);      
    }

    createPlayer(data){
        const {videoSource, videoTitle, videoID,
            videoTime, playRate, videoState, thumbnail,
            roomID, videoDuration} = data;
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
        this.initListeners();
        this.finalizeVideo(data);
    }

    initListeners(){
        this.player.on('volumechange', data=>{
            this.oldVolume = this.volume;
            this.volume = data.volume;
        });
        this.player.on('timeupdate', update=>{
            // console.log("Time update: "+update.seconds);
            this.duration = update.duration;
            this.playerTime = update.seconds;
            if(!this.isInitialized()){
                document.dispatchEvent(new Event('initialize'));
            }
            this.sendTimeEvent();
        });
        this.player.on('progress', progress=>{
            console.log("Buffer updatE: "+update.seconds);
            this.buffered = progress.percent * this.duration;
        });
        this.player.on('ended', _=>{
            this.showPlayIcon();
            this.setState(CustomStates.ENDED);
            if(this.getLooping()){
                this.startVideoOver();                
            }
        });
        this.player.getTextTracks().then(tracks=>{
            if(tracks){
                this.hasCaptions = true;
            }
        });
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
        return this.buffered;
    }

    getPlayerTime(){
        return this.playerTime;
    }

    play(){
        this.setState(CustomStates.PLAYING);
        this.player.play().then(_=>{
            document.dispatchEvent(new Event('initialize'));          
        });
        this.showPauseIcon();
    }

    pause(){
        this.setState(CustomStates.PAUSED);        
        this.player.pause()
        .then(_=>{
            document.dispatchEvent(new Event('initialize'));           
        });
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
        this.muted = false;
        this.player.setVolume(parseFloat(vol));
    }

    seek(time){
        this.player.setCurrentTime(time)
        .then(done=>{
            if(this.state == CustomStates.PAUSED ||
               this.state == CustomStates.ENDED){
                this.pause();
            }
            this.sendTimeEvent();
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
