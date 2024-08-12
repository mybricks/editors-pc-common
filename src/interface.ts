export type Config = {
  env: string
}

export type EditConfig = {
  type: string
  title: string
  value: {
    set: Function
    get: Function
  }
  options?: any
  render?: JSX.Element
  data?: any
  comModel?: {
    comEle: HTMLElement
    runtime: {
      def: {
        namespace: string
        version: string
      }
    }
  }
  [key: string]: any
}

interface IEnv {
  isNode: boolean,
  isElectronRenderer: boolean
}

export type EditorProps = {
  config?: Config
  editConfig: EditConfig
  apiLoader?: () => Promise<any>
  projectData?: any
  env: IEnv
}
