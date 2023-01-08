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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// This configures static hosting for files in /public that have the extensions
// listed in the array.
var options = {
	dotfiles: 'ignore',
	etag: false,
	extensions: ['htm', 'html', 'css', 'js', 'ico', 'jpg', 'jpeg', 'png', 'svg'],
	index: ['index.html'],
	maxAge: '1m',
	redirect: false,
	folder: '/public'
}
app.use(express.static('public', options))

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


// ############################ Get Images ####################################
/* getImageAlbum
	- Gets all images in a imgur album by id
	
	- param: albumId - the id of the album
	- return: image_list - the list of images in the album
*/
function getImageAlbum(albumId) {
	// console.log("Getting album: " + albumId);
	const options = {
		url: `https://api.imgur.com/3/album/${albumId}`,
		headers: {
			'Authorization': `Client-ID ${clientId}`
		}
	};
	let image_list = [];
	return new Promise((resolve, reject) => {
		request(options, (error, response, body) => {
			if (error) {
				console.error("GetImage: " + error);
			} else {
				try {
					const data = JSON.parse(body);
					for (const image of data.data.images) {
						image_list.push(image.link);
					}
					// image_list = image_list.split(',');
					resolve(image_list);
				} catch (e) {
					// console.error(e);
					console.error("ERROR ALBUM: " + e);
					throw new Error('Throw makes it go boom!')
				}
			}
		});

	});
}

// ################################ Routing ########################################

/* Everything below this is for routing
	
	- / -- home page
	- /login -- login page
	- /auth -- authenticates the user
	- /logout -- logs the user out
	- /home -- displays what server the user can access
	- /:server -- Displays all folders in the server
	- /:server/:folder -- Displays all image in the "folder"
*/
//	### Auth Routing ###

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

// A list of characters that are not allowed in the input fields
const blacklist = '\'\"\/\<\>\;'

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
		// Execute SQL query that'll select the account from the database based on the specified username and password
		query_string = "SELECT * FROM accounts WHERE username = '" + username + "' AND password = '" + password + "'";
		pool.query(
			query_string,
			function (error, results, fields) {
				if (error) throw error;
				if (results.rows.length > 0) {
					// Authenticate the user
					request.session.loggedin = true;
					request.session.username = username;
					// Redirect to home page
					response.redirect('/home');
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

/* Add user Page
	- Renders the add user page
	
*/
app.get('/add_user', function (request, response) {
	// Render login template
	if (request.session.loggedin) {
		response.render('pages/add_user.ejs');
	} else {
		request.redirect('/login');
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
				query_string = "INSERT INTO accounts  (id, username, password, email) VALUES ('" + id + "', '" + username + "', '" + password + "', '" + email + "')";
				pool_write.query(
					query_string,
					function (error, results, fields) {
						// If there is an issue with the query, output the error
						if (error) throw error;
						// If the account exists
						console.log(results);
						response.end();
					});
			});
			pool_write.end(); // End the connection to the database
		} else {
			response.send('Please enter Username and Password!');
			response.end();
		}
	} else {
		response.redirect('/login');
	}
});

app.get('/logout', function (request, response) {
	request.session.loggedin = false;
	request.session.username = null;
	response.redirect('/login');
});

// ######### Main Routing #########

/* can_access
	- Checks if the user has access to the server

	- params: server - The server name
	- params: username - The username of the user

	- returns: A promise that resolves to- 
				true if the user has access to the server,
				false otherwise
*/
function can_access(server, username) {
	return new Promise((resolve, reject) => {
		query_string = 'SELECT * FROM ' + username + ' WHERE server_name = \'' + server.toLowerCase() + '\'';
		pool.query(query_string, (err, resp) => {
			if (resp.rows.length > 0) {
				if (resp.rows[0].can_access == 'true') {
					resolve(true);
				} else {
					resolve(false);
				}
			} else {
				resolve(false);
			}
		});
	});
}

/* Admin page
	- Gets the list of users from the db
	- Links to /db/:user
*/
app.get('/db', function (req, res) {
	if (req.session.loggedin) {
		if (req.session.username == 'admin') {
			query_string = 'SELECT username FROM accounts';
			let accounts = []
			pool.query(query_string, (error, results) => {
				for (let row of results.rows) {
					accounts.push(row.username);
				}
				let send_data = '<h1>Admin Page</h1><table><tr><th>Username</th></tr>';
				for (let account of accounts) {
					send_data = send_data + '<tr><th><a href="/db/' + account + '">' + account + '</th></tr>';
				}
				send_data = send_data + '</table>';
				res.send(send_data);
			});
		} else {
			res.redirect('/home');
		}
	} else {
		res.redirect('/login');
	}
});

/* Admin page for a specific user
	- Gets the list of servers that the user has access to
	- Allows the admin to add or remove access to a server
*/
app.get('/db/:user', [
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

					res.render('pages/db.ejs', {
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
			res.redirect('/login');
		}
	});

/* rung_query(query_string)
	-  Runs a query on the write database

	-param: query_string - the query to run
*/
function run_query(query_string) {
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
		function (error, results, fields) {
			if (error) throw error;
		});
	pool_write.end();
}

