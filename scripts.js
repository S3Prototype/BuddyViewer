$(function(){

    $('#name-input').val('');//reset name
    const maxNameLength = 18;
    $("#name-input").attr("maxlength", maxNameLength);
    let letterArray = ["a", "b", "c", "x", "y", "z"];
    let localName = '';
    let userID = Math.random().toString(36).substring(7);
    const anonName = 'ANON-' + userID;
    let nameOnServer = anonName;

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

    messageInput.keypress(function(event){
        let code = (event.keyCode ? event.keyCode : event.which);
        if (code == 13 && !event.shiftKey){
            $('#input-form').submit();
        }
    });

    function checkForMessages(){
        $.ajax({
            url: '/messages',
            method: 'GET',
            contentType: 'application/json',
            success: function (response){
                let incMessage = response.message;
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

        $.ajax({
            url: '/user-list',
            method: 'GET',
            contentType: 'application/json',
            data: JSON.stringify({id : userID}, null, 2),
            success: function (response){   
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
            }//success: function
        });      
    }

    setInterval(checkForMessages, 500);

    setInterval(checkForUserList, 607);

    function addMessageToChat(response){
        const chatMessage = response.message;
        let localTimeStamp = new Date().toLocaleTimeString();
        if(chatMessage && chatMessage.name == localName){
            //If we were allowed to keep the name
            nameOnServer = chatMessage.name;
            //And we no longer have a name to remove.
            nameToRemove = null;
            messageInput.val(''); //clear the input field
        } else {      
            if(chatMessage.fromAnotherUser){                                
                //If it's from another user
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
        if(localName.substr(0, 5) == 'ANON-' && localName != anonName){
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
                        "message_data" : messageInput.val(),
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

    //DELETE
    $('table').on('click', '.delete-button', function(){
        let rowEl = $(this).closest('tr');
        let id = rowEl.find('.id').text();

        $.ajax({
            url: '/products/' + id,
            method: 'DELETE',
            contentType: 'application/json',
            success: function(response){
                console.log(this.url);
                $('#get-products').click();
            }
        });
    });

    window.onbeforeunload = function(event){
        //if the user closes the window

        if(nameOnServer == anonName){
            return;//If it's the anonName, nothing to do
        }
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
                //$('#get-products').click();
            }
        });//$.ajax
    }

});