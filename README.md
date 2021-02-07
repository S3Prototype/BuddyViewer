

# This is BuddyViewer

<img src="https://github.com/S3Prototype/BuddyViewer/blob/master/public/icons/buddyviewer_logo.png" width="200" height="200" />

A platform for synchronously watching videos from (almost) any website with your friends remotely.

This app uses socket.io to connect users within rooms and synchronize their video playback. The backend uses expressJS for routing, bcrypt for encrypting data, mongodb for longterm data storage, redis for caching, passportJS for user authentication, and various youtube web scraping libraries for collecting data on videos and serving up recommended videos and search results. On the front end, the site is built on jQuery and vanilla JS and CSS.

For playing YouTube videos, BuddyViewer uses the YouTube iFrame API. For Vimeo videos, it also uses the vimeo API. For all other videos, the URL's are extracted on the server side and returned to the front end, where they're attached to html5 <video> tags and manipulated using the HTML5 video api.

Users are able to paste any url they want, and then some server-side code will try to extract a video from it. In the event that the website requires a login, users are prompted to provide their login credentials, which are used to try accessing the site again.
