module.exports = function (app, pool) {

    /* Server Home Page
    - Renders the home page
    - Queries the database for the servers that the user has access to
    */
    app.get('/home', function (req, res) {
        if (req.session.loggedin) {
            query_string = 'SELECT * FROM ' + req.session.username;
            pool.query(query_string, (err, resp) => {
                // console.table(resp.rows);
                let servers = [];
                for (const row of resp.rows) {
                    if (row.can_access.toLowerCase() == 'true') {
                        // console.log(row.server_name);
                        servers.push(row.server_name);
                    }
                }
                if (req.session.username == 'admin') {
                    servers.unshift('admin');
                }

                res.render('pages/home.ejs', {
                    servers: servers,
                    user: req.session.username
                });
            });
        } else {
            res.redirect('/login');
        }
    });
};