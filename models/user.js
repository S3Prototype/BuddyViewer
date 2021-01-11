const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    userName: {
        type: String,
        required: true
    },
    userID:{
        type: String,
        required: true
    },
    shortID:{
        type: String,
        required: true
    },
    email:{
        type: String,
        require: true
    },
    password:{
        type: String,
        require: true
    },
    pfp: {
        type: String,
        required: false
    },
    friends: {
        type: Array,
        required: false
    }
},
{timestamps: true}
);

const User = mongoose.model('User', userSchema);

module.exports = User;