$(function(){

    checkServerForRooms();

    function createRoomsList(roomsList){
        const roomListContainer = document.getElementById('room-list-container');
        const url = "http://localhost:8092/";
        roomsList.map((room)=>{
            if(room.securitySetting != 2){
                console.log(`CURRENT ROOM: ${JSON.stringify(room, null, 2)}`);
                    //Create the div that holds everything.
                const resultDiv = document.createElement('div');
                resultDiv.setAttribute('class', 'room-result');
                    //Create the div that holds the thumbnail
                const thumbDiv = document.createElement('div');
                thumbDiv.setAttribute('class', 'room-thumbnail-div');
                resultDiv.append(thumbDiv);
                    //Create the thumbnail
                const thumbnail = document.createElement('img');
                thumbnail.setAttribute('class', 'room-thumbnail');
                thumbnail.setAttribute('src', room.thumbnail);
                    //Add a tag
                const thumbLink = document.createElement('a');
                thumbLink.setAttribute('href', url+room.roomID);                    
                    //Add thumbnail to the a tag containing it                                        
                thumbLink.appendChild(thumbnail);
                    //Add a tag to thumbdiv
                thumbDiv.append(thumbLink);

                // const nameDiv = document.createElement('div');
                // nameDiv.setAttribute('class', 'room-name-div');
                // resultDiv.append(nameDiv);
                    //Create room name
                const roomName = document.createElement('span');
                roomName.setAttribute('class', 'room-name');
                const nameText = document.createTextNode(room.roomName);
                roomName.appendChild(nameText);
                    //Add roomName to result
                resultDiv.append(roomName);

                    //Create description
                const description = document.createElement('span');
                description.setAttribute('class', 'room-description');
                const shortenedDescription = room.roomDescription.substring(0, 240) + "..."; 
                const descriptionText = document.createTextNode(shortenedDescription);
                description.appendChild(descriptionText);
                    //Add description to result
                resultDiv.append(description);

                    //Create the user count
                const userCount = document.createElement('span');
                userCount.setAttribute('class', 'room-user-count');
                const userCountText = document.createTextNode(room.users.length);
                userCount.appendChild(userCountText);
                    //Add the count to the result
                resultDiv.append(userCount);

                    //NSFW Status
                const nsfwStatus = document.createElement('span');
                const status = room.nsfw ?
                    'fas fa-thumbs-up nsfw-green' :
                    'fas fa-exclamation-triangle nsfw-red';
                nsfwStatus.className = status;
                    //Add nsfw status to result
                resultDiv.append(nsfwStatus);

                    //NSFW Status
                const securityStatus = document.createElement('span');
                const security = room.securitySetting == 0 ?
                    'fas fa-lock-open' :
                    'fas fa-lock';                
                securityStatus.className = security;
                    //Add security status to result
                resultDiv.append(securityStatus);

                console.log(JSON.stringify(roomListContainer, null, 2));

                    //Finally add it all to the list.
                roomListContainer.append(resultDiv);
            }//if securitysetting != 2
        });//map
        console.log(JSON.stringify(roomListContainer, null, 2));
    }//createRoomsList()

    function checkServerForRooms(){
        $.ajax({
            url: '/get-rooms-list',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({userID: localStorage.getItem('userID')}, null, 2),
            success: res=>{
                //use res.rooms
                console.log(`ROOMS ARE: ${JSON.stringify(res.rooms, null, 2)}`);
                    //Fill the container div with divs that have
                    //display mode of grid, with their contents
                    //aligned to inner grids. The results will be
                    //flex items, because the container div is a
                    //flexbox
                    createRoomsList(res.rooms);
            }
        });
    }

    $('#refresh-button').click(e=>{
        $.ajax({
            url: '/get-rooms-list',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({userID: localStorage.getItem('userID')}, null, 2),
            success: res=>{
                //use res.rooms
                console.log(`ROOMS ARE: ${JSON.stringify(res.rooms, null, 2)}`);
                    //Fill the container div with divs that have
                    //display mode of grid, with their contents
                    //aligned to inner grids. The results will be
                    //flex items, because the container div is a
                    //flexbox
                    createRoomsList(res.rooms);
            }
        });
    });

});