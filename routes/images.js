const path = require('path');
const express = require('express');
const router = express.Router();

router.get('/images', (req, res, next)=>{
    // console.log("TEST");
    res.send('ERROR: NO IMAGE SPECIFIED');
});

router.get('/thumbs/:imageName', (req, res, next)=>{
    res.sendFile(path.join(__dirname, '../images/thumbs', req.params.imageName));
});

module.exports = router;