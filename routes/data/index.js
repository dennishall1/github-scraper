var fs = require('fs');
var path = require('path');

var xhr = require('request');
var async = require('async');
var $$ = require('cheerio');
require('colors');

module.exports = function (router) {

    var authenticity_token = '';
    var prs = [];

    // NOTE: router paths are based on the location of this file
    router.get('/:sprint', function (req, res) {

        var credentials = req.app.get('gh_credentials');

        var data = '';

        var sprint = req.params.sprint || 8;

        try{
            data = fs.readFileSync(path.join(__dirname, '../../prs-' + sprint + '.json'), 'utf8');
        }catch(e){}

        if(!req.query.refresh && data){

            res.set('content-type', 'application/json');
            res.send(data);

        } else {

            async.series([
                // get the authenticity_token
                function (cb) {
                    xhr('https://github.com/login', {jar: true}, function (err, resp, body) {
                        credentials.authenticity_token = $$(body).find('input[name="authenticity_token"]').val();
                        console.log("\n\ngithub login page\n\n".green, credentials.authenticity_token);
                        cb();
                    });
                },
                // log in
                function (cb) {
                    xhr.post('https://github.com/session', {form: credentials, jar: true}, function (err, resp, body) {
                        console.log("\n\ngithub .. logged in \n\n".green, $$(body).find('title').text());
                        cb();
                    });
                },
                // get stats...
                function (cb) {
                    xhr('https://github.com/CarMax/carmax.com/pulls?q=is%3Apr+milestone%3A"Build+Sprint+' + sprint + '"', {jar: true}, function (err, resp, body) {

                        //fs.writeFileSync(path.join(__dirname, '../../scraped-html/sprint' + sprint + '-prs.html'), body);

                        $$(body).find('.issue-title-link').each(function (i, el) {
                            prs.push($$(el).attr('href'));
                        });
                        console.log("PULL REQUESTS:", prs);

                        async.parallel(prs.map(function (prUrl, prIndex) {
                            return function (_cb) {
                                xhr('https://github.com' + prUrl, {jar: true}, function (err, resp, body) {

                                    var $ = $$(body);
                                    var headerTextNode = $.find('.timeline-comment-header-text').eq(0);
                                    var avatar_url = $.find('.timeline-comment-wrapper.js-comment-container img').attr('src');

                                    var pr = {
                                        title: $.find('.js-issue-title').text().trim(),
                                        number: $.find('.gh-header-number').text().trim().replace('#', ''),
                                        user: {
                                            login: headerTextNode.find('strong').text().trim(),
                                            avatar_url: avatar_url
                                        },
                                        createdAt: headerTextNode.find('time').attr('datetime'),
                                        branch: $.find('.current-branch').eq(1).text().trim()
                                    };

                                    // how many times was this ticket passed around?
                                    pr.numAssignments = $.find('.discussion-item-assigned').length;

                                    // how many code comments were addressed?
                                    pr.numCodeCommentsAddressed = $.find('.outdated-diff-comment-container').length;

                                    // labels -- see PR 197
                                    pr.labels = [];
                                    $.find('.discussion-item-labeled, .discussion-item-unlabeled').each(function () {
                                        var discussionItem = $$(this);
                                        // ... there could be more than one label added/removed at a time.
                                        $$(this).find('.label-color').each(function () {
                                            var label = $$(this);
                                            pr.labels.push({
                                                text: label.text().trim(),
                                                timestamp: discussionItem.find('time').attr('datetime'),
                                                color: label.attr('style').replace(/.*#([0-9a-f]+).*/i, '$1'),
                                                textColor: label.find('a').attr('style').replace(/.*#([0-9a-f]+).*/i, '$1'),
                                                user: {
                                                    login: discussionItem.find('img').attr('alt').replace('@',''),
                                                    avatar_url: discussionItem.find('img').attr('src')
                                                }
                                            });
                                        });
                                    });

                                    // number of merges
                                    pr.numMerges = 0;
                                    $.find('.commit-message').each(function (i, el) {
                                        if ($$(el).html().match(/merge/i)) {
                                            pr.numMerges++;
                                        }
                                    });

                                    // is this branch merged?
                                    var mergedAtNode = $.find('.discussion-item-merged time');
                                    console.log('mergedAtNode', mergedAtNode);
                                    if (mergedAtNode.length > 0) {
                                        pr.mergedAt = mergedAtNode.attr('datetime');
                                    }

                                    // is this branch closed?
                                    var closedAtNode = $.find('.discussion-item-closed time');
                                    console.log('closedAtNode', closedAtNode);
                                    if (closedAtNode.length > 0) {
                                        pr.closedAt = closedAtNode.attr('datetime');
                                    }

                                    prs[prIndex] = pr;
                                    _cb();
                                });
                            }
                        }), cb);
                    });
                },
                // render the response
                function (cb) {
                    console.log(prs);
                    fs.writeFileSync(path.join(__dirname, '../../prs-' + sprint + '.json'), JSON.stringify(prs));
                    res.set('content-type', 'application/json');
                    res.send(prs);
                    cb();
                }
            ]);

        }
    });

    router.post('/', function (req, res) {
        // tack on a property to track what time it is when we receive the notification
        req.body.received_at = (new Date()).toISOString();
        console.log('request body', req.body);
        firebase.push(req.body);
        res.send('ok');
    });

};
