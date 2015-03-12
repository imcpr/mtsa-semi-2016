var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
var vote = require('./routes/vote');
session = require('express-session');
var app = express();
var passport = require('passport')
  , FacebookStrategy = require('passport-facebook').Strategy;
var pg = require('pg');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'olhosvermelhoseasenhaclassica', maxAge:null })); //session secret
app.use(passport.initialize());
app.use(passport.session());

app.use('/', routes);
app.use('/users', users);


function ensureAuthenticated(req, res, next) {
  console.log(req.session);
  console.log("auth status is " + req.isAuthenticated())
  if (req.isAuthenticated())
    next();
  else
    res.redirect('/login');
}

app.use('/vote', ensureAuthenticated);
app.use('/submit', ensureAuthenticated);

passport.serializeUser(function(user, done) {
  console.log("serializing "+user.id);
  done(null, user.id);
});
passport.deserializeUser(function(obj, done) {
  console.log("de-serializing "+ obj);
  done(null, obj);
});

passport.use(new FacebookStrategy({
    // clientID: '161000937247315',
    // clientSecret: '7e717305c27710ba135610b8497cea16',
    clientID: '1411725585745575',
    clientSecret: '9cb5d3deacedac74d8d8e7bffee437a3',
    // callbackURL: "http://localhost:5000/auth/facebook/callback",
    callbackURL: "http://semi.mtsa.tw/auth/facebook/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    console.log('logged in as ' + profile.displayName + ' ' + profile.id );
    done(null, profile);
  }
));

//coninfo = 'postgres://nnfjxypfugfxlx:ICBucnf9nnSJHZf3CL-3zGKaDe@ec2-23-21-231-14.compute-1.amazonaws.com:5432/d66lpuatihm015';
//db_url = 'postgres://casper:Ru8jo389!@localhost/casper'
db_url = process.env.DATABASE_URL

/*
app.get('/db', function (request, response) {
  pg.connect(db_url, function(err, client, done) {
    client.query('SELECT * FROM Votes', function(err, result) {
      done();
      if (err)
       { console.error(err); response.send("Error " + err); }
      else
       { response.send(result.rows); }
    });
  });
})
*/
app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

app.get('/login', function(req,res){
  res.render('login');
});


app.get('/auth/facebook', passport.authenticate('facebook'));

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get('/auth/facebook/callback', 
  passport.authenticate('facebook', { successRedirect : '/vote', failureRedirect: '/users' }) );

app.get('/vote', function(req, resp){
  console.log(process.env.DATABASE_URL)
  pg.connect(db_url, function(err, client, done) {
      if (err)
       { console.error(err); }
      var q = 'SELECT pid, name, description, image FROM Polls ORDER BY pid';
      console.log("QUERY = "+q);
      client.query(q, function(err, result) {
      done();
      if (err)
       { console.error(err); 
        // if(err['routine']=='_bt_check_unique')
         resp.send("Error: You've already submitted a candidate for this award!"); 
        // else
        //   resp.send("Error " + err);
        }
      else
       { 
        console.log(result.rows);
        resp.render('vote', {awards:result.rows}); 
      }
    });
  });
});



/*
app.get('/signup', function(req, resp){
  console.log(process.env.DATABASE_URL)
  pg.connect(db_url, function(err, client, done) {
      if (err)
       { console.error(err); }
      var q = 'SELECT pid, name, description, image FROM Polls ORDER BY pid';
      console.log("QUERY = "+q);
      client.query(q, function(err, result) {
      done();
      if (err)
       { console.error(err); resp.send("Error " + err); }
      else
       { 
        console.log(result.rows);
        resp.render('vote', {awards:result.rows}); 
      }
    });
  });
});
*/


app.get('/result/:pid', function(req, resp){
  console.log(process.env.DATABASE_URL)
  pg.connect(db_url, function(err, client, done) {
      if (err)
       { console.error(err); }
      var pid = req.params.pid;
      var q = 'SELECT (SELECT name FROM Polls WHERE pid = ' + pid + ') AS pname, name, count(*) FROM Votes WHERE pid = ' + pid + ' GROUP BY name';
      console.log("QUERY = "+q);
      client.query(q, function(err, result) {
      done();
      if (err)
       { console.error(err); 
         resp.send("Error " + err); }
      else
       { 
        if (result.rows.length == 0)
          resp.redirect('/vote');
        else
        {
          console.log(result.rows);
          var arr = [];
          arr.push(['Candidate','Votes']);
          for (var i = 0, len = result.rows.length; i < len; i++) {
            var mod = [result.rows[i].name, parseInt(result.rows[i].count)];
            arr.push(mod);
          }
          resp.render('result', {polldata:JSON.stringify(arr), pname:result.rows[0].pname}); 
        }
      }
    });
  });
});

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

app.post('/submit', function(req, resp){
  console.log(process.env.DATABASE_URL)
  if(req.body.name == '')
    resp.send('Error: You must enter a candidate name!');
  else
  {
    pg.connect(db_url, function(err, client, done) {
        if (err)
         { console.error(err); }
        var q = 'INSERT INTO Votes (pid, uid, name) VALUES (' + req.body.pid +','+ req.user + ',\'' + toTitleCase(req.body.name) + '\')';
        console.log("QUERY = "+q);
        client.query(q, function(err, result) {
        done();
        if (err)
         { console.error(err); 
          if(err['routine']=='_bt_check_unique')
           resp.send("Error: You've already submitted a candidate for this award!"); 
          else
           resp.send("Error " + err) }
          else
            resp.render('thankyou')
        //  { resp.send(result); }
    });
  });
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
