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
    $('#sync-icon').removeClass('active');
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


$('#search-button').click(e=>{
    $('#ytsearch').submit();
});

function enableVideoLoginIcon(){
    $('#video-login-icon').removeClass('far');
    $('#video-login-icon').addClass('fas');
}

function disableVideoLoginIcon(){
    $('#video-login-icon').removeClass('fas');
    $('#video-login-icon').addClass('far');
}

function enableVideoLoginModal(roomName, setUp){
    $('#password-modal-overlay').addClass('active');
    $('#video-login-modal').addClass('active');
}

function disableVideoLoginModal(){
    loggedIn = false;
    $('#password-modal-overlay').removeClass('active');
    $('#video-login-modal').removeClass('active');
}

let loggedIn = false;
$('#video-login-button').click(e=>{
    //First pop up the modal
    //Then enable the icon if loggedIn.
    enableVideoLoginModal();
});

var playerUsername = "";
var playerPassword = "";

$('#video-login-submit').click(e=>{
    e.preventDefault();
    //First grab the data from the form.
    playerUsername = $('#video-login-username').val();
    playerPassword = $('#video-login-password').val();
    buddyPlayer.setLoginDetails(playerUsername, playerPassword);
    //Then set the UI and clear the modal.
    enableVideoLoginIcon();
    disableVideoLoginModal();
    loggedIn = true;
    //Finally, try to find the video again,
    //if there's a link in the searchbar.
    if($('#search-input').val()){
        $('#ytsearch').submit();
    }
});

$('#password-modal-overlay').click(e=>{
    disableVideoLoginModal();
});