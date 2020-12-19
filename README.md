# sitejson-node

## Installation

`yarn add sitejson`

## Server

Create `index.js`: 

```
const express = require('express')
const sitejson = require('sitejson')

var app = express()

/* SiteXML */
app.use(express.urlencoded({extended:true}))
app.use(express.static(`${__dirname}/public/`, {dotfiles: 'allow'}))
app.use(sitejson.handler)
/* end SiteXML*/

app.listen(80, console.log("Listen to port 80"))
```

### Run

Make sure that SiteXML files are in `public` directory. After that, just run the server: 

`node index`