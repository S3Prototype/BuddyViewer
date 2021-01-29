
function logFailure(goal, error){
    console.log(`Failed to ${goal} becuase: \n${error}`);
}

module.exports = {
    logFailure
}