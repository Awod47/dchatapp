import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';

var { PythonShell } = require('python-shell')

var FormData = require('form-data');
var fs = require('fs-extra')


const multer = require('multer')
const path = require('path')
const aleph = require('aleph-js')

// const storage = multer.memoryStorage()


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      return cb(null, './uploads')
    },
    filename: function (req, file, cb) {
      return cb(null, `${file.originalname}`)
    }
})
  
const upload = multer({ storage: storage })

const expressSession = require('express-session')({
    secret: 'insert secret here',
    resave: false,
    saveUninitialized: false
})


import passport from 'passport';
import passportLocalMongoose from 'passport-local-mongoose';
import connectEnsureLogin from 'connect-ensure-login';
import { exit } from 'process';

const app = express();
const port = 3000;

app.use(express.static(__dirname))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true}))
app.use(expressSession)

app.use(passport.initialize())
app.use(passport.session())

app.set('view engine', 'ejs')

mongoose.connect('mongodb://127.0.0.1/AlephChat')

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    private_key: String,
    public_key: String,
    mnemonics: String,
    address: String
})

userSchema.plugin(passportLocalMongoose)

const User = mongoose.model('User', userSchema);
passport.use(User.createStrategy())

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

// User.create({username: 'Jimbob', password: 'password'})
// User.create({username: 'Alex', password:'invalid'})
// User.create({username: 'Jenny', password:'pass123'})

// User.register({ username: "alex123", active: false}, 'password')

app.get('/', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {

    var room = 'custom1'
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    let memberships = await aleph.posts.get_posts('channel_memberships', {'addresses': [req.user.address], 'api_server':api_server})
    
   
    let channel_refs = memberships.posts.map((membership)=>{
        if(membership.ref){
            return membership.ref
        }
    })

    channel_refs = channel_refs.filter(ref => ref != undefined)

    if(channel_refs.length!= 0){
        channel_refs = channel_refs
    }
    else{
        channel_refs = ['ab389bf26e11ddc84dc5985dfd51f6f455db636acf6c3d1d67eaf9c419b51c44','59b36ecb090ae502f639ede7f7a66ea491ded9a7b003bc4349e1c95ba871ad09']
    }

    let channels = await aleph.posts.get_posts('channels', { 'hashes': channel_refs, 'api_server':api_server })

    res.render('index', { 
        channels: channels.posts,
        user: req.user , 
        room: room
    })
})

app.get('/channels/new', connectEnsureLogin.ensureLoggedIn(), (req, res) => {
    res.render('channels/new')
})


app.get('/channels', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    var room = req.params.room
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    let channel_hash = req.query.channelhash

    let channels = await aleph.posts.get_posts('channels', {'api_server':api_server })

    res.render('channels/index', { 
        channels: channels.posts,
        channel_hash: channel_hash
    })
})

app.get('/channels/:item_hash/join', connectEnsureLogin.ensureLoggedIn(), async (req, res)=>{
    var room = req.params.room
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    aleph.ethereum.import_account({mnemonics: req.user.mnemonics}).then(async(account) => {

        let result = await aleph.posts.get_posts('channels', {'api_server':api_server, hashes: [req.params.item_hash] })
        
        let post = result.posts[0]
        if (post){
            let data;
            let post_content = JSON.parse(post.item_content)
            if(post_content.content.type == 'private'){
                data = {
                    status: 'pending'
                }
            }else{
                data = {
                    status: 'active'
                }
            }
            await aleph.posts.submit(account.address, 'channel_memberships', {}, {
                ref: req.params.item_hash,
                api_server: api_server,
                account: account,
                channel: channel
            })
    
            res.redirect(`/rooms/${req.params.item_hash}`)
        } else{

        }

    })

})

app.get("/mychannels", connectEnsureLogin.ensureLoggedIn(), async(req, res)=>{
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    let channels = await aleph.posts.get_posts('channels', {'api_server':api_server })

    res.render('hashes', { 
        channels: channels.posts, 
        user: req.user ,
    })
})

app.post("/channels", connectEnsureLogin.ensureLoggedIn(), (req, res)=>{
    
    var channel_name = req.body.name

    aleph.ethereum.import_account({mnemonics: req.user.mnemonics}).then(async(account) => {
        var api_server = 'https://api2.aleph.im'
        var network_id = 261
        var channel = 'NEW_CHAT'
        var data


        data  = {
            'body': channel_name,
            'approved_addresses': [account.address]
           }

        let response = await aleph.posts.submit(account.address, 'channels', data, {
            api_server: api_server,
            account: account,
            channel: channel
        })

        await aleph.posts.submit(account.address, 'channel_memberships', {}, {
            ref: response.item_hash,
            api_server: api_server,
            account: account,
            channel: channel
        })

        res.redirect("/")
    })
})

