$(function(){

    $('#sorting-options').change(()=>{        
        $('#sorting-options option:selected').each(()=>{
            //You can just change the order attribute of
            //items in a flexbox. Sort through them that way.
            switch($(this).val()){
                case `lastCreated`:

                break;

                case `lastUpdated`:
                break;

                case `rAlphabetical`:
                break;

                case `alphabetical`:
                break;
            }
        });
    });
    
    const roomListContainer = document.getElementById('room-list-container');

    function createRoomsList(roomsList){
        console.log(roomsList);
        roomListContainer.innerHTML = "";
        const url = "/room";
        roomsList.forEach((room)=>{
            if(room.securitySetting != 2){
                    //Create the div that holds everything.
                const resultDiv = document.createElement('div');
                resultDiv.setAttribute('class', 'room-result');
            
                    //Create the div that holds the thumbnail
                const thumbDiv = document.createElement('div');
                thumbDiv.setAttribute('class', 'room-thumbnail-div');
                    //Create the thumbnail
                const thumbnail = document.createElement('img');
                thumbnail.setAttribute('class', 'room-thumbnail');
                thumbnail.setAttribute('src', room.thumbnail);
                    //Add <a> tag
                const thumbLink = document.createElement('a');
                thumbLink.setAttribute('href', url+"/"+room.roomID);                    
                    //Add thumbnail to the a tag containing it                                        
                thumbLink.appendChild(thumbnail);
                    //Add a tag to thumbdiv
                thumbDiv.append(thumbLink);

                resultDiv.append(thumbDiv);

                    //Create room name
                const roomName = document.createElement('div');
                roomName.setAttribute('class', 'room-name');
                const nameText = document.createTextNode(room.roomName);
                roomName.appendChild(nameText);
                    //Add roomName to result                                

                    //Create description
                const description = document.createElement('div');
                description.setAttribute('class', 'room-description');
                const elipses = room.roomDescription.length > 160 ? ' ...' : '';
                const shortenedDescription = room.roomDescription.substring(0, 160) + elipses; 
                const descriptionText = document.createTextNode(shortenedDescription);
                description.appendChild(descriptionText);

                    //Add name and desc to resultDiv
                const infoContainer = document.createElement('div');
                infoContainer.setAttribute('class', 'result-info-container');
                infoContainer.appendChild(roomName);
                infoContainer.appendChild(description);                    
                    //Add description to result
                resultDiv.append(infoContainer);

                //* Now create a div for the room stats.
                const roomStatsContainer = document.createElement('div');
                roomStatsContainer.setAttribute('class', 'room-stats-container');

                    //* create container for user icon and count
                const userInfoDiv = document.createElement('div');
                userInfoDiv.setAttribute('class', 'room-user-container');

                    //Create the user count
                const userCount = document.createElement('div');
                userCount.setAttribute('class', 'room-user-count');
                const userCountText = document.createTextNode(room.users.length);
                userCount.appendChild(userCountText);

                    //Add the count to the info div
                userInfoDiv.append(userCount);
                
                    //create user icon  
                const userIcon = document.createElement('img');
                userIcon.setAttribute('src', './icons/user.png');
                userInfoDiv.append(userIcon);    

                roomStatsContainer.append(userInfoDiv);

                    //NSFW Status
                const nsfwDiv = document.createElement('div');
                nsfwDiv.setAttribute('class', 'nsfw-container');
                const status = room.nsfw ?
                    './icons/nsfw.png' :
                    './icons/sfw1.png';
                
                const nsfwImage = document.createElement('img');
                nsfwImage.setAttribute('src', status);
                nsfwImage.setAttribute('class', 'nsfw-icon');

                nsfwDiv.append(nsfwImage);
                roomStatsContainer.append(nsfwDiv);

                    //Security Status
                const securityDiv = document.createElement('div');
                securityDiv.setAttribute('class', 'security-container');

                const securitySetting = room.securitySetting == 0 ?
                    './icons/unlocked.png' :
                    './icons/locked.png';

                const securityImage = document.createElement('img');
                securityImage.setAttribute('class', 'security-image');
                securityImage.setAttribute('src', securitySetting);
                
                securityDiv.append(securityImage);

                    //Add security status to result
                roomStatsContainer.append(securityDiv);

                resultDiv.append(roomStatsContainer);

                    //Finally add it all to the list.
                roomListContainer.append(resultDiv);
            }//if securitysetting != 2
        });//map
        // console.log(JSON.stringify(roomListContainer, null, 2));
    }//createRoomsList()

    createRoomsList(roomsArray);

    $('#refresh-button').click(e=>{
        //Temporarily disable the button to prevent
        //user from spamming.
        $('#refresh-button').attr('disabled', true);        
        $('#refresh-icon').removeClass('refresh-icon');
        setTimeout(()=>{
            $('#refresh-button').attr('disabled', false);    
            $('#refresh-icon').addClass('refresh-icon');
        }, 3000);
        //Now get the rooms.
        $.ajax({
            url: '/get-rooms-list',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({isForList: true}),
            success: res=>{
                //use res.rooms
                // console.log(`ROOMS ARE: ${JSON.stringify(res.rooms, null, 2)}`);
                    //Fill the container div with divs that have
                    //display mode of grid, with their contents
                    //aligned to inner grids. The results will be
                    //flex items, because the container div is a
                    //flexbox
                    // console.log(res.rooms);
                    roomsArray = res.allRooms;
                    createRoomsList(roomsArray);
            }
        });
    });

    const emptyCheckboxURL = `./icons/checkbox_empty.png`;
    const checkedCheckboxURL = `./icons/checkbox_checked.png`;

    $('label').click(function(){
        const labelFor = $(this).attr('for');
        const dashIndex = labelFor.indexOf('-');
        const radioName = dashIndex !== -1 ?
            labelFor.substring(0, dashIndex) : labelFor;            

        // console.log(radioName);
        // console.log($(`input[type=radio][value="${radioName}"]`));
        // $(`input[type=radio][value="${radioName}"]`).click();
        $(`#${radioName}`).click();
    });

    $('#security-settings img').click(function(){
        const imgID = $(this).attr('id');
        const radioName = imgID.substring(0, imgID.indexOf('-'));
        $(`input[value="${radioName}"]`).click();        
    });

    $('#room-sort-controls label').click(function(){
        const labelFor = $(this).attr('for');
        const dashIndex = labelFor.indexOf('-');
        const radioName = dashIndex !== -1 ?
            labelFor.substring(0, dashIndex) : labelFor; 

        const sortLabels = $('#room-sort-controls label');
        sortLabels.each(function(){
            console.log($(this).attr('class'));
            if($(this).hasClass('selected-option')){
                $(this).removeClass('selected-option');
            }
        });

        $(this).addClass('selected-option');
    });

    $('input[type=radio][name=securitySetting]').change(function() {
        // console.log($(this).val());
        const securityRadios = $('input[type=radio][name=securitySetting]');
        securityRadios.each(function(){ 
            let checkedStatus = $(this).is(':checked') ? checkedCheckboxURL : emptyCheckboxURL;
            $(`#${$(this).val()}-checkbox`).attr('src', checkedStatus);                                       
        });
    });

    function resizeIcons(){
        const icons = [
            $('#refresh-icon'),
            $('#searchbar-icon')
        ];

        icons.forEach(icon=>icon.removeClass('fa-2x fa-3x fa-lg fa-sm'));

        if (window.innerWidth < 800){
            icons.forEach(icon=>icon.addClass('fa-lg')); 
        } else if(window.innerWidth < 1000){
            icons.forEach(icon=>icon.addClass('fa-2x')); 
        } else if (window.innerWidth > 1000) {
            icons.forEach(icon=>icon.addClass('fa-3x'));
        }
    }
    
    window.onresize = function(event){
        resizeIcons();
    }

    resizeIcons();

    
    
});