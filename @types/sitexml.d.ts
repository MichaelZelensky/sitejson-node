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
}