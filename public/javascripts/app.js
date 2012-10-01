$(function () {
  var controller = new Controller();

  var players = [
    new YouTube(),
    new SoundCloud()
  ];

  controller.loop(function (track) {
    for (var i = 0; i < players.length; i++) {
      if (players[i].handlesUrl(track.url)) {
        return players[i].play(track.url);
      }
    }
    var d = $.Deferred();
    d.reject();
    return d;
  });
});

// Controller {{{
function Controller () {
}

Controller.prototype.dequeue = function () {
  return $.ajax(
    '/dequeue', {
      type: 'POST',
      dataType: 'json'
    }
  );
};

Controller.prototype.loop = function (play) {
  var controller = this;
  var next = function () {
    controller.dequeue().done(function (track) {
      play(track).always(next);
    });
  };
  next();
};
// }}}

// YouTube {{{
function YouTube () {
  this.PLAYER_SWF_ID = 'player-youtube-swf';
  this.PLAYER_PLACEHOLDER_ID = 'player-youtube-placeholder';
  this.deferreds = {};
};

YouTube.prototype = {
  handlesUrl: function (url) {
    return url.match(/^https?:\/\/\w+\.youtube\.com\//);
  },
  play: function (url) {
    var videoId = this.extractVideoId(url);
    if (this.deferreds['play']) {
      this.deferreds['play'].reject();
    }
    this.prepare().done(function (player) {
      player.loadVideoById(videoId);
    });
    return this.deferreds['play'] = $.Deferred();
  },
  prepare: function () {
    if (this.deferreds['prepare']) {
      return this.deferreds['prepare'];
    }

    var youtube = this;
    window.onYouTubePlayerReady = function () {
      YouTube.prototype.onPlayerReady.apply(youtube, arguments);
    };
    window.onYouTubePlayerStateChange = function () {
      YouTube.prototype.onPlayerStateChange.apply(youtube, arguments);
    };

    $('<div/>', { id: this.PLAYER_PLACEHOLDER_ID }).appendTo(document.body);

    swfobject.embedSWF(
      '//www.youtube.com/apiplayer?enablejsapi=1&version=3',
      this.PLAYER_PLACEHOLDER_ID, '425', '356', '8', null, null,
      { allowScriptAccess: 'always' },
      { id: this.PLAYER_SWF_ID }
    );

    return this.deferreds['prepare'] = $.Deferred();
  },
  extractVideoId: function (url) {
    return url.match(/\?v=([^&]+)/)[1];
  },
  onPlayerReady: function (playerid) {
    var player = this.getPlayer();
    player.addEventListener('onStateChange', 'onYouTubePlayerStateChange');
    this.deferreds['prepare'].resolve(player);
  },
  onPlayerStateChange: function (newState) {
    var stateName = this.getStateName(newState);
    console.log(stateName);
    if (stateName === 'ended' && this.deferreds['play']) {
      this.deferreds['play'].resolve();
    }
  },
  getPlayer: function () {
    return document.getElementById(this.PLAYER_SWF_ID);
  },
  getStateName: function (state) {
    return [ 'unstarted', 'ended', 'playing', 'paused', 'buffering', undefined, 'cued' ][ state + 1 ];
  }
};
// }}}

// SoundCloud {{{
// XXX Currently supports only widget URL
function SoundCloud () {
  this.PLAYER_IFRAME_ID = 'player-soundcloud-iframe';
  this.deferreds = {};
}

SoundCloud.prototype = {
  handlesUrl: function (url) {
    return url.match(/^http:\/\/api\.soundcloud\.com\//);
  },
  play: function (url) {
    if (this.deferreds['play']) {
      this.deferreds['play'].reject();
    }
    this.prepare(url).done(function (player) {
      console.log('player.load');
      player.load(url, { auto_play: true });
    });
    return this.deferreds['play'] = $.Deferred();
  },
  prepare: function (initUrl) {
    if (this.deferreds['prepare']) {
      return this.deferreds['prepare'];
    }

    var soundcloud = this;
    return this.deferreds['prepare'] = $.getScript(
      'http://w.soundcloud.com/player/api.js'
    ).pipe(function () {
      var widget = SC.Widget(
        $('<iframe/>', {
          id: soundcloud.PLAYER_IFRAME_ID,
          src: 'http://w.soundcloud.com/player/?url=',
          scrolling: 'no',
          frameborder: 0,
          width: '100%',
          height: 166
        }).appendTo(document.body).get(0)
      );
      widget.bind(
        SC.Widget.Events.READY, function () {
          widget.bind(
            SC.Widget.Events.FINISH,
            function () { soundcloud.onPlayerFinished() }
          );
        }
      );
      return widget;
    });
  },
  onPlayerFinished: function () {
    this.deferreds['play'].resolve();
  }
};
// }}}
