(function () {

    var data = null;
    var template = null;
    var renderPoint = document.getElementById('output');
    var spinnerHTML = renderPoint.innerHTML;

    var sprintSelect = document.getElementById('sprint');
    var sprint = sprintSelect.value;

    var isShouldRefreshDataCheckbox = document.getElementById('isShouldRefreshData');

    console.log('sprint', sprint);

    // re-render the page if the sprint selection changes.
    sprintSelect.addEventListener('change', function(e){
        renderPoint.innerHTML = spinnerHTML;
        console.log('selection changed');
        sprint = sprintSelect.value;
        main();
    });

    function main() {

        data = null;

        var isShouldRefreshData = isShouldRefreshDataCheckbox.checked;

        // get the data
        _get("/data/" + sprint + (isShouldRefreshData ? '?refresh=true' : ''), function (res) {
            data = JSON.parse(res.responseText);
        });

        // unset this value.
        isShouldRefreshDataCheckbox.checked = false;

        // get the template
        if(!template) {
            _get("/js/templates/stats.hbs", function (res) {
                template = Handlebars.compile(res.responseText);
            });
        }

        // wait for the template and data, then render the page.
        (function onReady() {

            if (!template || !data) {

                setTimeout(onReady, 20);

            } else {

                // might be nice to do this when saving the data .. but probably doesn't take long to compute.
                data.forEach(function (pr) {
                    var labelsByText = {};
                    var lastWIPRemoval = null;
                    pr.labels.forEach(function (label) {
                        var labelEvents = labelsByText[label.text] = labelsByText[label.text] || [];
                        labelEvents.push(label);
                        label.action = labelEvents.length > 1 && labelEvents.length % 2 === 0 ? 'unlabeled' : 'labeled';
                        if (label.action === 'unlabeled') {
                            if (label.text.match(/wip/i)) {
                                lastWIPRemoval = label.timestamp;
                            } else {
                                label.duration = timeSince(new Date(labelEvents[labelEvents.length - 2].timestamp), new Date(label.timestamp));
                            }
                        }
                    });
                    if (pr.mergedAt) {
                        pr.timeToMerge = timeSince(new Date(lastWIPRemoval), new Date(pr.mergedAt));
                    }
                    pr.totalTime = timeSince(new Date(pr.createdAt), new Date(pr.mergedAt || pr.closedAt));
                });

                // render the template into the page, but pass in pull requests as an array instead of a dictionary
                renderPoint.innerHTML = template({pullRequests: data});

            }

        })();

    }

    main();


    // utility functions

    /**
     * AJAX Get
     * @param url
     * @param callback
     * @private
     */
    function _get(url, callback) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            xhr.readyState == 4 && xhr.status == 200 && callback(xhr);
        };
        xhr.open("GET", url, true);
        xhr.send();
    }

    /**
     * Returns either white or black, depending on how light or dark the other color is (the parameter)
     * @param hexcolor {string}
     * @returns {string}
     */
    function getContrastingColor(hexcolor) {
        var r = parseInt(hexcolor.substr(0, 2), 16);
        var g = parseInt(hexcolor.substr(2, 2), 16);
        var b = parseInt(hexcolor.substr(4, 2), 16);
        var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '000' : 'fff';
    }

    /**
     * Calculates human-readable and convenient time difference, such as "5 minutes"
     * 'ago' or 'from now' should be added by the calling context, it is not returned here.
     * @param from {Date}
     * @param to {Date}
     * @returns {string}
     */
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
