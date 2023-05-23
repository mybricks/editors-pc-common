export type ConAry = Array<{from: string, to: string}> | undefined

export interface EditorProps {
  editConfig: {
    value: {
      get: () => {
        auto: boolean,
        conAry: ConAry
      } | undefined
      set: (value: {
        title?: string
        auto: boolean
        script?: string
        conAry?: ConAry
      }) => void
    }
    options: {
      from: Schema
      to: Schema
    }
    popView: (title: string, fn: ({close}: {close: () => void}) => JSX.Element, options: {width: number, beforeEditView: boolean}) => void
  }
}

interface Properties {
  [key: string]: Schema
}

type EnumItems = Array<{type: 'string', value: string} | {type: 'number', value: number}>

export type Schema = {type: 'unknown'}
  | {type: 'follow'}
  | {type: 'any'}
  | {type: 'number'}
  | {type: 'string'}
  | {type: 'boolean'}
  | {type: 'object', properties?: Properties}
  | {type: 'array', items?: Schema}
  | {type: 'indexObject', properties: {key: Schema, value: Schema}}
  | {type: 'tuple', items: Array<Schema>}
  | {type: 'enum', items: EnumItems}

export type SchemaType = Schema['type']

export interface TypeChangeProps {
  conAry: ConAry
  toSchema: Schema
  fromSchema: Schema
  onComplete: (value?: undefined | {title: string, script: string, conAry: ConAry}) => void
}

export type Mover = {
  x: number
  y: number
  title: string
  schema: Schema
  xpath: string
} | undefined

export type FocusCon = {
  id: string
  fromXpath: string
  toXpath: string
  position: { 
    x: number
    y: number
  }
} | undefined

// export interface ContentContextAsType {
//   contentRef: React.RefObject<HTMLDivElement>
//   scrollRef: React.RefObject<HTMLDivElement>
//   fromRef: React.RefObject<HTMLDivElement>
//   toRef: React.RefObject<HTMLDivElement>
//   consRef: React.RefObject<HTMLDivElement>

//   readonly mover: Mover

//   setMover: React.Dispatch<React.SetStateAction<Mover>>

//   readonly conAry: ConAry

//   setConAry: React.Dispatch<React.SetStateAction<ConAry>>

//   readonly hoverFromXpath: string | undefined

//   setHoverFromXpath: React.Dispatch<React.SetStateAction<ContentContextAsType['hoverFromXpath']>>  

//   finishMover: () => void

//   readonly focusCon: FocusCon
  
//   setFocusCon: React.Dispatch<React.SetStateAction<FocusCon>>

//   delFocusCon: () => void

//   blur: () => void
// }

export interface MoverContextAsType {
  mover: Mover
  setMover: React.Dispatch<React.SetStateAction<Mover>>
  finishMover: () => void
}

export interface RefContextAsType {
  toRef: React.RefObject<HTMLDivElement>
  fromRef: React.RefObject<HTMLDivElement>
  scrollRef: React.RefObject<HTMLDivElement>
  contentRef: React.RefObject<HTMLDivElement>
}

export interface HoverFromXpathContextAsType {
  hoverFromXpath: string | undefined
  setHoverFromXpath: React.Dispatch<React.SetStateAction<string | undefined>>
}

export interface FocusConContextAsType {
  focusCon: FocusCon
  setFocusCon: React.Dispatch<React.SetStateAction<FocusCon>>
  delFocusCon: () => void
}

export interface ConAryContextAsType {
  conAry: ConAry
  setConAry: React.Dispatch<React.SetStateAction<ConAry>>
}

export interface FromRenderProps {
  schema: Schema
}

export interface ProItemProps {
  val: Schema
  xpath: string
  root?: boolean
  keyName?: string
}

export interface ProAryProps {
  xpath: string
  items?: Schema
}

export interface ToRenderProps {
  schema: Schema
}

export interface ProObjProps {
  xpath: string
  properties?: Properties
}

export interface ProIndexObjProps {
  xpath: string
  properties: {key: Schema, value: Schema}
}

export interface ProEnumProps {
  items: EnumItems
}

export interface ConProps {
  toXpath: string
  fromXpath: string
}
