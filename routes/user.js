const express = require('express');
const router = express.Router();
// const {getAllRooms} = require('../utils/roomQueries');

router.get('/login', (req, res)=>{
    res.send("logging in!");
});

router.get('/signup', (req, res)=>{
    res.render('signup');
});

router.post('/signup', (req, res)=>{
    const { firstName, lastName, email, password, password2 } = req.body;

    let errors = [];
    function addError(message){
        errors.push({msg: message});
    }
    if(!firstName || !email || !password || !password2){
        addError('Please fill in all the fields.');
    }

    if(password != password2){
        addError('Passwords don\'t match!');
    }

    if(password.length < 6){
        addError('Password must be at least 6 characters!');
    }
    if(errors.length > 0){
        res.render('signup', {
            errors,
            firstName,
            lastName,
            email,
            password,
            password2
        });
    } else {
        res.send("Success!");
    }
});


module.exports = router;