var config = require('../config');

//var Firebase = require('firebase');
//var firebase = new Firebase( config.firebaseUrl );

var xhr = require('request');
var async = require('async');
var $$ = require('cheerio');
require('colors');

var credentials = {
    login: process.env.ghusername,
    password: process.env.ghpassword
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
                    credentials.authenticity_token = $$(body).find('input[name="authenticity_token"]').val();
                    console.log("\n\ngithub login page\n\n".green, credentials.authenticity_token);
                    cb();
                });
            },
            // log in
            function(cb){
                xhr.post('https://github.com/session', {form: credentials, jar: true}, function(err, resp, body){
                    console.log("\n\ngithub .. logged in \n\n".green, $$(body).find('title').text());
                    cb();
                });
            },
            // get stats...
            function(cb){
                xhr('https://github.com/CarMax/carmax.com/pulls?q=is%3Apr+milestone%3A"Build+Sprint+8"', {jar: true}, function(err, resp, body) {
                    $$(body).find('.issue-title-link').each(function(i, el){
                        prs.push($$(el).attr('href'));
                    });
                    console.log("PULL REQUESTS:", prs);

                    async.parallel(prs.map(function(prUrl, prIndex){
                        return function(_cb){
                            xhr('https://github.com' + prUrl, {jar: true}, function(err, resp, body){

                                var $ = $$(body);
                                var headerTextNode = $.find('.timeline-comment-header-text').eq(0);

                                var pr = {
                                    title: $.find('.js-issue-title').text().trim(),
                                    number: $.find('.gh-header-number').text().trim().replace('#', ''),
                                    initiator: headerTextNode.find('strong').text().trim(),
                                    createdAt: headerTextNode.find('time').attr('datetime'),
                                    branch: $.find('.current-branch').eq(1).text().trim()
                                };

                                // how many times was this ticket passed around?
                                pr.numAssignments = $.find('.discussion-item-assigned').length;

                                // how many code comments were addressed?
                                pr.numCodeCommentsAddressed = $.find('.outdated-diff-comment-container').length;

                                // labels -- see PR 197
                                pr.labels = [];
                                $.find('.discussion-item-labeled, .discussion-item-unlabeled').each(function(){
                                    // ... there could be more than one label added/removed at a time.
                                    $$(this).find('.label-color').each(function(){
                                        var label = $$(this);
                                        pr.labels.push({
                                            label: label.text().trim(),
                                            timestamp: label.find('time').attr('datetime'),
                                            color: label.attr('style').replace(/.*(#\d+).*/,'$1'),
                                            textColor: label.find('a').attr('style').replace(/.*(#\d+).*/,'$1')
                                        });
                                    });
                                });

                                // number of merges
                                pr.numMerges = 0;
                                $.find('.commit-message').each(function(i, el){
                                    if($$(el).html().match(/merge/i)){
                                        pr.numMerges++;
                                    }
                                });

                                // is this branch merged?
                                var mergedNode = $.find('.discussion-item-merged');
                                if(mergedNode){
                                    pr.mergedAt = mergedNode.find('time').attr('datetime');
                                }

                                // is this branch closed?
                                var closedNode = $.find('.discussion-item-closed');
                                if(closedNode){
                                    pr.mergedAt = closedNode.find('time').attr('datetime');
                                }

                                prs[prIndex] = pr;
                                _cb();
                            });
                        }
                    }), cb);
                });
            },
            // render the response
            function(cb){
                console.log(prs);
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
