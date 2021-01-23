const express = require('express');
const router = express.Router();
const {getAllRooms} = require('../utils/roomQueries');

router.get('/', (req, res, next)=>{
    // console.log("TEST");
    getAllRooms()
    .then(allRooms=>{
        if(allRooms){
            res.render('homepage', {allRooms});
        } else {
            res.send("FAILED TO GET INDEX");
        }
    })
    .catch(error=>{
        console.log(error);
        res.send('error', {error});//Show error page
    })
    .finally(_=>{
        // res.render('homepage');
    });
    // res.render('homepage');
});

module.exports = router;