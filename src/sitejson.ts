/**
 * 
 * SiteXML  Engine for site.json
 *
 * (c) Michael Zelensky 2020
 */

import * as fs from 'fs-extra'
import * as path from 'path'
import * as _URL from 'url'
import { SiteXMLMeta, SiteXMLPage, SiteXMLSite, SiteXMLTheme } from '../@types/sitexml'
// import { config } from 'process'

type Command = {
    start: number,
    end: number,
    command: string // TML commands: http://sitexml.info/api
}

type Opt = {
    publicDir? : string
}

const systemDefaultTheme: SiteXMLTheme = {
    id: "system-default",
    dir: "../themes/default/",
    file: "index.thm"
}

// const rootDir = "./sites/"
const SiteXML: any = {
    publicDir: "../../../public",
    filename: 'site.json',
    // path: '/',
    // xml: '',
    // encoding: "utf8",
    // xmldoc: null,
    // processor,
    // currentPID: null,
    // basePath: null,
    // publicDir: '../../public',
    silentMode: false,
    // sitexml,
    // url,
    // path: Path
}
// const generatedSitesBasePath = path.join('.', 'generated-sites')

//max count of recurrent parsing macrocommands while rendering a page
const maxParseCount = 3

SiteXML.init = function(opt: Opt = {}) {
    if (opt.publicDir) this.publicDir = opt.publicDir
    this.setPath(SiteXML.publicDir)
    return this
}

SiteXML.setPath = function(sitePath: string) {
    sitePath = sitePath || SiteXML.path
    if (sitePath.startsWith('./') || sitePath.startsWith('.\\')) sitePath = sitePath.substring(1)
    if (!sitePath.endsWith('/')) sitePath = sitePath + '/'
    var fullpath = path.join(__dirname, sitePath, this.filename)
    if (!fs.existsSync(fullpath)) {
        this.error(`Path doesn't exist (${fullpath})`)
        //process.exit()
    } else {
        SiteXML.path = sitePath
    }
}

/**
 * Returns Site Object
 */
SiteXML.getSiteJson = () => {
    /* @ts-ignore: 'this' possibly undefined */
    const dir = path.join(__dirname, SiteXML.path);
    let json
    try {
        json = fs.readFileSync(`${dir}/site.json`, 'utf8')
        json = JSON.parse(json)
    } catch {
        return ""
    }
    return json
}

/**
 * Returns string, the site's content dir path, e.g. "./sites/abc/content/"
 */
SiteXML.getContentDir = () => {
    return path.join(__dirname, SiteXML.path, "content")
}

SiteXML.getContentIndex = () => {
    const dir = SiteXML.getContentDir()
    return fs.readdirSync(dir)
}

SiteXML.getContent = (page: string) => {
    const dir = SiteXML.getContentDir()
    let content
    try {
        content = fs.readFileSync(`${dir}/${page}`, 'utf8')
    } catch {
        return {status: 404}
    }
    return {content, status: 200}
}

/**
 * Returns content html
 */
SiteXML.getContentHtml = (pageObj: SiteXMLPage, command: string) => {
    const start = "CONTENT(".length
    //find closing bracket and name of the content zone
    let end = start + 1
    while (command[end] !== ")") end++
    const name = command.substring(start, end).toLowerCase()
    if (!pageObj.content || !pageObj.content.length) return ""
    //search for content with given cz name
    for (let i = 0; i < pageObj.content.length; i++) {
        if (pageObj.content[i].name?.toLowerCase() === name) {
            //no file property: continue
            if (!pageObj.content[i].file) continue
            //read and return file contents
            const filepath = SiteXML.getContentDir() + "/" + pageObj.content[i].file
            try {
                const html = fs.readFileSync(filepath, 'utf8')
                return html
            } catch(e) {
                console.log("Error reading file", e)
                return ""
            }
        }
    }
}


SiteXML.saveContent = (page: string, html: string) => {
    const dir = SiteXML.getContentDir()
    let content
    try {
        content = fs.writeFileSync(`${dir}/${page}`, html)
    } catch {
        return {status: 500}
    }
    return {content, status: 204}
}

/**
 * @param {Object} json
 * @param {String} id
 */
