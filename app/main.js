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
      } else if (showPopup === true) {
        NewTwitter.authWindow = window.open(data.authentication.authentication_uri, 'twitter_auth_window');
        if (!NewTwitter.authWindow) {
          alert('Please turn off your popup blocker...');
        } else {
          if (NewTwitter.authPoller) { clearInterval(NewTwitter.authPoller); }
          NewTwitter.authPoller = setInterval(function() {
            NewTwitter.appController.auth();
          }, 1000);
        }
      }
    });
  },

  deauth: function() {
    $.ajax("/_strobe/social/twitter/authentication", {type: "DELETE", complete: function(xhr, stat) {
      NewTwitter.appController.set('authorized', false);
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
    return body.replace(/@(\w+)/g, "<a href='#$1'>@$1</a>");
  }.property('body')
});

NewTwitter.timelineController = SC.ArrayProxy.create({
  content: [],
  loaded: false,

  load: function() {
    var self = this;
    $.getJSON("/_strobe/social/twitter/1/statuses/home_timeline.json?count=30", function(data) {
      NewTwitter.timelineController.loadTweets(data);
      self.set('loaded', true);
    });
    $.getJSON("/_strobe/social/twitter/1/friends/ids.json?include_entities=true", function(data) {
      NewTwitter.userController.loadFriends(data);
    });
    $.getJSON("/_strobe/social/twitter/1/followers/ids.json?include_entities=true", function(data, stat, xhr) {
      NewTwitter.userController.loadFollowers(data);
    });
  },

  loadTweets: function(tweets) {
    this.set('content', []);
    var self = this;
    tweets.forEach(function(data) {
      var tweet = NewTwitter.Tweet.create({
        body: data.text, screenName: data.user.screen_name, name: data.user.name,
        time: data.created_at, profileImage: data.user.profile_image_url
      });
      self.pushObject(tweet);
    });
  }
});

NewTwitter.mentionsController = SC.ArrayProxy.create({
  content: [],
  loaded: false,

  load: function() {
    var self = this;
    $.getJSON("/_strobe/social/twitter/1/statuses/mentions.json", function(data) {
      NewTwitter.mentionsController.loadTweets(data);
      self.set('loaded', true);
    });
  },

  loadTweets: function(tweets) {
    this.set('content', []);
    var self = this;
    tweets.forEach(function(data) {
      var tweet = NewTwitter.Tweet.create({
        body: data.text, screenName: data.user.screen_name, name: data.user.name,
        time: data.created_at, profileImage: data.user.profile_image_url
      });
      self.pushObject(tweet);
    });
  }
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
    this.set('lastTweet', NewTwitter.Tweet.create({
      body: data.status.text, screenName: data.screen_name, name: data.name,
      time: data.status.created_at, profileImage: data.profile_image_url
    }));
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

  }
});

NewTwitter.tweetController = SC.Object.create({
  content: null
});

NewTwitter.TweetStream = SC.CollectionView.extend({
  tagName: "div",
  itemViewClass: SC.View.extend({
    classNames: ['tweet'],
    click: function() {
      NewTwitter.tweetController.set('content', this.get('content'));
    }
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
      NewTwitter.timelineController.load();
    });

    return false;
  }
});

$(function(){
  NewTwitter.appController.auth();
  NewTwitter.timelineController.load();
});
