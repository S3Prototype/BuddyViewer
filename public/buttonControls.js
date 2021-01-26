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

$('#sync-button').click(e=>{        
    socket.emit('sync', roomID);
    console.log('trying to sync manually...');
});

function enablePasswordModal(roomName, setUp){
    $('#password-modal').addClass('active');
    $('#password-modal-overlay').addClass('active');
    if(setUp){
        $('#confirm-room-password-input').addClass('active');
    }
    $('#password-modal-name').val(`${roomName} requires a password to enter.`);
}

function disablePasswordModal(){
    $('#password-modal').removeClass('active');
    $('#password-modal-overlay').removeClass('active');
    // $('#confirm-room-password-input').removeClass('active');
}

$('#room-password-button').click(e=>{
    e.preventDefault();
    const pWord = $('#room-password-input');
    const confirmPass = $('#confirm-room-password-input');
    if(!pWord) return;
    if(confirmPass.hasClass('active')){        
        if(confirmPass.val() != pWord.val()){
            $('#room-password-status').val('Passwords do not match. Please try again.');
            pWord.val('');
            confirmPass.val('');
        } else {
            socket.emit('createRoomPassword', {
                pass1: pWord.val(),
                pass2: confirmPass.val(),
                roomID            
            });
        }
    } else {
        socket.emit('checkRoomPassword', {password: pWord.val(), roomID});
    }
});
