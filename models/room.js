const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomScheme = new Schema({
    roomName: {
        type: String,
        required: true
    },
    roomID:{
        type: String,
        required: true
    },   
    roomDescription: {
        type: String,
        required: false
    },
    nsfw: {
        type: Boolean,
        required: true
    },
    securitySetting: {
        type: Number,
        required: false
    },
    thumbnail: {
        type: String,
        required: false
    },
    hostSocketID: {
        type: String,
        required: false
    },
    users: {
        type: Array,
        required: false
    },
    videoID: {
        type: String,
        required: false
    },
    videoTime: {
        type: Number,
        required: false
    },
    videoState: {
        type: Number,
        required: false
    },
    playRate: {
        type: Number,
        required: false
    },
    messages: {
        type: Array,
        required: false
    }
},
{timestamps: true}
);

const Room = mongoose.model('Room', roomScheme);

module.exports = Room;