
module.exports = function (router) {
    // NOTE: router paths are based on the location of this file
    router.get('/', function (req, res) {
        res.render('index', {title: "GitHub Stats"});
    });
};
