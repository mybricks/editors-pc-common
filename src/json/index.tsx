import Code from '../code'

export default function json(props) {
  const {editConfig} = props
  
  if (!editConfig.description) {
    editConfig.description = `请输入合法的JSON格式，例如：{"id":"mybricks"} 或 "mybricks"`
  }
  
  if (!editConfig.options) {
    editConfig.options = {
      title: 'JSON数据输入',
      language: 'json',
      height: 100,
      encodeValue: false,
      minimap: {enabled: false}
    }
  }
  
  const newEditConfig = Object.assign({}, editConfig, {
    type: 'code',
    value: {
      get(...args) {
        const val = editConfig.value.get(...args)
        return JSON.stringify(val, null, 2)
      },
      set(val) {
        let factVal = val
        try {
          factVal = JSON.parse(val)
        } catch (e) {
          console.error(e)
        }
        
        return editConfig.value.set(factVal)
      }
    }
  })
  
  props.editConfig = newEditConfig
  
  return Code(props)
}