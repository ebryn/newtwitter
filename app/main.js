// ==========================================================================
// Project:   newtwitter
// Copyright: ©2011 My Company Inc. All rights reserved.
// ==========================================================================

spade.require("sproutcore");

var NewTwitter = SC.Application.create({
});

NewTwitter.appController = SC.Object.create({
  selectedTab: "timeline",
  authorized: false,
  authUrl: null,
  userName: null,

  changeTab: function(tabName) {
    var oldTabName = this.get('selectedTab');
    this.set('selectedTab', tabName);
    $('#'+oldTabName).hide();
    $('#'+tabName).show();
  },

  currentView: function() {
    NewTwitter[this.get('selectedTab') + 'Controller'].load();
  }.observes('selectedTab', 'authorized'),

  auth: function(showPopup) {
    var self = this;
    $.getJSON("/_strobe/social/twitter/authentication", {oauth_callback: location.origin + "/_strobe/social/twitter/callback"}, function(data) {
      if (data.authentication.status === "authenticated") {
        clearInterval(NewTwitter.authPoller);
        $.getJSON("/_strobe/social/twitter/1/account/verify_credentials.json", function(data) {
          self.set("userName", data.screen_name);
          NewTwitter.userController.loadUser(data);
          NewTwitter.appController.set('authorized', true);
          $('#container').show();
        });
      } else {
        self.set('authUrl', data.authentication.authentication_uri);
      }
    });
  },

  authClick: function() {
    NewTwitter.authWindow = window.open(this.get('authUrl'), 'twitter_auth_window');
    if (!NewTwitter.authWindow) {
      alert('Please turn off your popup blocker...');
    } else {
      if (NewTwitter.authPoller) { clearInterval(NewTwitter.authPoller); }
      NewTwitter.authPoller = setInterval(function() {
        NewTwitter.appController.auth();
      }, 1000);
    }
  },

  deauth: function() {
    var self = this;
    $.ajax("/_strobe/social/twitter/authentication", {type: "DELETE", complete: function(xhr, stat) {
      self.set('authorized', false);
      self.set('authUrl', null);
      $('#container').hide();
    }});
  }
});

NewTwitter.Tweet = SC.Object.extend({
  body: null,
  screenName: null,
  name: null,
  time: null,
  profileImage: null,

  humanTime: function() {
    return jQuery.timeago(this.get('time'));
  }.property('time'),
  screenNameHash: function() {
    return '#' + this.get('screenName');
  }.property('screenName'),
  linkedBody: function() {
    var body = this.get('body');
    //return body.replace(/@(\w+)/g, "<a href='#$1'>@$1</a>");
    return body;
  }.property('body'),

});
NewTwitter.Tweet.reopenClass({
  createFromApi: function(data) {
    return NewTwitter.Tweet.create({
      body: data.text, screenName: data.user.screen_name, name: data.user.name,
      time: data.created_at, profileImage: data.user.profile_image_url
    });
  }
});

NewTwitter.TweetStreamController = SC.ArrayProxy.extend({
  content: [],
  loaded: false,
  dataUrl: null,

  load: function() {
    var self = this;

    if (this.get("loaded")) {
      // do something intelligent to load new tweets
    } else {
      $.getJSON(this.get("dataUrl"), function(data) {
        self.loadTweets(data);
        self.set('loaded', true);
      });
    }
  },
  loadTweets: function(tweets) {
    var self = this;

    this.set('content', []);
    tweets.forEach(function(data) {
      self.pushObject(NewTwitter.Tweet.createFromApi(data));
    });
  }
});

NewTwitter.timelineController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/home_timeline.json?count=30"
});

NewTwitter.mentionsController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/mentions.json"
});

NewTwitter.retweetedByMeController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/retweeted_by_me.json"
});

NewTwitter.retweetedToMeController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/retweeted_to_me.json"
});

NewTwitter.retweetsOfMeController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/retweets_of_me.json"
});

