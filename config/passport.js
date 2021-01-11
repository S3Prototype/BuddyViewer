const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/user');
// ! We're at 1:08:58 of this video:
// ? https://youtu.be/6FOq4cUdH8k?t=4138
module.exports = function(passport){
    passport.use(
        new LocalStrategy(
            {usernameField: 'userNameOrEmail'},
            (userNameOrEmail, password, done)=>{
                UserModel.findOne(
                    {$or:[{email: userNameOrEmail},
                        {userName: userNameOrEmail}
                    ]}
                )
                .then(foundUser=>{
                    if(!foundUser){
                        done(null, false, 'That email is not registered.');
                    } else {
                        bcrypt.compare(password, foundUser.password,
                            (err, isMatch)=>{
                                if(err) console.log(err);
                                if(!isMatch){
                                    return done(null, false, 'Incorrect username/email or password');
                                } else {
                                    return done(null, foundUser);
                                }
                            }//err, isMatch
                        )//compare()
                    }//else

                })
            }
        )//new LocalStrategy
    )//passport.use()
}