app.get('/rooms/:room', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    var room = req.params.room
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    let memberships = await aleph.posts.get_posts('channel_memberships', {'addresses': [req.user.address], 'api_server':api_server})

    let channel_refs = memberships.posts.map((membership)=>{
        if(membership.ref){
            return membership.ref
        }
    })

    channel_refs = channel_refs.filter(ref => ref != undefined)

    let channels = await aleph.posts.get_posts('channels', { 'hashes': channel_refs, 'api_server':api_server })

    let result = await aleph.posts.get_posts('messages', {'refs': [room], 'api_server': api_server})
    
    res.render('index', { 
        channels: channels.posts,
        posts: result.posts, 
        user: req.user , 
        room: room
    })

})

app.get('/logout', connectEnsureLogin.ensureLoggedIn(), (req, res)=>{
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/login');
    })
})

app.get('/login', (req, res)=>{
    res.sendFile('views/login.html' , { root: __dirname })
})

app.get('/register', (req, res)=>{
    res.sendFile('views/register.html' , { root: __dirname })
})

app.post("/register", (req, res)=>{
    User.register({ username: req.body.username, active: false}, req.body.password, (err, user)=>{
        aleph.ethereum.new_account().then((eth_account)=>{

            user.private_key = eth_account.private_key
            user.public_key = eth_account.public_key
            user.mnemonics = eth_account.mnemonics
            user.address = eth_account.address
            user.save()
            passport.authenticate('local')(req, res, ()=>{
                res.redirect("/")
            })
        }) 
    })
})

app.get("/myaccount", connectEnsureLogin.ensureLoggedIn(), (req, res)=>{

    let username = req.user.username
    let password = req.user.password

    res.render("account/myAccount", {
        username: username,
        password: password
    })

})

app.post("/changeusername", connectEnsureLogin.ensureLoggedIn(), async(req, res)=>{

    let account_address = req.user.address
    let new_username = req.body.accountusername
    await User.updateOne({address: account_address},{username: new_username})

    res.render("account/myAccount", {
        username: new_username,
    })
})
    
app.get("/changepassword", connectEnsureLogin.ensureLoggedIn(), (req, res)=>{
    res.render("account/passwordPage")
})

app.post("/changepassword", connectEnsureLogin.ensureLoggedIn(), (req,res)=>{
    let current_password = req.body.currentpass
    let new_password = req.body.newpass
    
    req.user.changePassword( current_password, new_password , function(err){
        if(err) {
            if(err.name === 'IncorrectPasswordError'){
                 res.json({ success: false, message: 'Incorrect password' }); // Return error
            }else {
                res.json({ success: false, message: err.name });
            }
        } else {
            res.render("account/myAccount",{
                username: req.user.username
            })
        }
    })

   

})


app.get("/search", connectEnsureLogin.ensureLoggedIn(), (req, res)=>{
    res.render("channels/search")
})

app.post("/login", passport.authenticate('local'), (req, res)=>{
    res.redirect("/")
})

//MESSAGES
app.post("/messages/:room", connectEnsureLogin.ensureLoggedIn() , upload.single('filemessage') ,(req, res)=>{

    
    var message = req.body.message
    const room = req.params.room


    aleph.ethereum.import_account({mnemonics: req.user.mnemonics}).then((account)=>{
        var api_server = 'https://api2.aleph.im'
        var network_id = 261
        var channel = 'TEST'

        if(message!= "" && message!= " "){
            aleph.posts.submit(account.address, 'messages',{'body':message},
            {
                ref: room,
                api_server: api_server,
                account: account,
                channel: channel
            })
            
        }

        if(req.file!= undefined){

            var link;
            var options = {
                args:[account.private_key]
            }

            PythonShell.run('myscript.py', options).then(messages=>{
                link = ""+messages[0]
                aleph.posts.submit(account.address, 'messages',{'body':link},
                {
                    ref: room,
                    api_server: api_server,
                    account: account,
                    channel: channel
                })
            });
            
        }
    })
})

app.get('/users/:username', connectEnsureLogin.ensureLoggedIn(), (req, res) => {

    User.findOne({ username: req.params.username }, (err, user) => {
        if(err){
            res.send({error : err})
        } else {
            res.send({user : user})
        }
    })
})

app.listen(port, ()=>{
    console.log(`Server is running on port ${port}`)
})


