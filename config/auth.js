module.exports = {
    ensureAuthenticated: function(req, res, next){
        if(req.isAuthenticated()){
            return next();
        } else {
            req.flash('error_msg', 'Please log into your account');
            res.redirect('/user/login');
        }
    }//ensureauthenticated
}