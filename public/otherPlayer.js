class OtherPlayer extends BuddyViewer{

    static currentPlayer;

    constructor(data){
        super(data);

        //Only videoID or url should exist at this
        //point. Not both.
        if(data.videoID){
            data.url = data.videoID
        } else {
            data.videoID = data.url;
        }
        this.createPlayer(data);
    }

    createPlayer(data){
        //! This code breaks youtubeviewer and vimeoviewer
        //! Have to change their createPlayer()s to remove
        //! video tag.
        // $(`<div id="player"></div>`).insertBefore('iframe');
        // $('iframe').remove();

        const playerDiv = document.getElementById('player');
        this.player = document.createElement('video');
        this.player.setAttribute('src', data.url);
        this.player.setAttribute('width', '100%');
        this.player.setAttribute('height', '100%');
        this.player.setAttribute('muted', "");
        this.player.setAttribute('poster', data.thumbnail);
        this.player.setAttribute('id', 'otherone');
        playerDiv.append(this.player);

        // $('#player').append(`
        //     <video
        //         id="otherone"
        //         width="100%"
        //         height="100%"
        //         muted
        //         poster=${data.thumbnail}
        //         src=${data.url}
        //         >
        //     </video>
        // `);
        // this.player = document.getElementById('otherone');
        OtherPlayer.currentPlayer = this.player;
        this.setState(data.videoState);
        // this.seek(data.videoTime);

        this.player.addEventListener('timeupdate', function(){                       
            document.dispatchEvent(new Event('videotime'));
        });        
    }

    getDuration(){
        return this.player.duration;
    }

    setVolume(vol){
        console.log("Volume should be "+vol);
        this.unMute();
        const newvol = parseFloat(vol); 
        this.volume = newvol;
        this.player.volume = newvol;
    }

    seek(newTime){
        this.player.currentTime = newTime;
    }

    play(){
        this.setState(CustomStates.PLAYING);
        this.player.play();
    }

    pause(){        
        this.setState(CustomStates.PAUSED);
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