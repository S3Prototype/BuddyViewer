class SpotifyListener extends BuddyViewer{

  constructor(data){
    super();
    this.player = new Spotify.Player({
      name: 'Carly Rae Jepsen Player',
      getOAuthToken: callback => {
        // Run code to get a fresh access token
    
        callback('access token here');
      },
      volume: 0.5
    });
  }

  play ({spotify_uri,
      playerInstance: { _options: {
                          getOAuthToken,
                          id
                      }
      }
  }){
      getOAuthToken(access_token => {
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${id}`, {
          method: 'PUT',
          body: JSON.stringify({ uris: [this.spotify_uri] }),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
          },
        });
      });
  }//play()
}