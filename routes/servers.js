const { check } = require('express-validator'); // Used for query validation
const request = require('request'); // Used for imgur api
const browser = require('browser-detect'); // Used for browser detection

/* Server page
    - app: the express app
    - pool: the account pool
    - img_pool: the image pool
    - blacklist: the blacklist of characters for query validation
    - clientId: the imgur client id
*/
module.exports = function (app, pool, img_pool, blacklist, clientId) {

    /* can_access
        - Checks if the user has access to the server
    */
    function can_access(server, username) {
        return new Promise((resolve, reject) => {
            // let query_string = 'SELECT * FROM ' + username + ' WHERE server_name = \'' + server.toLowerCase() + '\'';
            let query_string = 'SELECT * FROM ' + username + ' WHERE server_name = $1';
            pool.query(query_string,
                [server.toLowerCase()],
                function (error, resp, fields) {
                    if (error) throw error;
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


    /* Folder page
    - Waits for data from db to be loaded in, then renders the index.html
    - Checks if the user is logged in, then gets the folders from the image db
    */
    app.get('/:server', [
        check('server').trim().blacklist(blacklist).replace(' ', '')],
        function (req, res) {
            const server = req.params.server;
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
                                    display: display_list.sort(),
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
                req.session.returnTo = '/' + server;
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
            let folder = req.params.folder;
            const server = req.params.server;
            if (req.session.loggedin) {
                can_access(server, req.session.username).then((access) => {
                    if (access) {
                        query_string = "SELECT * FROM " + server.toLowerCase() + " WHERE folder_name = $1";
                        img_pool.query(query_string, [folder], (err, resp) => {
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
                                        scroller: scroll,
                                        backlink: server
                                    });
                                });
                        });
                    } else {
                        res.redirect('/home');
                    }
                });
            } else {
                req.session.returnURL = '/' + server + '/' + folder;
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
                        query_string = "SELECT * FROM " + server.toLowerCase() + " WHERE folder_name = $1";
                        img_pool.query(query_string, [folder], (err, resp) => {
                            getImageAlbum(resp.rows[0].imgur_album_id)
                                .then((image_list) => {
                                    var title = resp.rows[0].display_name;
                                    res.render("pages/images.ejs", {
                                        image_links: image_list,
                                        title: title,
                                        backlink: '/' + server + '/' + folder
                                    });
                                });
                        });
                    } else {
                        res.redirect('/home');
                    }
                });
            } else {
                req.session.returnURL = '/' + server + '/' + folder + '/images';
                res.redirect('/login');
            }
        });
};