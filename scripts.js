$(function(){

    
    const maxNameLength = 18;
    $("#name-input").attr("maxlength", maxNameLength);
    let letterArray = ["a", "b", "c", "x", "y", "z"];
    let localName = '';
    let userID = Cookies.get('userID');
    userID = userID ? userID : Math.random().toString(36).substring(7);
    let anonName = 'USER-' + userID;
    let nameOnServer = anonName;

    function validateUserID(){
        if(!Cookies.get('userID')){
            $('#name-input').val('');//reset name
            userID = Math.random().toString(36).substring(7);
            anonName = 'USER-' + userID;
            Cookies.set('userID', userID, {expires: 1/2000, secure: false});
        }
    }

    validateUserID();

        /*Used for verifying if we need to send the
        anonName to the serverlist, typically because
        we've just loaded the page.*/
    let serverListInitialized = false;

    let foundAClientSideError = false;
    //Set of clientside errors:
    const ANON_NAME_ERR = "You cannot create your own anon name!";

    console.log(userID);

    let timeStamp = 0;
    let messageInput = $('#message-input');
    messageInput.val('');
    let chatTbody = $('#chatbox-tbody');
    let chatTable = $('#chat-table');
    let seenArray = [false, false, false];
    let nameToRemove = null;

    let userListTable = $('#userlist-table');
    let userListTbody = $('#userlist-tbody');

        //num of chars before message box expands:
    const messageExpansionNum = 100;
    const messageExpandedZIndex = 10;
    const messageDefaultzIndex = 0;

    let mostRecentListID = 0;

    const youtubeInput = $('#ytsearch-input');

    class ClientYTPlayer{
        static currentState = YT.PlayerState.UNSTARTED;
        static playerInfo = {
            user_name : null,
            user_id : null,
            video_time: 0,
            state: -1
        };
        static currentlySendingData = false;
        static clientURL = "hjcXNK-zUFg";

        static extractID(url){
            const startIndex = url.indexOf('v=') + 2;
            url = url.substring(startIndex)
            console.log("YOU entered ID: "+url);
            if(url.includes('&')){
                url = url.substring(0, url.indexOf('&'));
            }
            return url;
        }
        static addNewVideo(){
            // $('#container').html("<div id='player'></div>");
            const currURL = ClientYTPlayer.extractID(player.getVideoUrl());

            if(currURL != ClientYTPlayer.clientURL){
                player.destroy();
                player = new YT.Player('player', {
                    height: '390',
                    width: '640',
                    videoId: ClientYTPlayer.clientURL,
                    playerVars: {
                      enablejsapi: 1,
                      autoplay: 1,
                    }
                  });
                player.addEventListener("onStateChange", ClientYTPlayer.SendStateToServer);
                ClientYTPlayer.SendStateToServer({data: YT.PlayerState.PLAYING});
            }
        }
        static SendStateToServer(event){

            ClientYTPlayer.currentlySendingData = true;
            // ClientYTPlayer.currentState = ;            
            let sendData = {
                "name" : nameOnServer,
                "user_id" : userID,
                "state" : player.getPlayerState(),
                "video_time" : player.getCurrentTime(),
                "video_url": ClientYTPlayer.clientURL
            };

            //Here we check if the state is anything weird.

            console.log("TELL SERVER TO "+player.getPlayerState());
            $.ajax({
                url: '/client-state',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(sendData, null, 2),
                success: function (response){
                    ClientYTPlayer.currentlySendingData = false;
                    // ClientYTPlayer.alignWithServerState(response);                    
                }
            });
        }
        static alignWithServerState(response){
            const serverState = response.state;
            // //If we're already doing the same as the server, return.
            // if(serverState == ClientYTPlayer.currentState) return;
                //Now check if we even need to change anything.

            if(serverState != ClientYTPlayer.currentState){
                if(serverState == YT.PlayerState.PLAYING){
                    console.log("PLAY IT IS TRUE");
                    player.playVideo();
                } else if(serverState == YT.PlayerState.PAUSED){
                    console.log("PAUSE IS TRUE");
                    if(ClientYTPlayer.currentState == YT.PlayerState.BUFFERING){
                        //If we changed from buffering to paused
                        player.playVideo();
                    } else {
                        player.pauseVideo();
                    }
                } else if(serverState == YT.PlayerState.BUFFERING){
                    // player.pauseVideo();
                    console.log("BUFFERING IS TRUE");
                } else if(serverState == YT.PlayerState.UNSTARTED){
                    if(response.video_url != ClientYTPlayer.clientURL){
                        ClientYTPlayer.clientURL = response.video_url;
                        ClientYTPlayer.addNewVideo();
                    }
                    player.playVideo();
                }
            }

            // console.log("TIME SENT BACK: "+response.video_time);
            
            const currTime = player.getCurrentTime();
            if(response.video_time > currTime + 5 ||
                response.video_time < currTime - 5){
                // console.log("TIME SENT FROM SERVER: "+response.video_time);
                player.seekTo(response.video_time);
                player.playVideo();                
            }
            
            ClientYTPlayer.currentState = serverState;
        }
    }

    function pingVideoSetting(){
        // if(ClientYTPlayer.currentlySendingData) return;
        const playerData = {
            "name" : nameOnServer,
            "user_id" : userID,
            "state" : ClientYTPlayer.currentState,
            "video_time": player.getCurrentTime(),
            "video_url": ClientYTPlayer.clientURL
        };
        $.ajax({
            url: '/video-state',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(playerData, null, 2),
            success: function (response){
                ClientYTPlayer.alignWithServerState(response); 
            }
        });
    }

    $('#ytsearch').on('submit', function(event){
        event.preventDefault();
        player.seekTo(0);
        player.stopVideo();            
        const newVid = youtubeInput.val();
        if(newVid.includes('youtu.be')){
            const startIndex = newVid.indexOf('/') + 1;
            ClientYTPlayer.clientURL = newVid.substring(startIndex);
        } else if(newVid.includes('v=')){
            const startIndex = newVid.indexOf('v=') + 2;
            ClientYTPlayer.clientURL = newVid.substring(startIndex)
        }

        if(ClientYTPlayer.clientURL.includes('&')){
            ClientYTPlayer.clientURL = ClientYTPlayer.clientURL.substring(0, ClientYTPlayer.clientURL.indexOf('&'));
        }

        // ClientYTPlayer.clientURL = youtubeInput.val();
        ClientYTPlayer.addNewVideo();
    });

    messageInput.keypress(function(event){
        let code = (event.keyCode ? event.keyCode : event.which);
        if (code == 13 && !event.shiftKey){
            $('#input-form').submit();
        }
    });

    function updateServerList(response){
        const incUserList = response.list;             
        const listID = response.listID;
        // if(listID != mostRecentListID){
        //     console.log('LIST: '+incUserList.length+' ID: '+listID);
        // }
        let i = 0;
        if(incUserList && incUserList.length > 0
           && listID != mostRecentListID){
            userListTbody.empty();
            incUserList.forEach(function(user, index){
                // let user = incUserList[i];
                // let userListHTML = '\
                // <tr class="userlist-row"><td class="userlist-username">'+
                // user.name +'(</td>\
                // <td class="userlist-userid">' + user.id +
                // ')</td> <td class="userlist-index">[' + index +']\
                // </td></tr>';

                let userListHTML = '\
                <tr class="userlist-row"><td class="userlist-name">'+
                user.name +'('+user.id +')</td></tr>'; 
                userListTbody.append(userListHTML.toString());
                // userListTable.scrollTop(chatTable.height() * chatMessage.message_id);                        
                // let messageID = parseInt(chatMessage.message_id);
                // seenArray[messageID] = true;                          
                console.log("USER: "+user.name+"("+user.id+") ADDED TO LIST("+i+")");
                i++;
            });
            mostRecentListID = listID;
            //console.log();
        }//if
    }

    function checkForMessages(){
        validateUserID();
        let checkData = {
            "name" : nameOnServer,
            "user_id" : userID,
            "initialized" : serverListInitialized
        }
        $.ajax({
            url: '/messages',
            method: 'GET',
            contentType: 'application/json',
            data: JSON.stringify(checkData, null, 2),
            success: function (response){
                let incMessage = response.message;
                if(!incMessage) return;
                incMessage.fromAnotherUser = true;
                if(incMessage.message_id){
                    let localID = parseInt(incMessage.message_id);
                    if(incMessage.name != nameOnServer && !seenArray[localID]){
                        console.log("Response: " + incMessage.message_data);
                        addMessageToChat(response);
                        if(isNaN(localID)) console.log("LOCAL ID BROKE!");                    
                        seenArray[localID] = true;
                    }
                }
            }
        });
    }

    function checkForUserList(){
        // player.playVideo()
        validateUserID();
        let checkData = {
            "name" : nameOnServer,
            "user_id" : userID,
            "initialized" : serverListInitialized
        }
        $.ajax({
            url: '/user-list',
            method: 'GET',
            contentType: 'application/json',
            data: JSON.stringify(checkData, null, 2),
            success: function (response){                  
                updateServerList(response);
            }//success: function
        });      
        serverListInitialized = true;
    }

    const initializeInterval = setInterval(initializeServerList, 300);

    function initializeServerList(){
        console.log("HI!");
        if(!serverListInitialized){
            $.ajax({
                url: '/initialize',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({"name" : anonName, "user_id" : userID}, null, 2),
                success: function (response){
                    serverListInitialized = true;
                }
            });
        } else {
            clearInterval(initializeInterval);
        }
    }

    function pingServer(){
        $.ajax({
            url: '/server-ping',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({"name" : nameOnServer, "user_id" : userID}, null, 2),
            success: function (response){
                updateServerList(response);
            }
        });
    }

    function addMessageToChat(response){
        const chatMessage = response.message;
        let localTimeStamp = new Date().toLocaleTimeString();
        
        if(!chatMessage) return;

        if(chatMessage.name == localName){
            //If we were allowed to keep the name
            nameOnServer = chatMessage.name;
            //And we no longer have a name to remove.
            nameToRemove = null;
            messageInput.val(''); //clear the input field
        } else {      
            if(chatMessage.fromAnotherUser){                                
                //If it's from another user
                //Check if it's @-ing anyone.
                const atIndex = chatMessage.message_data.indexOf('@');
                if(atIndex !== -1){
                    let endOfAtIndex = chatMessage.message_data.indexOf(' ', atIndex);
                    if(endOfAtIndex === -1){
                        //If there is no space after @ is called, then
                        endOfAtIndex = chatMessage.message_data.length;
                        //The name that's being @-ed must be the end of the message.
                    }

                    const attedUser = chatMessage.message_data.substring(atIndex+1, endOfAtIndex);
                    // let thisUserHasBeenAtted = false;
                    console.log()
                    if(attedUser == nameOnServer){
                        console.log("USER HAS BEEN ATTED! "+attedUser);
                        //Now we check if we have permission to
                        //send the @ Notification.
                        if(Notification.permission !== "granted"){
                            //If we haven't been granted permission,
                            // Notification.requestPermission()
                        }                        
                        //Now we try to send the @ Notification
                        const atNotification = new Notification("New Message from Watch2Gether Clone!",{
                            body : chatMessage.message_data
                        });

                        window.document.title = "ATTED!";
                    }
                }
            } else {                
                //if we weren't allowed the name, clear it.
                $('#name-input').val('');
            }
        }//else
  

        //Now we insert the data into the table.
        //console.log("YOU KNOW WHO IT IS");
        let chatHTML = '\
                <tr class="chat-row"><td class="chatter-timestamp">['+
                localTimeStamp +']</td>\
                <td class="chatter-name">' + chatMessage.name +
                ': </td><td class="chatter-message">' +
                chatMessage.message_data + '</td></tr>';
             
        chatTbody.append(chatHTML.toString());
        // chatTable.scrollTop(chatTable.height() * chatMessage.message_id);                        
        chatTable.scrollTop(chatTable.height() * seenArray.length);                        
        let messageID = parseInt(chatMessage.message_id);
        console.log("Above message's ID: "+messageID);
        seenArray[messageID] = true;                 
    }

    function clientSideChatError(errorCode){        
        let errorMessage = {
            "message" : {
                "name": "Error",
                "message_id": -1,
                "timestamp": timeStamp,
                "message_data": errorCode,
                "user_id" : userID
            }
        };
        addMessageToChat(errorMessage);
    }

    function checkNameForErrors(){
        let errorDected = false;
        if(localName.substr(0, 5) == 'USER-' && localName != anonName){
            localName = anonName;
            clientSideChatError(ANON_NAME_ERR);
            errorDected = true;
        }
        return errorDected;
    }

    function setName(){        
        localName = $('#name-input').val();

        let nameIsChanged = false;

        let nameHasErrors = checkNameForErrors();
        if(!nameHasErrors){

            /*if there's a client-side error,
            try to catch it*/
            if(localName == ''){
                localName = anonName;           
            }
    
            if (localName != nameOnServer){                        
                //If the name has been changed,
                //tell the server            
                nameToRemove = {"name" : nameOnServer, "id" : userID};
                nameIsChanged = true;
            } else {
                //otherwise there is no name to remove
                nameToRemove = null;
            }
        } else {
            foundAClientSideError = true;
        }

        return(nameIsChanged);
    }

    $('#name-form').on('submit', function(event){
        event.preventDefault();
        //setName();
    });

    //PUT/UPDATE
    //message input
    $('#input-form').on('submit', function(event){
        // console.log(messageInput.val());
        event.preventDefault();
        timeStamp = new Date().toLocaleTimeString();
        // messageInput = $('#message-input');
        chatTbody = $('#chatbox-tbody');
        chatTable = $('#chat-table');

        setName();
    
        if(foundAClientSideError){
            //Probably should put code that sends an error
            //into the chat here instead of in setName()
            foundAClientSideError = false;
            return;
        }

        let tempMessage =
        {
                "message" :
                    {
                        "name" : localName,
                        "message_id" : 0,
                        "timestamp" : timeStamp,
                        "message_data" : messageInput,
                        "user_id": userID
                    },
                "name" : nameToRemove
                            
        };//tempMessage

            $.ajax({
                url: '/messages',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(tempMessage, null, 2),
                success: addMessageToChat
            });       
    });

    window.onbeforeunload = function(event){
        /*doesn't work on IE*/
        //if the user closes the window
 
        // if(nameOnServer == anonName){
        //     return;//If it's the anonName, nothing to do
        // }
        let nameToRelease = {
            "name" : nameOnServer,
            "id" : userID
        };

        $.ajax({
            url: '/messages',
            method: 'DELETE',
            contentType: 'application/json',
            data: JSON.stringify(nameToRelease, null, 2),
            success: function(response){
                console.log(this.url);
            }
        });//$.ajax

    }

    document.addEventListener('readystatechange', event => { 
    
        // When window loaded ( external resources are loaded too- `css`,`src`, etc...) 
        if (event.target.readyState === "complete") {

            setInterval(pingVideoSetting, 200);
        
            setInterval(pingServer, 2500);
        
            setInterval(checkForMessages, 500);
        
            setInterval(checkForUserList, 607);
            player.addEventListener("onStateChange", ClientYTPlayer.SendStateToServer);
        }
    });

});