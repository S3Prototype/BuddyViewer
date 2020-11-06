$(function(){

    let letterArray = ["a", "b", "c", "x", "y", "z"];
    let userName = 'ANON-';
    userName += Math.random().toString(36).substring(7);

    let timeStamp = 0;
    let messageInput = $('#message-input');
    let chatTbody = $('#chatbox-tbody');
    let chatTable = $('#chat-table');
    let localName = userName;
    let seenArray = [false, false, false];
    
    function checkForMessages(){
        $.ajax({
            url: '/messages',
            method: 'GET',
            contentType: 'application/json',
            success: function (response){ 
                let localID = parseInt(response.message_id);
                if(response.name != localName && !seenArray[localID]){
                    console.log("ResponseName: " + response.name);
                    addMessageToChat(response);
                    if(isNaN(localID)) console.log("LOCAL ID BROKE!");                    
                    seenArray[localID] = true;
                }
            }
        });
    }

    setInterval(checkForMessages, 500);

    function addMessageToChat(chatMessage){
            //Now we insert the data into the table.
            let chatHTML = '\
                <tr class="chat-row"><td class="chatter-timestamp">['+
                chatMessage.timestamp +']</td>\
                <td class="chatter-name">' + chatMessage.name +
                ': </td><td class="chatter-message">' +
                chatMessage.message_data + '</td></tr>';
                           
            localName = chatMessage.name;
            chatTbody.append(chatHTML.toString());
            chatTable.scrollTop(chatTable.height() * chatMessage.message_id);                
            messageInput.val('');
            let messageID = parseInt(chatMessage.message_id);
            console.log(messageID);
            seenArray[messageID] = true;        
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
        userName = $('#name-input').val();
        localName = userName; 
    });

    //PUT/UPDATE
    //message input
    $('#input-form').on('submit', function(event){
        event.preventDefault();
        //let userName = $('#user-name');
        timeStamp = new Date().toLocaleTimeString();
        messageInput = $('#message-input');
        chatTbody = $('#chatbox-tbody');
        chatTable = $('#chat-table');

        let tempMessage = {
            "name" : userName,
            "message_id" : 0,
            "timestamp" : timeStamp,
            "message_data" : messageInput.val()
        }

        $.ajax({
            url: '/messages',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(tempMessage),
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