NewTwitter.userController = SC.Object.create({
  followersCount: null,
  followingCount: null,
  tweetCount: null,
  friends: [],
  followers: [],
  lastTweet: null,

  loadUser: function(data) {
    this.set('followersCount', data.followers_count);
    this.set('followingCount', data.friends_count);
    this.set('tweetCount', data.statuses_count);
    if (data.status) {
      this.set('lastTweet', NewTwitter.Tweet.create({
        body: data.status.text, screenName: data.screen_name, name: data.name,
        time: data.status.created_at, profileImage: data.profile_image_url
      }));
    }
  },

  loadFriends: function(data) {
    this.set('friends', []);
    var self = this;
    jQuery.getJSON("/_strobe/proxy/api.twitter.com/1/users/lookup.json", {user_id: data.slice(0, 5).join(',')}, function(friends_data) {
      friends_data.forEach(function(friend) {
        self.get('friends').pushObject(SC.Object.create({image: friend.profile_image_url}));
      });
    });
  },

  loadFollowers: function(data) {
    this.set('followers', []);
    var self = this;
    jQuery.getJSON("/_strobe/proxy/api.twitter.com/1/users/lookup.json", {user_id: data.slice(0, 5).join(',')}, function(friends_data) {
      friends_data.forEach(function(friend) {
        self.get('followers').pushObject(SC.Object.create({image: friend.profile_image_url}));
      });
    });

  },

  incrementTweetCount: function() {
    this.set('tweetCount', this.get('tweetCount') + 1);
  }
});

NewTwitter.tweetController = SC.Object.create({
  content: null
});

NewTwitter.TweetView = SC.View.extend({
  templateName: 'tweet',
  classNames: ['tweet'],
  click: function() {
    //NewTwitter.tweetController.set('content', this.get('content'));
  }
});

NewTwitter.TweetStream = SC.CollectionView.extend({
  tagName: "div",
  itemViewClass: NewTwitter.TweetView,
  emptyView: SC.View.extend({
    template: SC.Handlebars.compile("<div class='tweet'><em>Damn, you need some friends bro!</em></div>")
  })
});

NewTwitter.DetailView = SC.View.extend({
  elementId: 'details',
  selectedTweetBinding: "NewTwitter.tweetController.content",
  isVisible: function(key, val) {
    if (this.get('selectedTweet')) { return true; }
    return false;
  }.property('selectedTweet'),
  close: function() {
    this.set('selectedTweet', null);
  }
});

NewTwitter.LastTweetView = SC.View.extend({
  contentBinding: 'NewTwitter.userController.lastTweet',
  countBinding: 'NewTwitter.userController.tweetCount',
  truncatedBody: function() {
    var content = this.get('content');
    if (!content) { return; }
    return content.get('body').substring(0, 35) + '...';
  }.property('content')
});

NewTwitter.FollowingView = SC.View.extend({
  countBinding: 'NewTwitter.userController.followingCount'
});

NewTwitter.FollowersView = SC.View.extend({
  countBinding: 'NewTwitter.userController.followersCount'
});

NewTwitter.TabItem = SC.View.extend({
  tagName: 'li',
  classNameBindings: ['isActive:active'],
  tabName: null,

  selectedTabBinding: "NewTwitter.appController.selectedTab",
  click: function() {
    NewTwitter.appController.changeTab(this.get('tabName'));
  },
  isActive: function() {
    return this.get('tabName') === this.get('selectedTab');
  }.property('selectedTab'),
});


NewTwitter.TweetForm = SC.View.extend({
  tagName: 'form',

  charsRemaining: function() {
    return 140 - this.getPath('textArea.charCount');
  }.property('textArea.charCount').cacheable(),

  textArea: null,
 
  TextArea: SC.TextArea.extend({
    init: function() {
      this._super();
      this.setPath('parentView.textArea', this);
    },
    charCount: function() {
      var val = this.get('value');
      return val ? val.length : 0;
    }.property('value').cacheable()
  }),

  submit: function(event) {
    var self = this;
    $.post("/_strobe/social/twitter/1/statuses/update.json", {status: this.getPath('textArea.value')}, function(data) {
      self.setPath("textArea.value", "");
      NewTwitter.userController.set("lastTweet", NewTwitter.Tweet.create({
        body: data.text, screenName: data.screen_name, name: data.name,
        time: data.created_at, profileImage: data.profile_image_url
      }));
      NewTwitter.userController.incrementTweetCount();
      NewTwitter.timelineController.load();
    });

    return false;
  }
});

$(function(){
  NewTwitter.appController.auth();
  NewTwitter.timelineController.load();
});
