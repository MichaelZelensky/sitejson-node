type SiteXMLMeta = {
  name?: string
  , charset?: string
  , "http-equiv"?: string
  , scheme?: string
  , content?: string
  , "node-content"?: string
}

export type SiteXMLTheme = {
    id: string
  , url?: string
  , name?: string
  , dir: string
  , file: string
  , default?: string
}

export type SiteXMLContent = {
    id?: string
  , name?: string
  , type?: string
  , params?: string
  , file?: string
  , module?: string
  , instanceid?: string
}

export type SiteXMLPage = {
    id?: string 
  , name: string
  , startpage?: string
  , nonavi?: string
  , title?: string
  , path?: string
  , theme?: string
  , meta?: SiteXMLMeta[]
  , pages?: SiteXMLPage[]
  , content?: SiteXMLContent[]
}

export type SiteXMLSite = {
    name?: string
  , rootpath?: string
  , meta?: SiteXMLMeta[]
  , themes?: SiteXMLTheme[]
  , pages?: SiteXMLPage[]
  , modules?: SiteXMLModule[]
}

export type SiteXMLModule = {
    name?: string
  , instances?: any[] // instance object must contain "id" field!
}

export type ModuleJson = {
    name: string
  , version: string
  , frontend: {
      main: string
    , dependencies: string[]
  }
  , backend: {
      main: string
  }
  , repository?: string
  , author?: string
  , license?: string
}