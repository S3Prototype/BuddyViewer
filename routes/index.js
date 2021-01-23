const express = require('express');
const router = express.Router();
const {getAllRooms} = require('../utils/roomQueries');

router.get('/', (req, res, next)=>{
    // console.log("TEST");
    const successMessage = res.locals.successMessage;
    getAllRooms()
    .then(allRooms=>{
        const pageErrors = res.locals.errorMessage;
        res.render('homepage', {allRooms, successMessage, pageErrors});
    })
    .catch(error=>{
        console.log(error);
        res.render('errorPage', {error});//Show error page
    })
});

module.exports = router;