SiteXML.saveSiteJson = (json: string) => {
    /* @ts-ignore: 'this' possibly undefined */
    const dir = SiteXML.path
    let content
    const jsonStr = JSON.stringify(json, null, "  ")
    try {
        content = fs.writeFileSync(`${dir}/site.json`, jsonStr)
    } catch (e) {
        console.log('Error', e)
        return {status: 500}
    }
    return {content, status: 204}
}

/**
 * Returns page object basing on URL
 * @todo this is a stub; do it properly
 */
SiteXML.getPageObj = (siteObj: SiteXMLSite, url: string) => {
    /** @todo find and return page that has to be the landing page, using the first page for now */
    const startPage = siteObj.pages?.length ? siteObj?.pages[0] : null
    const url_parts = _URL.parse(url);
    // Removes everything before page path, e.g. /site/site1/todo
    if (!url_parts || !url_parts.pathname) return startPage
    const path = url_parts.pathname.split("/").slice(1).join("/")
    if (!path) return startPage
    const page = SiteXML.getPageByPath(siteObj, path)
    if (page) return page
    return null
}

//recursively search page by incrementing path
SiteXML.getPageByPath = (obj: SiteXMLSite | SiteXMLPage, path: string) => {
    if (!obj.pages) return
    for (let i = 0; i < obj.pages.length; i++) {
        if (obj.pages[i].path === path) return obj.pages[i]
        else if (obj.pages[i].pages) {
            const page = SiteXML.getPageByPath(obj.pages[i], path)
            if (page) return page
        }
    }
}

//recursively search page by incrementing path
SiteXML.getPageById = (obj: SiteXMLSite | SiteXMLPage, path: string) => {
    if (!obj.pages) return
    for (let i = 0; i < obj.pages.length; i++) {
        if (obj.pages[i].path === path) return obj.pages[i]
        else if (obj.pages[i].pages) {
            const page = SiteXML.getPageByPath(obj.pages[i], path)
            if (page) return page
        }
    }
}

SiteXML.getThemeObj = (pageObj: SiteXMLPage, siteObj: SiteXMLSite) => {
    const tid = pageObj.theme
    if (!siteObj.themes || !siteObj.themes.length) return systemDefaultTheme
    if (siteObj.themes.length === 1) return siteObj.themes[0]
    for (let i = 0; i < siteObj.themes.length; i++) {
        let theme = siteObj.themes[i]
        //no theme specified in page
        if (!tid && theme.default) return theme
        //use page's specified theme
        else if (tid === theme.id) return theme
    }
    return systemDefaultTheme
}

SiteXML.getThemeStr = (themeObj: SiteXMLTheme) => {
    // theme path
    let tpath = path.join(__dirname, `${SiteXML.path}/${themeObj.dir}`, themeObj.file)
    // theme string
    let str
    //default theme path
    if (!fs.existsSync(tpath)) {
        tpath = path.join(__dirname, systemDefaultTheme.dir, systemDefaultTheme.file)
    }
    try {
        str = fs.readFileSync(tpath, 'utf8')
    } catch (e) {
        console.error('Error reading theme file', e)
        return ""
    }
    return str
}

/**
 * Returns navigation html
 */
SiteXML.getNaviHtml = (siteObj: SiteXMLSite) => {
    const tpl = '<div class="site-navi">%PAGES%</div>'
    const pagesHTML = SiteXML.getNaviPagesHtml(siteObj.pages, siteObj.rootpath)
    return tpl.replace('%PAGES%', pagesHTML)
}

/**
 * Returns html for pages group in navigation
 * */
SiteXML.getNaviPagesHtml = (pages: SiteXMLPage[], siteroot: string) => {
    if (!pages || !pages.length) return ""
    const tpl = '<div class="site-navi-pages">%PAGES%</div>'
    const tplp = '<div class="site-navi-page" style="margin-left: 10px"><a href="%HREF%">%NAME%</a>%PAGES%</div>'
    let pagesHtml = ""
    pages.forEach((p: SiteXMLPage) => {
        const pagesHTML = SiteXML.getNaviPagesHtml(p.pages, siteroot)
        pagesHtml += tplp
            .replace("%HREF%", siteroot + (p.path || ""))
            .replace("%NAME%", (p.name || "Page (name not specified)"))
            .replace("%PAGES%", pagesHTML)
    })
    return tpl.replace("%PAGES%", pagesHtml)
}

/**
 * Returns single meta tag html: e.g. <meta name="keywords" content="abc" />
 */
