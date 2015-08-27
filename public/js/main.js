(function () {

    // todo - read from shared config.
    // config.js
    var config = {
        firebaseUrl: "https://sweltering-heat-1762.firebaseio.com/"
    };

    var firebase = new Firebase(config.firebaseUrl);
    var renderPoint = document.getElementById('output');

    _get("/js/templates/stats.hbs", function (res) {

        var template = Handlebars.compile(res.responseText);

        // get the data from firebase
        firebase.on("value", function (snapshot) {

            // we have the data now, so kill the loading animation.
            renderPoint.innerHTML = '';

            // the data from firebase
            var data = snapshot.val();

            //console.log(data);

            // pull requests
            var pullRequests = {};
            var pullRequestsWithUnknownNumbers = {};

            // group events "under" pull requests.
            Object.keys(data).forEach(function (key) {
                var item = data[key];
                // we only care about pull requests
                if (!(item.pull_request || item.commits || item.comment)) {
                    return;
                }

                // do we know what pr number this is?
                var prNumber = item.pull_request && item.pull_request.number ||
                    item.issue && item.issue.number ||
                    item.comment && item.comment.pull_request_url.split(/\//g).pop();

                var hasPRNumber = prNumber || prNumber === 0;

                // do we know what branch this is?
                var branch = item.pull_request && item.pull_request.head.ref ||
                        item.ref && item.ref.replace('refs/heads/', '');

                // commits may not include a pr number reference.
                // comments may not include a branch reference.

                var pullRequestsObjRef = pullRequests;
                if(!hasPRNumber){
                    prNumber = branch || Math.random();
                    // pullRequestsWithUnknownNumbers.push(prNumber);
                    pullRequestsObjRef = pullRequestsWithUnknownNumbers;
                    console.warn("no pr number for ", prNumber, item);
                }

                // initialize this datapoint, if not already
                pullRequestsObjRef[prNumber] = pullRequestsObjRef[prNumber] || {
                    number: prNumber,
                    events: [],
                    merges: 0,
                    labels: {}
                };

                // get a reference to this PR
                var pr = pullRequestsObjRef[prNumber];

                // add the branch name, if we know it
                if(branch && hasPRNumber){
                    pr.branch = branch;
                }

                // update the number of merges
                if (item.commits) {
                    item.commits.forEach(function (commit) {
                        if (commit.message.match(/merge/i)) {
                            console.log('merge', prNumber);
                            pr.merges++;
                        }
                    });
                }
                if (item.comment) {
                    if (item.comment.body.match(/merge/i)) {
                        console.log('merge', prNumber);
                        pr.merges++;
                    }
                }

                // how long ago was this event?
                item.ago = timeSince(new Date(item.received_at)) + ' ago';

                // only add this event to the branch's events array if it is a label event
                if (item.label) {
                    pr.hasLabel = true;
                    item.label.textColor = getContrastingColor(item.label.color);

                    var prLabel = pr.labels[item.label] = pr.labels[item.label] || [];
                    prLabel.push(item.received_at);

                    // if action is 'unlabeled',
                    // check for the most recent "labeled" action for this label and calculate the elapsed time.
                    if (item.action === 'unlabeled') {
                        // do we know when this label was added?
                        // (going forward, we should always know, but in the beginning, we started tracking labels mid-sprint)
                        if (prLabel.length > 1) {
                            item.labelDuration = timeSince(new Date(prLabel[prLabel.length - 2]), new Date(item.received_at));
                        }
                    }

                    pr.events.push(item);
                }

            });

            // attempt to reconcile any branch-keyed PRs back to PR-Number-keyed PRs
            // ... this was more difficult than I expected.  Maybe fun for Sr. PLD / PLA :D
            Object.keys(pullRequestsWithUnknownNumbers).forEach(function(unknownNumber){
                var unknownPR = pullRequestsWithUnknownNumbers[unknownNumber];
                for(var key in pullRequests){
                    var pr = pullRequests[key];
                    if(pr.branch === unknownPR.number){
                        // consolidate
                        pr.merges += unknownPR.merges;
                        pr.events.concat(unknownPR.events);
                        return;
                    }
                }
            });

            // free up a bit of memory
            pullRequestsWithUnknownNumbers = null;

            // render the template into the page, but pass in pull requests as an array instead of a dictionary
            renderPoint.innerHTML = template({
                pullRequests: Object.keys(pullRequests).map(function (key) {
                    var pr = pullRequests[key];
                    //pr.events.reverse();
                    pr.merges = "" + pr.merges;
                    return pr;
                })//.reverse()
            });

        });

    });


    // utility functions

    // ajax get
    function _get(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            xhr.readyState == 4 && xhr.status == 200 && callback(xhr);
        };
        xhr.open("GET", url, true);
        xhr.send();
    }

    // eponymous
    function getContrastingColor(hexcolor) {
        var r = parseInt(hexcolor.substr(0, 2), 16);
        var g = parseInt(hexcolor.substr(2, 2), 16);
        var b = parseInt(hexcolor.substr(4, 2), 16);
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '000' : 'fff';
    }

    // => "5 minutes ago"
    function timeSince(from, to) {
        to = to || new Date();
        var seconds = Math.floor((to - from) / 1000);
        var units = ["year", "month", "day", "hour", "minute", "seconds"];
        var measures = [31536000, 2592000, 86400, 3600, 60, 1];
        for (var i = 0; i < units.length; i++) {
            var measurement = seconds / measures[i];
            if (measurement > 1) {
                if (("" + measurement.toFixed(1)).substr(-1) === 0) {
                    measurement = measurement.toFixed(0);
                }
                return measurement.toFixed(1) + ' ' + units[i] + (measurement > 1 ? 's' : '');
            }
        }
    }

})();
