require('dotenv').load();
require('colors');

if(!process.env.ghusername || !process.env.ghpassword){
    console.error('Missing environment variables:\nSet ghusername and ghpassword environment variables (or .env file)'.red);
    return;
}


var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var enrouten = require('express-enrouten');
var serveStatic = require('serve-static');

var app = express();

app.set('gh_credentials', {
    login: process.env.ghusername,
    password: process.env.ghpassword
});

app.set('port', process.env.PORT || 3000);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(serveStatic(path.join(__dirname, 'public'), {
    setHeaders: function(res, path){
        if(path.split(/\./).pop() === "hbs"){
            res.setHeader('Content-Type', 'text/html');
        }
    }
}));


app.use(enrouten({ directory: path.join(__dirname, 'routes') }));


// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


app.listen(app.get('port'), function() {
    console.log('Node app is running on port', app.get('port'));
});


module.exports = app;
