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
        NewTwitter.userController.load();
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
  },

  authorized: function() {
    this.set('authorized', true);
    $('#container').show();
  }
});

NewTwitter.Tweet = SC.Object.extend({
  id: null,
  body: null,
  screenName: null,
  name: null,
  time: null,
  profileImage: null,
  retweeted: false,
  retweeted_status_id: null,

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
  retweet: function() {
    var self = this;

    $.post((this.get('retweeted') ? "/_strobe/social/twitter/1/statuses/destroy/"+this.get("retweeted_status_id")+".json" :
                                    "/_strobe/social/twitter/1/statuses/retweet/"+this.get("id")+".json"),
      function(data){
        self.set('retweeted', !self.get('retweeted'));
        self.set('retweeted_status_id', self.get('retweeted') ? data.id_str : null);
      }
    );
  },
  delete: function() {
    var self = this;

    $.post("/_strobe/social/twitter/1/statuses/destroy/"+this.get("id")+".json", function(data) {
      self.destroy();
    });
  }

});

NewTwitter.Tweet.reopenClass({
  createFromApi: function(data) {
    console.log(data);
    return NewTwitter.Tweet.create({
      id: data.id_str, body: data.text, screenName: data.user.screen_name, name: data.user.name,
      time: data.created_at, profileImage: data.user.profile_image_url,
      retweeted: !!data.current_user_retweet, retweeted_status_id: (data.current_user_retweet ? data.current_user_retweet.id_str : null)
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
  dataUrl: "/_strobe/social/twitter/1/statuses/home_timeline.json?count=30&include_my_retweet=true"
});

NewTwitter.mentionsController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/mentions.json?include_my_retweet=true"
});

NewTwitter.retweetedByMeController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/retweeted_by_me.json?include_my_retweet=true"
});

NewTwitter.retweetedToMeController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/retweeted_to_me.json?include_my_retweet=true"
});

NewTwitter.retweetsOfMeController = NewTwitter.TweetStreamController.create({
  dataUrl: "/_strobe/social/twitter/1/statuses/retweets_of_me.json?include_my_retweet=true"
});

NewTwitter.userController = SC.Object.create({
  userName: null,
  followersCount: null,
  followingCount: null,
  tweetCount: null,
  friends: [],
  followers: [],
  lastTweet: null,

  load: function() {
    var self = this;

    $.getJSON("/_strobe/social/twitter/1/account/verify_credentials.json", function(data) {
      NewTwitter.appController
      NewTwitter.userController.loadUser(data);
      NewTwitter.appController.authorized();
    });
    $.getJSON("/_strobe/social/twitter/1/followers/ids.json", function(data) {
      self.loadFollowers(data);
    });
    $.getJSON("/_strobe/social/twitter/1/friends/ids.json", function(data) {
      self.loadFriends(data);
    });
  },

  loadUser: function(data) {
    this.set("userName", data.screen_name);
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
        self.get('friends').pushObject(SC.Object.create({image: friend.profile_image_url, screenName: friend.screen_name}));
      });
    });
  },

  loadFollowers: function(data) {
    this.set('followers', []);
    var self = this;
    jQuery.getJSON("/_strobe/proxy/api.twitter.com/1/users/lookup.json", {user_id: data.slice(0, 5).join(',')}, function(friends_data) {
      friends_data.forEach(function(friend) {
        self.get('followers').pushObject(SC.Object.create({image: friend.profile_image_url, screenName: friend.screen_name}));
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
  retweetedBinding: "content.retweeted",
  currentUserNameBinding: "NewTwitter.userController.userName",

  click: function() {
    //NewTwitter.tweetController.set('content', this.get('content'));
  },
  retweet: function(sender) {
    this.get('content').retweet();
  },
  delete: function(sender) {
    this.get('content').delete();
    this.destroy();
  },
  currentUsersTweet: function() {
    return this.getPath('content.screenName') === this.get('currentUserName')
  }.property('content.screenName', 'currentUserName').cacheable()
});

NewTwitter.TweetStream = SC.CollectionView.extend({
  tagName: "div",
  itemViewClass: NewTwitter.TweetView
  /*
  emptyView: SC.View.extend({
    template: SC.Handlebars.compile("<div class='tweet'><em>Damn, you need some friends bro!</em></div>")
  })
  */
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
      var tweet = NewTwitter.Tweet.createFromApi(data);
      self.setPath("textArea.value", "");
      NewTwitter.userController.set("lastTweet", tweet);
      NewTwitter.userController.incrementTweetCount();
      NewTwitter.timelineController.unshiftObject(tweet);
    });

    return false;
  }
});

$(function(){
  NewTwitter.appController.auth();
  NewTwitter.timelineController.load();
});
