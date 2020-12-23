/**
 * 
 * SiteXML Engine for site.json
 *
 * (c) Michael Zelensky 2020
 */

import * as fs from 'fs-extra'
import * as path from 'path'
import * as _URL from 'url'
import { SiteXMLModule, ModuleJson, SiteXMLContent, SiteXMLMeta, SiteXMLPage, SiteXMLSite, SiteXMLTheme } from '../@types/sitexml'

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
    silentMode: false,
    modulesDir: "../../../site_modules"
}
// const generatedSitesBasePath = path.join('.', 'generated-sites')

//max count of recurrent parsing macrocommands while rendering a page
const maxParseCount = 3

const moduleDependenciesPath = "~module_dependencies"
const moduleActionsPath      = "~module_actions"

// modules
const frontendModules: any = {}
const backendModules: any = {}

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
    } else {
        SiteXML.path = sitePath
    }
}

/**
 * Returns Site Object
 */
SiteXML.getSiteJson = () => {
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

// get specific module instance settings from siteObj.modules
SiteXML.getModuleInstanceOptions = (siteObj: SiteXMLSite, name: string, instanceId?: string) => {
    if (!siteObj.modules) return

    // find module by name
    let module
    for (let i = 0; i < siteObj.modules.length; i++) {
        if (siteObj.modules[i].name === name) {
            module = siteObj.modules[i]
            break
        }
    }
    if (!module) return
    
    //find instance of that module
    if (!module.instances)        return
    if (!module.instances.length) return
    if (!instanceId)              return
    for (let i = 0; i < module.instances.length; i++) {
        if (module.instances[i].id === instanceId) {
            return module.instances[i]
        }
    }
}

// Returns HTML for module dependencies
/**@todo Should return CSS and JS files in corresponding html tags: SCRIPT or LINK */
SiteXML.getModuleDependencies = (moduleJson: ModuleJson, siteObj: SiteXMLSite) => {
    if (!moduleJson.frontend)                     return ""
    if (!moduleJson.frontend.dependencies)        return ""
    if (!moduleJson.frontend.dependencies.length) return ""
    let html = ""
    // strip traing slash
    let rootPath = siteObj.rootpath
    if (rootPath[rootPath.length-1] === "/")  rootPath = rootPath.slice(0, -1)
    // generate HTML
    let dependencies = moduleJson.frontend.dependencies
    for (let i = 0; i < dependencies.length; i++) {
        html += `<script src="${rootPath}/${moduleDependenciesPath}/${moduleJson.name}/${dependencies[i]}"></script>`
    }
    return html
}

/**
 * Returns content html
 */
SiteXML.getContentHtml = async (pageObj: SiteXMLPage, command: string, siteObj: SiteXMLSite) => {
    const start = "CONTENT(".length
    //find closing bracket and name of the content zone
    let end = start + 1
    while (command[end] !== ")") end++
    const name = command.substring(start, end).toLowerCase()
    if (!pageObj.content || !pageObj.content.length) return ""
    //search for content with given cz name
    for (let i = 0; i < pageObj.content.length; i++) {
        let content: SiteXMLContent = pageObj.content[i]
        if (content.name?.toLowerCase() === name) {
            // module
            if (content.type?.toLowerCase() === "module") {
                if (!content.module) {
                    SiteXML.error("Module name is not specified")
                    return ""
                }
                
                // module.json
                const moduleJsonPath = path.join(__dirname, SiteXML.modulesDir, content.module, "module.json")
                if (!fs.existsSync(moduleJsonPath)) {
                    SiteXML.error("Module.json doesn't exists: " + moduleJsonPath)
                    return ""
                }

                // read module.json
                let moduleJson: ModuleJson
                try {
                    moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'))
                } catch(e) {
                    SiteXML.error("Error reading and parsing json file", e)
                    return ""
                }

                /**@todo load once for the whole page */
                const dependenciesHTML = SiteXML.getModuleDependencies(moduleJson, siteObj)

                // load module
                let module
                if (frontendModules[content.module]) {
                    module = frontendModules[content.module]
                } else {
                    if (!moduleJson.frontend?.main) {
                        SiteXML.error("Module frontend main file is not defined")
                        return ""
                    }
                    const filepath = path.join(__dirname, SiteXML.modulesDir, content.module, moduleJson.frontend.main)
                    if (!fs.existsSync(filepath)) {
                        SiteXML.error("Module frontend main file doesn't exists: " + filepath)
                        return ""
                    }
                    module = await import(filepath)
                    frontendModules[content.module] = module
                }
                const moduleOptions = SiteXML.getModuleInstanceOptions(siteObj, content.module, content.instanceid)
                return dependenciesHTML + module.render(moduleOptions, siteObj)
                

            // text content
            } else {
                //no file property: continue
                if (!content.file) continue
                //read and return file contents
                const filepath = path.join(SiteXML.getContentDir(), content.file)
                if (!fs.existsSync(filepath)) {
                    SiteXML.error("Content file doesn't exists: " + filepath)
                    return ""
                }
                // read content file
                try {
                    const html = fs.readFileSync(filepath, 'utf8')
                    return html
                } catch(e) {
                    SiteXML.error("Error reading file", e)
                    return ""
                }
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
    const urlParts = _URL.parse(url);
    // Removes everything before page path, e.g. /site/site1/todo
    if (!urlParts || !urlParts.pathname) return startPage
    const path = urlParts.pathname.split("/").slice(1).join("/")
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
SiteXML.replaceCommands = async (html: string, parsedTheme: Command[], siteObj: SiteXMLSite, themeObj: SiteXMLTheme, pageObj: SiteXMLPage) => {
    if (!parsedTheme.length) return html
    let newHtml = "", start = 0
    const startPage = SiteXML.getStartPage(siteObj)
    //it should arrive sorted, but let's make sure that it is sorted
    parsedTheme.sort((a, b) => a.start - b.start)
    for (let i = 0; i < parsedTheme.length; i++) {
        const command: Command = parsedTheme[i]
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
            replaceStr = await SiteXML.getContentHtml(pageObj, command.command, siteObj)
        }
        if (replaceStr) newHtml += replaceStr
        start = command.end
    }
    newHtml += html.substr(start)
    return newHtml
}

SiteXML.renderSite = async (url: string) => {
    const siteObj = SiteXML.getSiteJson()
    //replace site id in rootpath; express-site-specific
    const pageObj = SiteXML.getPageObj(siteObj, url)
    if (!pageObj) return null
    const themeObj = SiteXML.getThemeObj(pageObj, siteObj)
    const themeStr = SiteXML.getThemeStr(themeObj)
    //replace SiteXML macrocommands in theme
    const parsedTheme: Command[] = SiteXML.parseTheme(themeStr)
    let html = await SiteXML.replaceCommands(themeStr, parsedTheme, siteObj, themeObj, pageObj)
    //replace macrocommands in placed content
    let parseCount = 0
    let parsedPage: Command[] = SiteXML.parseTheme(html)
    while (parsedPage.length && ++parseCount < maxParseCount) {
        html = await SiteXML.replaceCommands(html, parsedPage, siteObj, themeObj, pageObj)
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

// Handles module response for POST and GET
SiteXML.moduleHandler = async function(req, res, next) {
    const urlParts = _URL.parse(req.url, true)
    const pathNameSplit = urlParts.pathname.split("/") 
    // module name from pathname like: /~module_actions/modulename
    /**@todo is it possible that the pathname will be without leading slash, e.g. ~module_actions/modulename  */
    const moduleName = pathNameSplit[2]

    if (!moduleName) res.status(404).end()

    // module.json
    const moduleJsonPath = path.join(__dirname, SiteXML.modulesDir, moduleName, "module.json")
    if (!fs.existsSync(moduleJsonPath)) {
        SiteXML.error("Module.json doesn't exists: " + moduleJsonPath)
        res.status(500).end()
    }

    // read module.json
    let moduleJson: ModuleJson
    try {
        moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'))
    } catch(e) {
        SiteXML.error("Error reading and parsing json file", e)
        res.status(500).end()
    }

    // load module
    let module: any
    if (backendModules[moduleName]) {
        module = backendModules[moduleName]
    } else {
        if (!moduleJson.backend?.main) {
            SiteXML.error("Module frontend main file is not defined")
            res.status(500).end()
        }
        const filepath = path.join(__dirname, SiteXML.modulesDir, moduleName, moduleJson.backend.main)
        if (!fs.existsSync(filepath)) {
            SiteXML.error("Module frontend main file doesn't exists: " + filepath)
            res.status(500).end()
        }
        module = await import(filepath)
        backendModules[moduleName] = module
    }
    module.handler(req, res, next)
}

SiteXML.handler = async function(req, res, next) {
    const sitejson = require('./sitejson')
    const urlParts = _URL.parse(req.url, true)
    const query = urlParts.query
    const pathNameSplit = urlParts.pathname.split("/") 
    let xml: SiteXMLSite
    let html: string

    /**
     * STP GET
     */ 
  
    if (req.method == "GET") {

        // handle module requests, when pathname is like /~module_actions/...
        /**@todo is it possible that the pathname will be without leading slash, e.g. ~module_actions/modulename  */
        if (pathNameSplit[1] === moduleActionsPath) {
            SiteXML.moduleHandler(req, res, next)
        } else

        //?sitexml
        if (query.sitexml !== undefined || query.sitejson !== undefined) {
            xml = sitejson.getSiteJson()
            if (query.sitexml) sitejson.say("GET ?sitexml")
            if (query.sitejson) sitejson.say("GET ?sitejson")
            res.set({'Content-Type': 'text/json'})
            res.send(xml)
        } else

        //?cid=X
        if (query.cid !== undefined) {
            sitejson.say(`GET ?cid=${query.cid}`)
            html = sitejson.getContentNodeTextContent(sitejson.getContentNodeById(query.cid))
            res.set('Content-Type', 'text/html')
            res.send(html)
        } else

        //all other
        {
            sitejson.say("GET " + req.url)
            const fullURL = new URL(req.url, `http://${req.headers.host}`);
            const html = await SiteXML.renderSite(fullURL.href)
            if (html) {
                res.send(html)
            } else {
                res.status(404).end()
            }
        }
    } else 

    /**
     * STP POST
     */

    if (req.method == "POST") {

        // handle module requests, when pathname is like /~module_actions/...
        /**@todo is it possible that the pathname will be without leading slash, e.g. ~module_actions/modulename  */
        if (pathNameSplit[1] === moduleActionsPath) {
            SiteXML.moduleHandler(req, res, next)
        }

    }

    next()
  }

module.exports = SiteXML.init()