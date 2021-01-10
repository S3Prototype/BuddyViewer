const RoomModel = require('../models/room');

function getAllRooms(){
    return RoomModel.find();
}

module.exports = {
    getAllRooms
}