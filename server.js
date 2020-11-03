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

app.listen(port, function(){
    console.log(`Server listening on: ${port}`);
});