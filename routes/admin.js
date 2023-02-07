const { check } = require('express-validator'); // Used in user page/ deleting user
const { Pool } = require('pg'); // Used in deleting user

module.exports = function (app, pool, blacklist) {
    /* Admin page
    - Gets the list of users
    - Allows the admin to add/delete a user
    */
    app.get('/admin', function (req, res) {
        if (req.session.loggedin) {
            if (req.session.username == 'admin') {
                query_string = 'SELECT username FROM accounts';
                let accounts = []
                pool.query(query_string, (error, results) => {
                    for (let row of results.rows) {
                        accounts.push(row.username);
                    }
                    res.render('pages/admin', {
                        accounts: accounts,
                        err_msg_admin: '',
                        succ_msg_admin: ''
                    });
                });
            } else {
                res.redirect('/home');
            }
        } else {
            req.session.returnURL = '/admin';
            res.redirect('/login');
        }
    });

    /* Admin page for a specific user
    - Gets the list of servers that the user has access to
    - Allows the admin to add or remove access to a server
    */
    app.get('/admin/:user', [
        check('user').trim().blacklist(blacklist).replace(' ', ''),
        check('server').trim().blacklist(blacklist).replace(' ', '')],
        function (req, res) {
            if (req.session.loggedin) {
                if (req.session.username == 'admin') {
                    let err_db_msg;
                    let succ_db_msg;
                    if (req.session.err_msg_db) {
                        err_db_msg = req.session.err_msg_db;
                        req.session.err_msg_db = null;
                    } else {
                        succ_db_msg = req.session.succ_msg_db;
                        req.session.succ_msg_db = null;
                    }

                    // Select all rows from the table
                    let user = req.params.user;
                    query_string = 'SELECT * FROM ' + user
                    pool.query(query_string, (error, results) => {
                        if (error) throw error;
                        let data = [] // List of dicts
                        for (let row of results.rows) {
                            let dict = {}
                            dict['server_name'] = row.server_name
                            dict['can_access'] = row.can_access
                            data.push(dict)
                        }

                        res.render('pages/user.ejs', {
                            servers: data,
                            user: user,
                            err_msg: err_db_msg,
                            succ_msg: succ_db_msg
                        });
                    });
                } else {
                    res.redirect('/home');
                }
            } else {
                req.session.returnURL = '/users/' + req.params.user;
                res.redirect('/login');
            }
        });

    app.post('/admin/:user/delete', check('user').trim().blacklist(blacklist).replace(' ', ''), function (req, res) {
        if (req.session.loggedin) {
            if (req.session.username == 'admin') {
                const pool_write = new Pool({
                    user: process.env.USER_WRITE,
                    host: 'db.bit.io',
                    database: process.env.DB, // public database 
                    password: process.env.PASSWD_WRITE, // key from bit.io database page connect menu
                    port: 5432,
                    ssl: true,
                });
                let user = req.params.user;
                query_string = "DELETE FROM accounts WHERE username= $1";
                pool_write.query(query_string, [user], (error, results) => { // Delete user from accounts table
                    // console.log("Delete user from accounts: " + results);
                });

                query_string = 'DROP TABLE ' + user;
                pool_write.query(query_string, (error, results) => { // Delete user from accounts table
                    // console.log("Drop user table: " + results);
                });

                run()
                async function run() {
                    await new Promise(resolve => setTimeout(resolve, 300));;
                    pool_write.end();
                    res.redirect('/admin');
                }


            }
        } else {
            req.session.returnURL = '/users/' + req.params.user;
            res.redirect('/login');
        }
    });

    //Adds new user
    app.post('/send_user', [
        check('username').isLength({ min: 5 }).trim().escape().blacklist(blacklist).replace(' ', ''),
        check('password').isLength({ min: 5 }).trim().blacklist(blacklist).replace(' ', ''),
        check('email').isEmail().trim().normalizeEmail()
    ], function (request, response) {
        if (request.session.loggedin) {
            let username = request.body.username;
            let password = request.body.password;
            let email = request.body.email;
            if (username && password) {
                //Connect to the database with the db write user
                const pool_write = new Pool({
                    user: process.env.USER_WRITE,
                    host: 'db.bit.io',
                    database: process.env.DB, // public database 
                    password: process.env.PASSWD_WRITE, // key from bit.io database page connect menu
                    port: 5432,
                    ssl: true,
                });
                query_string = "SELECT MAX(id) FROM accounts"; //Gets the current highest id
                pool.query(query_string, (err, res) => {
                    id = res.rows[0].max + 1;
                    let query_string_account = "INSERT INTO accounts (id, username, password, email) VALUES ($1, $2, $3, $4)";
                    pool_write.query(
                        query_string_account,
                        [id, username, password, email],
                        function (error, results, fields) {
                            // If there is an issue with the query, output the error
                            if (error) throw error;
                            // If the account exists
                            console.log(results);
                            response.end();
                        });

                    // Create new user table
                    let query_string_table = 'CREATE TABLE ' + username + ' (server_name text,can_access text)';
                    pool_write.query(
                        query_string_table,
                        function (error, results, fields) {
                            // If there is an issue with the query, output the error
                            if (error) throw error;
                            // If the account exists
                            console.log(results);
                            response.end();
                        });

                    pool_write.end(); // End the connection to the database
                    response.redirect('/admin');
                });

            } else {
                response.send('Please enter Username and Password!');
                response.end();
            }
        } else {
            req.session.returnURL = '/add_user';
            response.redirect('/login');
        }
    });
};