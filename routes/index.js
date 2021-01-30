const express = require('express');
const router = express.Router();
const {getRoomsList} = require('../utils/redisMongoQueries');

router.get('/', (req, res, next)=>{
    const successMessage = res.locals.successMessage;
    // getAllRooms()
    // .then(allRooms=>{
    //     const pageErrors = res.locals.errorMessage;
    //     res.render('homepage', {allRooms, successMessage, pageErrors});
    // })
    // .catch(error=>{
    //     console.log(error);
    //     res.render('errorPage', {error});//Show error page
    // });
    getRoomsList(res, false);
});

module.exports = router;