/* Updates the user's access to a server
*/
app.post('/db/:user/update_user', [
	check('user').trim().blacklist(blacklist).replace(' ', ''),
	check('server_name').isLength({ min: 1 }).trim().escape().blacklist(blacklist).replace(' ', ''),
	check('can_access').isLength({ min: 1 }).trim().blacklist(blacklist).replace(' ', ''),
	check('action_type').isLength({ min: 1 }).trim().blacklist(blacklist).replace(' ', '')],
	function (request, response) {
		if (req.session.loggedin) {
			if (req.session.username == 'admin') {
				let server_name = request.body.server_name;
				let can_access = request.body.can_access;
				let user = request.params.user;
				let action_type = request.body.action_type;

				if (action_type.toLowerCase() == 'add') {
					if (server_name && can_access) {
						query_string = "INSERT INTO " + user + " (server_name, can_access) VALUES ('" + server_name + "', '" + can_access + "')";
						run_query(query_string);
						request.session.succ_msg_db = 'Successfully added server to database!';
					} else {
						request.session.err_msg_db = 'Please enter server name and if they can access the server!';
					}
				} else if (action_type.toLowerCase() == 'delete') {
					if (server_name) {
						query_string = 'DELETE FROM ' + user + ' WHERE server_name = \'' + server_name + '\'';
						run_query(query_string);
						request.session.succ_msg_db = 'Successfully deleted server from database!';
					} else {
						request.session.err_msg_db = 'Please enter Server name!';
					}
				}

				// Execute SQL query that'll select the account from the database based on the specified username and password
				run()
				async function run() {
					await new Promise(resolve => setTimeout(resolve, 200));;
					response.redirect('/db/' + user);
				}
			}
		}
	});

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

			res.render('pages/home.ejs', {
				folders: servers,
				user: req.session.username
			});
		});
	} else {
		res.redirect('/login');
	}
});

/* Folder page
	- Waits for data from db to be loaded in, then renders the index.html

	- Checks if the user is logged in, then gets the folders from the image db
*/
app.get('/:server', [
	check('server').trim().blacklist(blacklist).replace(' ', '')],
	function (req, res) {
		let server = req.params.server;

		if (req.session.loggedin) {
			can_access(server, req.session.username).then((access) => {
				if (access) {
					query_string = 'SELECT folder_name, display_name FROM ' + server.toLowerCase();
					img_pool.query(query_string, (err, resp) => {
						if (resp.rows.length > 0) {
							let folder_list = [];
							let display_list = [];
							for (const row of resp.rows) {
								folder_list.push(row.folder_name);
								display_list.push(row.display_name);
							}

							res.render('pages/folders.ejs', {
								server: server,
								folders: folder_list.sort(),
								display: display_list.sort()
							});
						} else {
							res.redirect('/home');
						}
					});
				} else {
					res.redirect('/home');
				}
			});
		} else {
			res.redirect('/login');
		}
	});

/* Folder page
	- Gets the folder name from the url and renders the template_grid.ejs

	- Checks if the user is logged in, then gets the folder data from the image db
	- Then gets the images from the corresponding imgur album
*/
app.get('/:server/:folder', [
	check('server').trim().blacklist(blacklist).replace(' ', ''),
	check('folder').trim().blacklist(blacklist).replace(' ', '')],
	function (req, res) {
		if (req.session.loggedin) {
			let folder = req.params.folder;
			let server = req.params.server;
			can_access(server, req.session.username).then((access) => {
				if (access) {
					query_string = "SELECT * FROM " + server.toLowerCase() + " WHERE folder_name = '" + folder + "'";
					img_pool.query(query_string, (err, resp) => {
						//Lines 334-342: Gets images from imgur
						getImageAlbum(resp.rows[0].imgur_album_id)
							.then((image_list) => {
								var scroll = folder + '/images'
								var title = resp.rows[0].display_name;
								var description = resp.rows[0].description;
								const isMobile = browser(req.headers['user-agent']).mobile;
								res.render(isMobile ? "pages/template_grid_mobile.ejs" : "pages/template_grid.ejs", {
									image_links: image_list,
									title: title,
									description: description,
									scroller: scroll
								});
							});
					});
				} else {
					res.redirect('/home');
				}
			});
		} else {
			res.redirect('/login');
		}
	});


/* Image Page
	- Image scroller page
	- Shows one image for 2 seconds then moves to the next
*/
app.get('/:server/:folder/images', [
	check('server').trim().blacklist(blacklist).replace(' ', ''),
	check('folder').trim().blacklist(blacklist).replace(' ', '')],
	function (req, res) {
		let folder = req.params.folder;
		let server = req.params.server;
		if (req.session.loggedin) {
			can_access(server, req.session.username).then((access) => {
				if (access) {
					folder = req.params.folder;
					query_string = "SELECT * FROM " + server.toLowerCase() + " WHERE folder_name = '" + folder + "'";
					img_pool.query(query_string, (err, resp) => {
						getImageAlbum(resp.rows[0].imgur_album_id)
							.then((image_list) => {
								var title = resp.rows[0].display_name;
								res.render("pages/images.ejs", {
									image_links: image_list,
									title: title,
								});
							});
					});
				} else {
					res.redirect('/home');
				}
			});
		} else {
			res.redirect('/login');
		}
	});

// app.get('*', function (req, res) {
// 	console.log('404ing');
// 	res.render('pages/404.ejs');
// 	// res.send('404');
// });

// ################################# Export #################################
module.exports = app
