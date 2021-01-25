const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const roomSchema = new Schema({
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
    history: {
        type: Array,
        required: true
    },
    hostSocketID: {
        type: String,
        required: false
    },
    users: {
        type: Array,
        required: false
    },
    videoSource: {
        type: Number,
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
        required: true
    },
    videoDuration: {
        type: Number,
        require: false
    }
},
{timestamps: true}
);

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;