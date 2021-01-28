// Dependencies and configurations:
require('dotenv').config();
require('url');

const crypto = require('crypto');
const mongoose = require('mongoose');
const dns = require('dns').promises;
const express = require('express');
const cors = require('cors');
const app = express();

const dbURI = process.env.DB_URI;
const options = {useNewUrlParser: true, useUnifiedTopology: true};
const invalidUrl = { error: "invalid URL" };
const hash = crypto.createHash('sha1')


// Database:
async function connectToDatabase(){
  try{
    await mongoose.connect(dbURI, options);
    console.log('connected to database');
  }
  catch(error){
    console.error(error);
    setTimeout(connectToDatabase(),10000);
  }
}
const urlSchema = new mongoose.Schema({
  host: String,
  hash: String
});

const Url = mongoose.model('Url',urlSchema);
Url.deleteMany({});

function url(newUrl){
  let msg = new Promise((resolve, reject) => {
    try{
      let hash = crypto.createHash('sha1');
      let myUrl = new URL(newUrl);
      urlTest(myUrl.host, isValid => {
        if(isValid){
          hash.update(myUrl.href);
          let urlHash = hash.digest('hex').slice(0,8);
          findUrlByHash(urlHash,doc=>{
            if(doc)
              resolve({original_url: doc.host, short_url: doc.hash});
            else{
              let urlDoc = new Url({host: myUrl.href, hash: urlHash});
              urlDoc.save();
              resolve({original_url: urlDoc.host, short_url: urlDoc.hash});
            }
          });
        }
        else resolve(invalidUrl);
      });
    }
    catch(err){
      console.error(err);
      resolve(invalidUrl);
    }
  });
  return msg;
}

function findUrlByHash(findHash,done){
  Url.findOne({hash: findHash},function(err,data){
            if(err) return console.Error(err);
            done(data);
            });
}

function getUrlByHash(findHash){
  let url = new Promise((resolve,reject)=>{
    try{
      findUrlByHash(findHash,(doc)=>{
        if(doc)resolve(doc.host);
        else resolve (false)
      });
    }
    catch(err){
      console.error(err);
      resolve(false);
    }
  });
  return url;
}

async function urlTest(url,done){
	try{
		let result = await dns.lookup(url);
		done(true);
	}
	catch(error){
		done(false);
		console.error(error);
	}
}

// Basic Configuration
const port = process.env.PORT || 3000;

// Middleware:
app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.use('/api/shorturl/new/', express.urlencoded({ extended: true }));

// App homepage:
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// API endpoints
app.post('/api/shorturl/new', (req,res)=>{
  url(req.body.url)
  .then(result => res.json(result), (error) => {
    console.log(error);
    res.json(invalidUrl);
    });
})

app.get('/api/shorturl/:id',(req,res)=>{
  getUrlByHash(req.params.id).then(host=>{
    let url = new URL(host);
    if(url) res.redirect(url.href);
    else res.json({error: "No short URL found for the given input"});
  });
})


// start server:
connectToDatabase();

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