SiteXML.getMetaTagHtml = (metaObj: SiteXMLMeta) => {
    let html = "<meta"
    if (metaObj.name)            html += ` name="${metaObj.name}" `
    if (metaObj.charset)         html += ` charset="${metaObj.charset}" `
    if (metaObj.scheme)          html += ` scheme="${metaObj.scheme}" `
    if (metaObj.content)         html += ` content="${metaObj.content}" `
    if (metaObj["node-content"]) html += ` node-content="${metaObj["node-content"]}" `
    if (metaObj["http-equiv"])   html += ` "http-equiv"="${metaObj["http-equiv"]}" `
    return html + "/>"
}

/** @todo: merge site and page metatags */
/**
 * Returns all meta tags html
 */
SiteXML.getMetaHtml = (siteObj: SiteXMLSite, pageObj?: SiteXMLPage) => {
    let html = ""
    /** @todo - merge site and page meta to avoid doubling */
    // get site meta
    siteObj?.meta?.forEach((m: SiteXMLSite) => html += SiteXML.getMetaTagHtml(m))
    // get page meta
    pageObj?.meta?.forEach((m: SiteXMLSite)  => html += SiteXML.getMetaTagHtml(m))
    return html
}

/**
* @todo
* @returns {SiteXMLPage} - landing page
 * */
SiteXML.getStartPage = (siteObj: SiteXMLSite) => {
    if (!siteObj.pages || !siteObj.pages.length) return null
    /** @todo - find start=yes page */
    return siteObj.pages[0]
}

SiteXML.getRootPath = (siteObj: SiteXMLSite) => {
    return siteObj.rootpath
}

/**
 * Returns full theme path for included resources, i.e. rootpath + themepath, e.g. /site/mysite/themes/mytheme/
 */
SiteXML.getThemeFullPath = (siteObj: SiteXMLSite, themeObj: SiteXMLTheme) => {
    const themePath = themeObj.dir.split("/")
    // get rid of leading slash
    if (themePath[0] === "") themePath.splice(0, 1)
    // join paths
    let rootPath = SiteXML.getRootPath(siteObj)
    //add trailing slash if needed
    if (rootPath[rootPath.length - 1] !== "/") rootPath += "/"
    return rootPath + themePath.join("/")
}

/**
 * @returns {String}
 */
SiteXML.replaceCommands = (html: string, parsedTheme: Command[], siteObj: SiteXMLSite, themeObj: SiteXMLTheme, pageObj: SiteXMLPage) => {
    if (!parsedTheme.length) return html
    let newHtml = "", start = 0
    const startPage = SiteXML.getStartPage(siteObj)
    //it should arrive sorted, but let's make sure that it is sorted
    parsedTheme.sort((a, b) => a.start - b.start)
    parsedTheme.forEach((command: Command) => {
        newHtml += html.substring(start, command.start)
        let replaceStr = ""
        if (command.command === "NAVI") {
            replaceStr = SiteXML.getNaviHtml(siteObj)
        } else if (command.command === "TITLE") {
            replaceStr = startPage.title || ""
        } else if (command.command === "META") {
            replaceStr = SiteXML.getMetaHtml(siteObj, startPage)
        } else if (command.command === "ROOTPATH") {
            replaceStr = SiteXML.getRootPath(siteObj)
        } else if (command.command === "THEME_PATH") {
            replaceStr = SiteXML.getThemeFullPath(siteObj, themeObj)
        } else if (command.command === "NAME") {
            replaceStr = siteObj.name || ""
        } else if (command.command.substring(0, "CONTENT(".length) === "CONTENT(") {
            //get current page object
            replaceStr = SiteXML.getContentHtml(pageObj, command.command)
        }
        if (replaceStr) newHtml += replaceStr
        start = command.end
    })
    newHtml += html.substr(start)
    return newHtml
}

// SiteXML.renderSite = (id: string, url: string) => {
SiteXML.renderSite = (url: string) => {
    // const id = "public" //temporary, maybe path will need to be in config or somewhere else
    const siteObj = SiteXML.getSiteJson()
    //replace site id in rootpath; express-site-specific
    // if (siteObj.rootpath) siteObj.rootpath = siteObj.rootpath.replace("__id", id)
    const pageObj = SiteXML.getPageObj(siteObj, url)
    if (!pageObj) return null
    const themeObj = SiteXML.getThemeObj(pageObj, siteObj)
    const themeStr = SiteXML.getThemeStr(themeObj)
    //replace SiteXML macrocommands in theme
    const parsedTheme: Command[] = SiteXML.parseTheme(themeStr)
    let html = SiteXML.replaceCommands(themeStr, parsedTheme, siteObj, themeObj, pageObj)
    //replace macrocommands in placed content
    let parseCount = 0
    let parsedPage: Command[] = SiteXML.parseTheme(html)
    while (parsedPage.length && ++parseCount < maxParseCount) {
        html = SiteXML.replaceCommands(html, parsedPage, siteObj, themeObj, pageObj)
        parsedPage = SiteXML.parseTheme(html)
    }
    return html
}

