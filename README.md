

# This is BuddyViewer

<img src="https://github.com/S3Prototype/BuddyViewer/blob/master/public/icons/buddyviewer_logo.png" width="200" height="200" />

A platform for synchronously watching videos from (almost) any website with your friends remotely.

This app uses socket.io to connect users within rooms and synchronize their video playback. The backend uses expressJS for routing, bcrypt for encrypting data, mongodb for longterm data storage, redis for caching, passportJS for user authentication, and various youtube web scraping libraries for collecting data on videos and serving up recommended videos and search results. On the front end, the site is built on jQuery and vanilla JS and CSS.

For playing YouTube videos, BuddyViewer uses the YouTube iFrame API. For Vimeo videos, it also uses the vimeo API. For all other videos, the URL's are extracted on the server side and returned to the front end, where they're attached to html5 <video> tags and manipulated using the HTML5 video api.

Users are able to paste any url they want, and then some server-side code will try to extract a video from it. In the event that the website requires a login, users are prompted to provide their login credentials, which are used to try accessing the site again.

# Advantages over competitors

Other sites, such as Watch2Gether and Rabbit, do server a similar purpose to BuddyViewer, but there are some key features that that BuddyViewer currently exclusively has, and in the future will exclusively have.

- [x] **In-Page Viewing**

With BuddyViewer, you are able to watch (almost) any website's videos within the webpage. This is in contrast to Watch2Gether, which allows viewing only through the use of its browser plugin, which requires ursers to open up the webpage which holds the video they want to see.

- [x] **Recommended Videos**
BuddyViewer generates its own Recommended Videos overlay when a video stops playing. Clicking on one of these videos will then load it into the player for all users in the room to watch. Contrast this with most competitors, which have no interaction with the recommended videos that pop up in its video player.

- [x] **Open Room List**

BuddyViewer allows users to set their rooms to "Open" when they create them, which puts their rooms on a global list visible on the homepage. From there, strangers can join and enjoy videos alongside the others in the room. This is in contrast to most services, which require users to share the links to their rooms manually in order for others to join.

- [ ] **Spotify Playback**

In the future, BuddyViewer will offer synchronized spotify playback, an extremely high-demand feature that most competitors do not offer.

- [ ] **Voice Chat**

In the future, BuddyViewer will allow users to voice chat with each other, eliminating the need for external chat software.

- [ ] **Room Polling**

Users will be able to vote on what video plays next in the playlist, whehter videos should loop, whether videos should be ended early, and other fun, interactive features.

- [ ] **Much More**

BuddyViewer will be continuously growing! This is only one version of it!
