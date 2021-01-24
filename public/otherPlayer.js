class OtherPlayer extends BuddyViewer{

    static currentPlayer;

    constructor(data){
        super(data);

        //Only videoID or url should exist at this
        //point. Not both.
        if(data.videoID !== undefined){
            data.url = data.videoID
        } else {
            data.videoID = data.url;
        }

        if(data.videoTitle !== undefined){
            data.title = data.videoTitle;
        } else {
            data.videoTitle = data.title;
        }
        this.createPlayer(data);
    }

    createPlayer(data){
        this.createVideoElement(data);
        OtherPlayer.currentPlayer = this.player;
        this.setState(data.videoState);
        this.setLooping(true);
            // this.seek(data.videoTime);
        this.addListeners();
    }

    static sendSyncEvent(){
        document.dispatchEvent(new Event('trytosync'));
    }

    addListeners(){
        this.player.addEventListener('timeupdate', function(){                       
            document.dispatchEvent(new Event('videotime'));
        });

        function catchEvent(event){
            BuddyViewer.hideRecommendedCard();
            SyncManager.syncIfNecessary();
        }

        this.player.addEventListener('play', catchEvent);
        this.player.addEventListener('playing', catchEvent);
        this.player.addEventListener('pause', ()=>{
            BuddyViewer.showRecommendedCard();
        })
        this.player.addEventListener('ended', ()=>{
            if(this.getLooping()){
                this.startVideoOver();
            } else {
                this.setState(CustomStates.ENDED);
                this.showPlayIcon();            
                BuddyViewer.showRecommendedCard();
            }
        });

        this.player.addEventListener('canplay', ()=>{
            document.dispatchEvent(new Event('initialize'));
        });
    }

    setLooping(loopValue){
        this.looping = loopValue;
        this.player.loop = loopValue;
    }

    createVideoElement({url, thumbnail}){
        const playerDiv = document.getElementById('player');
        this.player = document.createElement('video');
        this.player.setAttribute('src', url);
        this.player.setAttribute('width', '100%');
        this.player.setAttribute('height', '100%');
        this.player.setAttribute('muted', "");
        this.player.setAttribute('poster', thumbnail);
        this.player.setAttribute('id', 'otherone');
        playerDiv.append(this.player);
    }

    newVideo(data){ 
        const {videoSource, videoTitle, videoID,
            videoTime, playRate, videoState, thumbnail,
            roomID, videoDuration, volume} = data;
            // const playerDiv = document.getElementById('player');
            // this.player = document.createElement('video');
            // this.player.setAttribute('src', data.url);
            // this.player.setAttribute('width', '100%');
            // this.player.setAttribute('height', '100%');
            // this.player.setAttribute('muted', "");
            // this.player.setAttribute('poster', data.thumbnail);
            // this.player.setAttribute('id', 'otherone');
            // playerDiv.append(this.player);
        this.initialized = false;
        this.destroy();
        // this.player = new OtherPlayer(data).player;
        this.createVideoElement(data);
        this.setState(videoState);
        OtherPlayer.currentPlayer = this.player;

        this.getState() == CustomStates.PLAYING ?
            this.play() : this.pause();

        this.videoTitle = videoTitle;
        this.thumbnail = thumbnail;
        this.url = videoID
        this.videoID = videoID;
        this.seek(videoTime);
        this.setVolume(volume);
        this.setPlayRate(playRate);      

        this.addListeners();
    }

    initPlayRate(){
        this.setPlayRate(this.playRate);
    }

    initVolume(){
        this.setVolume(this.volume);
    }

    getDuration(){
        return this.player.duration;
    }

    setPlayRate(nextRate){
        this.playRate = nextRate;
        this.player.playbackRate = nextRate;
    }

    setVolume(vol){
        console.log("Volume should be "+vol);
        this.unMute();
        const newvol = parseFloat(vol); 
        this.volume = parseFloat(vol);
        this.player.volume = parseFloat(vol);
    }

    seek(newTime){
        this.player.currentTime = newTime;
        if(this.getState() == CustomStates.ENDED){
            this.pause();
        }
    }

    play(){
        SyncManager.triggeredByControls = true;
        this.setState(CustomStates.PLAYING);
        this.showPauseIcon();
        this.player.play();
    }

    pause(){        
        this.setState(CustomStates.PAUSED);
        this.showPlayIcon();
        this.player.pause();
    }

    mute(){
        this.showMuteIcon();
        this.muted = true;
        this.player.muted = true;
    }

    unMute(){
        this.showVolumeIcon();
        this.muted = false;
        this.player.muted = false;
    }

    getPlayerTime(){
        return this.player.currentTime;
    }

    getBuffered(){
        const max = this.player.buffered.length - 1;
        return this.player.buffered.end(max);
    }

    destroy(){
        $('#player').html('');
    }
}