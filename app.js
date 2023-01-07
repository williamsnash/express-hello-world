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
	- /folders -- Displays all folders
	- /folders/:folder -- Displays all image in the "folder"
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
					response.redirect('/folders');
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

// 	### Main Routing ###
/* Folder page
	- Waits for data from db to be loaded in, then renders the index.html
	
	- Checks if the user is logged in, then gets the folders from the image db
*/
app.get('/folders', function (req, res) {
	if (req.session.loggedin) {
		query_string = 'SELECT folder_name, display_name FROM folders';
		img_pool.query(query_string, (err, resp) => {

			let folder_list = [];
			let display_list = [];
			for (const row of resp.rows) {
				folder_list.push(row.folder_name);
				display_list.push(row.display_name);
			}

			res.render('pages/folders.ejs', {
				folders: folder_list.sort(),
				display: display_list.sort()
			});
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
app.get('/folders/:folder', [check('folder').trim().blacklist(blacklist).replace(' ', '')], function (req, res) {
	if (req.session.loggedin) {
		let folder = req.params.folder;
		query_string = "SELECT * FROM folders  WHERE folder_name = '" + folder + "'";
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
		res.redirect('/login');
	}
});


/* Image Page
*/
app.get('/folders/:folder/images', [check('folder').trim().blacklist(blacklist).replace(' ', '')], function (req, res) {
	let folder = req.params.folder;
	if (req.session.loggedin) {
		folder = req.params.folder;
		query_string = "SELECT * FROM folders  WHERE folder_name = '" + folder + "'";
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
		res.redirect('/login');
	}
});


app.get('*', function (req, res) {
	console.log('404ing');
	res.render('pages/404.ejs');
	// res.send('404');
});

// ################################# Export #################################
module.exports = app
