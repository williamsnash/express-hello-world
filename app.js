const express = require('express');
const browser = require('browser-detect');
const NodeCache = require('node-cache');
const request = require('request');
const { Pool } = require('pg');
const session = require('express-session');
const { check } = require('express-validator');
require('dotenv').config()

const app = express()
const clientId = process.env.CLIENT_ID;
// const cache = new NodeCache({ stdTTL: 120 });


// ################################ DateBase #######################################

/* User Database
	- Stores the user information
	- Id, username, password, email
*/
const pool = new Pool({
	user: process.env.USER,
	host: 'db.bit.io',
	database: process.env.DB, // public database 
	password: process.env.PASSWD, // key from bit.io database page connect menu
	port: 5432,
	ssl: true,
});

/* Folder info Database
	- Stores the folder information
	- folder_name, display_name, description, imgur_album_id
*/
const img_pool = new Pool({
	user: process.env.IMAGE_USER,
	host: 'db.bit.io',
	database: process.env.IMAGE_DB, // public database 
	password: process.env.IMAGE_PASSWD, // key from bit.io database page connect menu
	port: 5432,
	ssl: true,
});

// ################################ App Setup #######################################
app.set('view engine', 'ejs');

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));
app.disable('x-powered-by');

var options = {
	dotfiles: 'ignore',
	etag: false,
	extensions: ['htm', 'html', 'css', 'js', 'ico', 'jpg', 'jpeg', 'png', 'svg'],
	maxAge: '1m',
}
app.use(express.json(),
	express.urlencoded({ extended: true }),
	express.static('public', options)
);

// if (process.env.CACHING.toLocaleLowerCase() == 'on') {
// 	console.log("Caching is enabled");
// 	const cache = new NodeCache({ stdTTL: 120 });
// 	// This setup caches for the browser
// 	app.use((req, res, next) => { // Cache the responses
// 		const cachedBody = cache.get(req.url);
// 		if (cachedBody) {
// 			res.send(cachedBody);
// 			return;
// 		} else {
// 			res.sendResponse = res.send;
// 			res.send = body => {
// 				cache.set(req.url, body);
// 				res.sendResponse(body);
// 			}
// 			next();
// 		}
// 	});
// } else {
// 	console.log("Caching is disabled");
// }

// ################################ Routing ########################################

// A list of characters that are not allowed in the input fields
const blacklist = '\'\"\/\<\>\;'

// ######### Main Routing #########

app.get('/', function (request, response) {
	response.redirect('/login');
});

/* Login Page
	- Renders the login page / login users in
	- Reset the error message session variable, after sending it to the template
	- https://codeshack.io/basic-login-system-nodejs-express-mysql/
*/
app.get('/login', function (request, response) {
	// Render login template
	let msg = request.session.err_msg;
	request.session.err_msg = null;
	response.render('pages/login.ejs', {
		err_msg: msg
	});
});

// auth
//	- Authenticates the user
//	- Sets the session variables username and logged_in
app.post('/auth', [
	check('username').isLength({ min: 1 }).trim().escape().blacklist(blacklist).replace(' ', ''),
	check('password').isLength({ min: 1 }).trim().blacklist(blacklist).replace(' ', '')
], function (request, response) {
	let username = request.body.username;
	let password = request.body.password;
	if (username && password) {
		let query_string = "SELECT * FROM accounts WHERE username = $1 AND password = $2";
		pool.query(
			query_string,
			[username, password],
			function (error, results, fields) {
				if (error) throw error;
				if (results.rows.length > 0) {
					// Authenticate the user
					request.session.loggedin = true;
					request.session.username = username;
					console.log("Redirecting to: " + request.session.returnURL);
					response.redirect(request.session.returnURL || '/home');
					request.session.returnURL = null;
				} else {
					request.session.err_msg = "Incorrect Username and/or Password!";
					response.redirect('/login');

				}
				response.end();
			});
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.get('/logout', function (request, response) {
	request.session.loggedin = false;
	request.session.username = null;
	response.redirect('/login');
});

// ######### Main Routing #########

/* Admin Routing
	- /admin
	- /admin/:user
	- /admin/:user/delete
	- /send_user
*/
require('./routes/admin.js')(app, pool, blacklist);

/* Home Routing
	- /home
*/
require('./routes/home.js')(app, pool);

/* Server Routing
	- /:server
	- /:server/:folder
	- /:server/:folder/images
*/
require('./routes/servers.js')(app, pool, img_pool, blacklist, clientId);

/* run_query(query_string)
	-  Runs a query on the write database
	-param: query_string - the query to run
*/
function run_query(query_string, args) {
	const pool_write = new Pool({
		user: process.env.USER_WRITE,
		host: 'db.bit.io',
		database: process.env.DB, // public database 
		password: process.env.PASSWD_WRITE, // key from bit.io database page connect menu
		port: 5432,
		ssl: true,
	});

	pool_write.query(
		query_string,
		args,
		function (error, results, fields) {
			if (error) throw error;
		});
	pool_write.end();
}

/* Updates the user's access to a server
*/
app.post('/users/:user/update_user', [
	check('user').trim().blacklist(blacklist).replace(' ', ''),
	check('server_name').isLength({ min: 1 }).trim().escape().blacklist(blacklist).replace(' ', ''),
	check('can_access').isLength({ min: 1 }).trim().blacklist(blacklist).replace(' ', ''),
	check('action_type').isLength({ min: 1 }).trim().blacklist(blacklist).replace(' ', '')],
	function (request, response) {
		if (request.session.loggedin) {
			if (request.session.username == 'admin') {
				let server_name = request.body.server_name;
				let can_access = request.body.can_access;
				let user = request.params.user;
				let action_type = request.body.action_type;

				if (action_type == 'add') {
					if (server_name && can_access) {
						if (can_access.toLowerCase() == 'true' || can_access.toLowerCase() == 'false') {
							query_string = "INSERT INTO " + user + " (server_name, can_access) VALUES ($1, $2)";
							run_query(query_string, [server_name, can_access]);
							request.session.succ_msg_db = 'Successfully added server to database!';
						} else {
							request.session.err_msg_db = "Can access must be 'true' or 'false'!";
						}
					} else {
						request.session.err_msg_db = 'Please enter server name and if they can access the server!';
					}
				} else if (action_type == 'delete') {
					if (server_name) {
						query_string = 'DELETE FROM ' + user + ' WHERE server_name = $1';
						run_query(query_string, [server_name]);
						request.session.succ_msg_db = 'Successfully deleted server from database!';
					} else {
						request.session.err_msg_db = 'Please enter Server name!';
					}
				}

				// Execute SQL query that'll select the account from the database based on the specified username and password
				run()
				async function run() {
					await new Promise(resolve => setTimeout(resolve, 200));;
					response.redirect('/users/' + user);
				}
			}
		} else {
			request.session.returnURL = '/users/' + request.params.user;
			response.redirect('/login');
		}
	});
// ################################# Export #################################
module.exports = app
