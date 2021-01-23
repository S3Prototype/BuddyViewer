const express = require('express');
const router = express.Router();
const UserModel = require('../models/user');
const bcrypt = require('bcryptjs');
const {v4: uuidV4} = require('uuid');
const passport = require('passport');
// const {getAllRooms} = require('../utils/roomQueries');
const {ensureAuthenticated} = require('../config/auth');

router.get('/login', (req, res)=>{
    const formErrors = res.locals.error;
    const successMessage = res.locals.successMessage;
    res.render('login', {formErrors, successMessage});
});

router.get('/dashboard', ensureAuthenticated, (req, res)=>{
    res.render('dashboard');
});

router.get('/logout', (req, res)=>{
    req.logout();
    req.flash('successMessage', "You are logged out!");
    res.redirect('/');
});

router.get('/signup', (req, res)=>{
    const errorMessages = res.locals.errorMessage;
    res.render('signup', {errorMessages});
});

router.post('/signup', (req, res)=>{
    const {
            userName,
            firstName,
            lastName,
            email,
            password,
            password2
                        } = req.body;

    let errors = [];

    function addError(message){
        req.flash('errorMessage', message);
        errors.push({msg: message});
    }

    if(!userName ||!firstName || !email || !password || !password2){
        addError('Please fill in all the fields.');
    }

    if(password != password2){
        addError('Passwords don\'t match!');
    }

    if(password.length < 6){
        addError('Password must be at least 6 characters!');
    }

    const data = {            
        errors,
        userName,
        firstName,
        lastName,
        email,
        password,
        password2
    };

    if(errors.length > 0){
        res.render('signup', data);        
    } else {
        UserModel.findOne({$or:[{email}, {userName}]})
            .then(foundUser=>{
                if(foundUser){
                    addError('That email is already registered.');                    
                    res.render('signup', data);
                } else {
                    const saltRounds = 10;
                    bcrypt.genSalt(saltRounds, (err, salt)=>{
                        bcrypt.hash(password, salt, (err, hash)=>{
                            if(err){
                                console.log('Error hashing password.');
                                console.log(err);
                                addError('Error hashing password. '+ err);
                                res.render('signup', data);
                            } else {
                                const newID = uuidV4();
                                const newUser = new UserModel({
                                    userName,
                                    userID: userName+'-'+newID,
                                    shortID: userName+'-'+newID.substring(0, 8),
                                    firstName,
                                    lastName,
                                    email,
                                    password: hash
                                });
                                newUser.save()
                                .then(savedUser=>{
                                    console.log(savedUser);
                                    // res.send(savedUser);
                                    req.flash('successMessage', "You're now registered! Please log in.");
                                    res.redirect('/user/login');
                                });
                            }
                        });
                    });
                }
            });
    }
});

//Login handle
router.post('/login', (req, res, next)=>{
    passport.authenticate('local',{
        successRedirect: '/',
        failureRedirect: '/user/login',
        failureFlash: true
    })(req, res, next);
});

module.exports = router;