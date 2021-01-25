console.log('button controls');

    function enableHostIcon(){
        $('#host-icon').removeClass('far');
        $('#host-icon').addClass('fas');
    }

    function disableHostIcon(){
        $('#host-icon').removeClass('fas');
        $('#host-icon').addClass('far');
    }

    $('#host-button').click((event)=>{
        if(!isHost){
            enableHostIcon();
            socket.emit('becomeHost', roomID);
        } else {
            disableHostIcon();
            socket.emit('releaseHost', roomID);
        }
    });