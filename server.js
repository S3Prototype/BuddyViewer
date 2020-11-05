var express = require('express');
var bodyparser = require('body-parser');
var app = express();

var products = [
    {
        id:1,
        name: 'laptop'
    },
    {
        id:2,
        name: 'microwave'
    }
];

var currentId = 2;

var port = process.env.PORT || 8084


app.use(express.static(__dirname));
app.use(bodyparser.json());

app.get('/products', function(req, res){
    res.send({products : products});
});

app.post('/products', function(req, res){
    let productName = req.body.name;
    currentId++;

    products.push({
        id: currentId,
        name: productName
    });

    res.send('Successfully created product!');

});

app.put('/products/:id', function(req, res){
    let id = req.params.id;
    let found = false;
    let newName = req.body.newName;

    products.forEach(function(product, index){
        if(!found && product.id === Number(id)){
            product.name = newName;
        }
    });

    res.send('successfully updated products!');

});

app.delete('/products/:id', function(req, res){
    let id = req.params.id;
    let found = false;

    products.forEach(function(individualProduct, index){
        if(!found && individualProduct.id === Number(id)){
            products.splice(index, 1);
            found = true;
        }
    });

    res.send('successfully deleted product');
});

app.listen(port, function(){
    console.log(`Server listening on: ${port}`);
});