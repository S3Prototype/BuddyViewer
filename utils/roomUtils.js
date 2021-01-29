const RoomSecurity = {
    OPEN: 0,
    LOCKED: 1,
    PRIVATE: 2
}

const defaultDescription = "A lovely room for watching videos! Join!";
const defaultSecuritySetting = RoomSecurity.OPEN;


module.exports = {
    RoomSecurity,
    defaultDescription,
    defaultSecuritySetting
}