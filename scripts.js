$(function(){

    $('#name-input').val('');//reset name
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
    let chatTbody = $('#chatbox-tbody');
    let chatTable = $('#chat-table');
    let seenArray = [false, false, false];
    let nameToRemove = null;

    function checkForMessages(){
        $.ajax({
            url: '/messages',
            method: 'GET',
            contentType: 'application/json',
            success: function (response){
                const incMessage = response.message;
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

    setInterval(checkForMessages, 500);

    function addMessageToChat(response){

        const chatMessage = response.message;
        if(chatMessage && chatMessage.name == localName){
            //If we were allowed to keep the name
            nameOnServer = chatMessage.name;
            //And we no longer have a name to remove.
            nameToRemove = null;
            messageInput.val(''); //clear the input field
        } else {
            //if we weren't allowed the name, clear it.
            $('#name-input').val('');
        }

        //Now we insert the data into the table.
        //console.log("YOU KNOW WHO IT IS");
        let chatHTML = '\
                <tr class="chat-row"><td class="chatter-timestamp">['+
                chatMessage.timestamp +']</td>\
                <td class="chatter-name">' + chatMessage.name +
                ': </td><td class="chatter-message">' +
                chatMessage.message_data + '</td></tr>';
             
        chatTbody.append(chatHTML.toString());
        chatTable.scrollTop(chatTable.height() * chatMessage.message_id);                        
        let messageID = parseInt(chatMessage.message_id);
        console.log("Above message's ID: "+messageID);
        seenArray[messageID] = true;                 
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

    //GET/READ
    $('#get-products').on('click', function(){
       //console.log("TEST");
       $.ajax({
           url: '/products',
           contentType: 'application/json',
           success: function (response){
                //console.log(response);
                var tbodyEl = $('tbody');
                tbodyEl.html('');

                response.products.forEach(function(product){
                    tbodyEl.append('\
                        <tr>\
                            <td class="id">' + product.id + '</td>\
                            <td><input type="text" class="name" value="' +
                            product.name + '"></td>\
                            <td><button class="update-button">UPDATE/PUT\
                            </button>\
                            <button class="delete-button">DELETE</button>\
                            </td>\
                        </tr>\
                    ');
                });

           }


       });
    });

    $('#name-form').on('submit', function(event){
        event.preventDefault();
        //setName();
    });

    //PUT/UPDATE
    //message input
    $('#input-form').on('submit', function(event){
        event.preventDefault();
        timeStamp = new Date().toLocaleTimeString();
        messageInput = $('#message-input');
        chatTbody = $('#chatbox-tbody');
        chatTable = $('#chat-table');

        setName();
    
    if(foundAClientSideError){
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

});