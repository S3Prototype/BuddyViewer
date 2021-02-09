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
    let passwordNeed = "to enter";
    if(setUp){
        $('#confirm-room-password-input').addClass('active');
        passwordNeed = "to be initialized."
    }
    $('#password-modal-name').html(`${roomName} requires a password ${passwordNeed}.`);
    // console.log($('#password-modal-name').val());
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
            $('#room-password-status').html('Passwords do not match. Please try again.');
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

$('#searchbar-input').submit(e=>{
    $('#ytsearch').submit();    
});

function enterPressed(e){
    var keycode = (e.keyCode ? e.keyCode : e.which);
    if(keycode == '13'){
        e.preventDefault();
        return true;
    } else {
        return false;
    }
}

$('#searchbar-input').keypress(function(e){
    //detect enter button=
    if(enterPressed(e)) $('#ytsearch').submit();
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
    if($('#searchbar-input').val()){
        $('#ytsearch').submit();
    }
});

$('#password-modal-overlay').click(e=>{
    disableVideoLoginModal();
});

const tabs = document.querySelectorAll('[data-tab-target]');
const tabContents = document.querySelectorAll('[data-tab-content]');

tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
        //set all tab contents inactive
        tabContents.forEach(content=>{
            // console.log(content.classList);
            content.classList.remove('active');
        });                
        //set all tabs inactive
        tabs.forEach(tab=>tab.classList.remove('active'));

            //set the current-selected tab and contents active
        const target = document.querySelector(tab.dataset.tabTarget);        
        target.classList.add('active');
        tab.classList.add('active');
        console.log(tab.dataset.tabTarget);
    });
});

$('#room-password-input').keypress((e)=>{
    if(enterPressed(e)) $('#room-password-button').click();
})

$('#user-list-container').click(e=>{
    const userList = $('#user-list-container');
    if(userList.hasClass('hide-container')){
        userList.removeClass('hide-container');
    } else {
        userList.addClass('hide-container');
    }
});