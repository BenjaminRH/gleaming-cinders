App = Ember.Application.create();
Ember.$.ajaxSetup({ dataType: 'jsonp' });

App.Router.map(function() {
    this.resource('music', { path: '/music/:styles/:moods' });
});

App.IndexRoute = Ember.Route.extend({
    model: function () {
        return Ember.RSVP.hash({
           moods: Ember.$.getJSON('music_moods.json'),
           styles: Ember.$.getJSON('music_styles.json')
        });
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        controller.set('moods', model.moods);
        controller.set('fullStyles', model.styles);
        var styleArr = Object.keys(model.styles).sort();
        controller.set('styles', styleArr);

        controller.set('selectedStyle', styleArr[Math.floor(Math.random() * styleArr.length)]);
        controller.set('selectedMood1', model.moods[Math.floor(Math.random() * model.moods.length)]);
        controller.set('selectedMood2', model.moods[Math.floor(Math.random() * model.moods.length)]);
    }
});

App.MusicRoute = Ember.Route.extend({
    model: function (params) {
        return Ember.$.getJSON(echoUrl(params.styles, params.moods) + '&callback=?').then(function (data) {
            var songs = data.response.songs;
            songList = [];
            for (var i = 0; i < songs.length; i++) {
                if (isGoodSong(songs[i])) {
                    songList.push(songs[i]);
                }
            }
            songList = songList.splice(0, 25);
            var promises = songList.map(function (song) {
                return Ember.$.getJSON('http://jsonp.jit.su/?callback=?&url=' + encodeURIComponent(tinyUrl(song.title, song.artist_name)));
            });
            return Ember.RSVP.all(promises).then(function (songs) {
                return songs.map(function (song) {
                    return newSong(song);
                }).filter(function (song) {
                    return typeof song.id !== 'undefined';
                }).splice(0, 15);
            });
        });
    },

    setupController: function (controller, model) {
        controller.set('model', model);
    }
});

function newSong (song) {
    return {
        id: song.SongID,
        name: song.SongName,
        artist: song.ArtistName,
        album: song.AlbumName
    };
}

Ember.Handlebars.helper('groovesharkPlayerMini', function (song) {
    return new Ember.Handlebars.SafeString(''
        +'<object width="250" height="40">'
            +'<param name="movie" value="http://grooveshark.com/songWidget.swf">'
            +'<param name="wmode" value="window">'
            +'<param name="allowScriptAccess" value="always">'
            +'<param name="flashvars" value={"hostname=cowbell.grooveshark.com&amp;songIDs=' + Handlebars.Utils.escapeExpression(song.id) + '&amp;style=metal&amp;p=0">'
            +'<embed src="http://grooveshark.com/songWidget.swf" type="application/x-shockwave-flash" width="250" height="40" flashvars="hostname=cowbell.grooveshark.com&amp;songIDs=' + Handlebars.Utils.escapeExpression(song.id) + '&amp;style=metal&amp;p=0" allowscriptaccess="always" wmode="window">'
        +'</object>'
    );
});

App.IndexController = Ember.ObjectController.extend({
    actions: {
        burn: function () {
            var style = this.get('styles')[this.get('styles').indexOf(this.get('selectedStyle')) - 1];
            style = this.get('fullStyles')[style].join(',').replace(/ /g, '+');
            var mood1 = this.get('moods')[this.get('moods').indexOf(this.get('selectedMood1')) - 1];
            var mood2 = this.get('moods')[this.get('moods').indexOf(this.get('selectedMood2')) - 1];

            this.transitionToRoute('music', style, mood1 + ',' + mood2);
        }
    }
});

// Return a properly formatted API query string for Echo Nest
// http://developer.echonest.com/api/v4/song/search?api_key=VUY4OZGKUB2ELFELQ&format=json&bucket=song_hotttnesss&results=100&sort=song_hotttnesss-desc&mood=foo&style=foo
// [ response: { status: { message (success) }, songs: [ { artist_id, artist_name, id, song_hotttnesss, title } ] } ]
function echoUrl (styles, moods) {
    if (typeof styles === 'string') styles = styles.split(',').map(Ember.$.trim);
    if (typeof moods === 'string') moods = moods.split(',').map(Ember.$.trim);
    var styleString = '';
    var moodString = '';
    for (var i= 0; i < styles.length; i++) {
        styleString += '&style=';
        if (styles.length === 1) styleString += '^';
        styleString += styles[i];
    }
    for (var i= 0; i < moods.length; i++) {
        moodString += '&mood=' + moods[i];
    }
    return  'https://developer.echonest.com/api/v4/song/search?format=jsonp&api_key=VUY4OZGKUB2ELFELQ&bucket=song_hotttnesss&results=100&sort=song_hotttnesss-desc' + styleString + moodString;
};

// Return a properly formatted API query string for Tinysong
// http://tinysong.com/b/name+artist?format=json&key=e023a8f47788a4047eeaf2e3833dcafe
// { SongID, SongName, ArtistName, AlbumName }
function tinyUrl (name, artist) {
    return  'http://tinysong.com/b/' + encodeURIComponent(name) + '+' + encodeURIComponent(artist) + '?format=json&key=e023a8f47788a4047eeaf2e3833dcafe';
};

var dups = {};      // used to eliminate dup songs

function isGoodSong (song) {
    var hash = getDupHash(song);
    if (! (hash in dups)) {
        dups[hash] = song;
        return true;
    } else {
         return false;
    }
}

function getDupHash (song) {
    return song.artist_id + song.song_hotttnesss;
}
