$(function(){
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

    //POST/CREATE
    $('#create-form').on('submit', function(event){
        event.preventDefault();
        let createInput = $('#create-input');

        $.ajax({
            url: '/products',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ name: createInput.val() }),
            success: function(response){
                console.log("inputworked!");
                createInput.val('');
                $('#get-products').click();
            }

        });
           
    });

    //PUT/UPDATE
    $('table').on('click', '.update-button', function(){
        let rowEl = $(this).closest('tr');
        let id = rowEl.find('.id').text();
        let newName = rowEl.find('.name').val();

        $.ajax({
            url: '/products/' + id,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({newName: newName}),
            success: function(response){
                console.log(this.url);
                $('get-products').click();
            }
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