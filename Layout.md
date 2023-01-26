# Pages
This file contains all pages in the site including their css and scripts. Used to track issues

---
# GET Request

## /login
### Description: Allows for users to login
<br>Html: [login.ejs](views/pages/login.ejs)
<br>CSS: [login.css](public/css/login.css)
<br>Scripts: N/A

---
## /home
### Description: Home is the landing page of this site, here the users will be able to see all the servers that they have access to
<br>Html: [home.ejs](views/pages/home.ejs)
<br>CSS: [home.css](public/css/home.css)
<br>Scripts: [home.js](public/scripts/home.js)

---
## /{server}
### Description: This page is generated dynamic so there is not set route. This will display all folders for said server
<br>Html: [folders.ejs](views/pages/folders.ejs)
<br>CSS: [folders.css](public/css/folders.css)
<br>Scripts: [folders.js](public/scripts/folders.js)

---
## /{server}/{folder}
### Description: This page is generated dynamic so there is not set route. This shows all images for the folder
<br>Html: [template_grid.ejs](views/pages/template_grid.ejs)
<br>CSS: [image_grid.css](public/css/image_grid.css)
<br>Scripts: [image_grid.js](public/scripts/image_grid.js)

---
## /{server}/{folder}{images}
### Description: This page is generated dynamic so there is not set route. This shows one image at a time for 3 seconds
<br>Html: [images.ejs](views/pages/images.ejs)
<br>CSS: [images.css](public/css/images.css)
<br>Scripts: N/A

---

## /users

### Description: Allows for the admin user to manage and delete users, links to the user server access pages
<br>Html: [admin.ejs](views/pages/admin.ejs)
<br>CSS: [admin.css](public/css/admin.css)
<br>Scripts: N/A

---
## /users/{user}
### Description: Allows for the admin user to manage and delete what servers the user has access to
<br>Html: [user.ejs](views/pages/user.ejs)
<br>CSS: [admin.css](public/css/admin.css)
<br>Scripts: N/A

---
## /add_user
### Description: Allows for the admin user to add a new user
<br>Html: [add_user.ejs](views/pages/add_user.ejs)
<br>CSS: [login.css](public/css/login.css)
<br>Scripts: N/A

---
# POST Request

## /auth
### Description: Makes query against database to see if user is authorized, also sanitizes input

---
## /send_user
### Description: Make query to add a user to the master list and makes a new table for the user

---
## /users/{user}/delete
### Description: Make a query to delete the user from the master list and their table

---
## /users/{user}/update_user
### Description: Make a query to update the users table to add servers

---