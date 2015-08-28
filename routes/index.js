var config = require('../config');

//var Firebase = require('firebase');
//var firebase = new Firebase( config.firebaseUrl );

var xhr = require('request');
var async = require('async');
var $ = require('cheerio');
require('colors');

var credentials = {
    login: '',
    password: ''
};

module.exports = function (router) {

    var authenticity_token = '';
    var prs = [];

    // NOTE: router paths are based on the location of this file
    router.get('/', function (req, res) {
        async.series([
            // get the authenticity_token
            function(cb){
                xhr('https://github.com/login', {jar: true}, function(err, resp, body) {
                    console.log('LOGIN RESPONSE', resp);
                    credentials.authenticity_token = $(body).find('input[name="authenticity_token"]').val();
                    console.log("\n\ngithub login page\n\n".green, credentials.authenticity_token);
                    cb();
                });
            },
            // log in
            function(cb){
                xhr.post('https://github.com/session', {form: credentials, jar: true}, function(err, resp, body){
                    console.log("\n\ngithub .. logged in \n\n".green, $(body).find('title').text());
                    cb();
                });
            },
            // get stats...
            function(cb){
                xhr('https://github.com/CarMax/carmax.com/pulls?q=is%3Apr+milestone%3A"Build+Sprint+8"', {jar: true}, function(err, resp, body) {
                    $(body).find('.issue-title-link').each(function(i, el){
                        prs.push($(el).attr('href'));
                    });
                    console.log("PULL REQUESTS:", prs);

                    async.series(prs.map(function(prUrl){
                        return function(_cb){
                            xhr(prUrl, {jar: true}, function(err, resp, body){
                                var $ = $(body);
                                // todo: get the datapoints
                                // ...
                                _cb();
                            });
                        }
                    }));

                    cb()
                });
            },
            // render the response
            function(cb){
                res.send(prs);
                //res.render('index', {
                //    title: "GitHub Stats"
                //});
                cb();
            }
        ]);
    });
    
    router.post('/', function (req, res) {
        // tack on a property to track what time it is when we receive the notification
        req.body.received_at = (new Date()).toISOString();
        console.log('request body', req.body);
        firebase.push(req.body);
        res.send('ok');
    });

};
