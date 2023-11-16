import EditorSelect from "./../../select"
import EditorInputNumber from "./../../inputNumber"
import EditorSwitch from "./../../switch"
import EditorTextInput from "./../../textInput"
import EditorTextArea from "./../../textArea"
import EditorRadio from "./../../radio"
import EditorSlider from "./../../slider"
import Expression from './../../_expression'
import EditorValueSelect from './../../valueSelect'
import EditorCode from './../../jsCoder'
import EditorImageSelector from "../../imageSelector";
import EditorStyle from "../../style";
import EditorIcon from "../../icon";
import EditorcolorPicker from "../../colorPicker"
import EditorI18nInput from "../../i18nInput"
import EditorEditorRender from "../../editorRender";

import { typeCheck } from "./../../utils"

const PcEditorMap: any = {
  RADIO: EditorRadio,
  SELECT: EditorSelect,
  SWITCH: EditorSwitch,
  TEXTAREA: EditorTextArea,
  TEXTINPUT: EditorTextInput,
  INPUTNUMBER: EditorInputNumber,
  SLIDER: EditorSlider,
  EXPRESSION: Expression,
  VALUESELECT: EditorValueSelect,
  CODE: EditorCode,
  IMAGESELECTOR: EditorImageSelector,
  STYLE: EditorStyle,
  ICON: EditorIcon,
  COLORPICKER: EditorcolorPicker,
  I18NINPUT: EditorI18nInput,
  EditorRender: EditorEditorRender
};

export default function PcEditor(props: any): any {
  const { editConfig } = props

  let editor
  try {
    editor = PcEditorMap[editConfig.type.toUpperCase()] || editConfig.render
  } catch (err) {
    console.error(err)
  }

  if (typeCheck(editor, "function")) {
    return editor(props)
  }

  if (typeCheck(editor, "object") && typeCheck(editor.render, "function")) {
    return editor
  }

  return
}