SiteXML.parseTheme = (str: string) => {
    const commands: Command[] = []
    for (let i = 0; i < str.length; i++) {
        if (str[i] === '<' && str[i+1] === '%') {
            let j = i + 2
            let start = i
            while (j < str.length-1 && str[j] !== "%" && str[j+1] !== ">") j++
            if (j < str.length-1) {
                commands.push({
                    start,
                    end: j+2,
                    command: str.substring(start+2, j).trim()
                })
            }
        }
    }
    return commands
}

SiteXML.error = function(msg) {
    console.log("SiteXML error: " + msg)
}

SiteXML.say = function(what) {
    if (!this.silentMode) console.log(what)
}

SiteXML.handler = function(req, res, next) {
    var sitejson = require('./sitejson')
    // var path = require('path')
    var xml
    var url_parts = _URL.parse(req.url, true)
    // var pathname = url_parts.pathname
    var query = url_parts.query
    var html
  
    // STP GET
  
    if (req.method == "GET") {
  
      //?sitexml
      if (query.sitexml !== undefined || query.sitejson !== undefined) {
        xml = sitejson.getSiteJson()
        if (query.sitexml) sitejson.say("GET ?sitexml")
        if (query.sitejson) sitejson.say("GET ?sitejson")
        res.set({'Content-Type': 'text/json'})
        res.send(xml)
      } else
  
      //?id=X
    //   if (query.id !== undefined) {
    //     if (query.name !== undefined) {
    //       sitejson.say(`GET ?id=${query.id}&name=${query.name}`)
    //       html = sitejson.getContentByNameAndPageId(query.name, query.id)
    //     } else {
    //       sitejson.currentPID = query.id
    //       sitejson.say(`GET ?id=${query.id}`)
    //       html = sitejson.getPageById(query.id)
    //     }
    //     res.set('Content-Type', 'text/html')
    //     res.send(html)
    //   } else
  
      //?cid=X
      if (query.cid !== undefined) {
        sitejson.say(`GET ?cid=${query.cid}`)
        html = sitejson.getContentNodeTextContent(sitejson.getContentNodeById(query.cid))
        res.set('Content-Type', 'text/html')
        res.send(html)
      } else
  
    //   //?login
    //   if (query.login !== undefined) {
    //     sitejson.say(`GET ?login`)
    //     html = fs.readFileSync(path.join(__dirname, '_login.html'))
    //     res.set('Content-Type', 'text/html')
    //     res.send(html)
    //   } else
  
    //   //?logout
    //   if (query.logout !== undefined) {
    //     sitejson.say(`GET ?logout`)
    //     html = 'logged out'
    //     res.set('Content-Type', 'text/html')
    //     res.send(html)
    //   } else
  
      //all other
      {
        // sitejson.say(`GET ${pathname}`)
        // var page = sitejson.getPageNodeByAlias(pathname)
        // if (page) {
        //   sitejson.currentPID = page.getAttribute('id')
        //   html = sitejson.getPageHTMLByPageNode(page)
        //   res.set('Content-Type', 'text/html')
        //   res.send(html)
        // }

        sitejson.say("GET " + req.url)
        // authorized?
        // // if (!siteBelongsToUser(req)) {
        // //     res.status(401).sendFile(path.join(__dirname, "html", "401.html"))
        // //     return
        // // }
        // // let id = getSiteId(req)
        const fullURL = new URL(req.url, `http://${req.headers.host}`);
        // if (!fs.existsSync(path.join(sitesPath, id))) {
        //     res.status(404).sendFile(file404)
        // } else {
            const html = SiteXML.renderSite(fullURL.href)
            if (html) res.send(html)
            else res.status(404).end()
        // }

      }
    } else
  
    //STP POST
    // if (req.method == "POST") {
    //   //?login
    //   if (query.login !== undefined) {
    //     sitejson.say(`POST ?login=${req.body.login}`)
    //     var login = req.body.login,      //
    //         password = req.body.password //note: this requires app.use(express.urlencoded({extended:true})) in the main app file
    //     var success = sitejson.setSession(login, password)
    //     if (success) {
    //       html = "logged in"
    //     } else
    //     res.set('Content-Type', 'text/html')
    //     res.send(html)
    //   } else
  
    //   // ?cid
    //   if (req.body.cid !== undefined) {
    //     sitejson.say(`POST ?cid=${req.body.cid}`)
    //     var content = req.body.content
    //     if (sitejson.updateContent(req.body.cid, content)) {
    //       html = "content saved"
    //     } else {
    //       html = "error saving content"
    //     }
    //     res.set('Content-Type', 'text/html')
    //     res.send(html)
    //   } else
  
    //   // ?xml
    //   if (req.body.sitexml !== undefined) {
    //     sitejson.say('POST ?sitexml')
    //     if (sitejson.updateXML(req.body.sitexml)) {
    //       html = "sitexml saved"
    //     } else {
    //       html = "error saving sitexml"
    //     }
    //     res.set('Content-Type', 'text/html')
    //     res.send(html)
    //   }
    // }
  
    next()
  }

// SiteXML.deleteContent = (id: string, files: string[]) => {
//     const dir = SiteXML.getContentDir(id)
//     files.forEach((file: string) => {
//         fs.unlink(path.join(dir, file), (err: any) => {
//             const filepath = path.join(dir, file)
//             if (err) console.log("Error removing file ", filepath, err)
//             else console.log("Removed file ", filepath)
//         })
//     })
// }

/**
 * Generates page for static site (publish via FTP)
 */
// SiteXML.generatePage = (id: string, pageObj: SiteXMLPage, siteObj: SiteXMLSite) => {
//     const themeObj = SiteXML.getThemeObj(pageObj, siteObj)
//     const themeStr = SiteXML.getThemeStr(id, themeObj)
//     //replace SiteXML macrocommands in theme
//     const parsedTheme: Command[] = SiteXML.parseTheme(themeStr)
//     let html = SiteXML.replaceCommands(id, themeStr, parsedTheme, siteObj, themeObj, pageObj)
//     //replace macrocommands in placed content
//     const parsedPage: Command[] = SiteXML.parseTheme(html)
//     html = SiteXML.replaceCommands(id, html, parsedPage, siteObj, themeObj, pageObj)
//     return html
// }

/**@todo copy only what is needed */
// SiteXML.copyThemes = (id: string, basepath: string) => {
//     const source = path.join(rootDir, id, 'themes')
//     const target = path.join(basepath, 'themes')
//     try {
//         fs.copySync(source, target)
//     } catch (err) {
//         console.log(`Error copying dir ${source} -> ${target}`)
//     }
// }

/**
 * Recursive
 * @param id
 * @param pageObj
 * @param siteObj
 */
/**@todo create a start page in the site root */
// SiteXML.generateStaticSite = (id: string, pageObj?: SiteXMLPage, siteObj?: SiteXMLSite) => {
//     const basepath = path.join(generatedSitesBasePath, `${id}`)
//     //first (entry) recursion
//     if (!siteObj) {
//         SiteXML.copyThemes(id, basepath)
//         siteObj = SiteXML.getSiteJson(id)
//         if (siteObj) siteObj.rootpath = ""
//     }
//     if (!siteObj) throw (new Error("SiteObj not defined"))
//     //iterate pages
//     let pages
//     if (pageObj) pages = pageObj.pages
//     else pages = siteObj.pages
//     if (!pages) return
//     for (let i = 0; i < pages.length; i++) {
//         /**@todo review path, it may be undefined */
//         const dirpath = path.join(basepath, pages[i].path || "")

//         //make dir
//         fs.mkdirSync(dirpath, {recursive: true})
//         const filepath = path.join(basepath, pages[i].path || "", 'index.html')
//         const html = SiteXML.generatePage(id, pages[i], siteObj)

//         //write page file
//         try {
//             fs.writeFileSync(filepath, html)
//         } catch (e) {
//             console.log("Error writing file", filepath, e)
//         }

//         //recursion
//         SiteXML.generateStaticSite(id, pages[i], siteObj)
//     }
    
// }

module.exports = SiteXML.init()