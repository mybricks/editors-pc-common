import Expression from "./_expression";
import EditorTypeChange from "./_typeChange";
import EditorAlign from "./align";
import EditorArray from "./array";
import EditorArrayCheckbox from "./arrayCheckbox";
import EditorBetween from "./between";
import EditorCharacter from "./character";
import EditorCheckbox from "./checkbox";
import Code from "./code";
import EditorColorPicker from "./colorPicker";
import ComSelector from "./comSelector";
import CssEditor from "./css-editor";
import EditorDragList from "./draglist";
import EditorRender from "./editorRender";
import expressionCodeEditor from "./expressionCode";
import EditorI18nInput from "./i18nInput";
import EditorIcon from "./icon";
import EditorIconRadio from "./iconRadio";
import EditorImageSelector from "./imageSelector";
import EditorImageShowType from "./imageShowType";
import "./index.less";
import EditorInputNumber from "./inputNumber";
import { EditorProps } from "./interface";
import EditorJSON from "./json";
import EditorLayout from "./layout";
import EditorLine from "./line";
import EditorList from "./list";
import EditorMap from "./map";
import EditorMapCheckbox from "./mapCheckbox";
import EditorRadio from "./radio";
import EditorRichText from "./richText";
import EditorSceneComSelector from "./sceneComSelector";
import EditorSceneSelector from "./sceneSelector";
import EditorSelect from "./select";
import EditorSlider from "./slider";
import EditorStyle from "./style";
import EditorStyleC from "./style_c";
import StyleNew from "./style_new";
import EditorSwitch from "./switch";
import EditorTextArea from "./textArea";
import EditorTextInput from "./textInput";
import Tree from "./tree";
import { typeCheck } from "./utils";
import EditorValueSelect from "./valueSelect";

export { config } from "./configProvider";

const PcEditorMap: any = {
  ALIGN: EditorAlign,
  BETWEEN: EditorBetween,
  EXPCODE: expressionCodeEditor,
  MAP: EditorMap,
  LIST: EditorList,
  ARRAY: EditorArray,
  CODE: Code,
  JSON: EditorJSON,
  RADIO: EditorRadio,
  CHECKBOX: EditorCheckbox,
  COLORPICKER: EditorColorPicker,
  SELECT: EditorSelect,
  SWITCH: EditorSwitch,
  TEXTAREA: EditorTextArea,
  TEXTINPUT: EditorTextInput,
  RICHTEXT: EditorRichText,
  DRAGLIST: EditorDragList,
  CHARACTER: EditorCharacter,
  ICONRADIO: EditorIconRadio,
  ICON: EditorIcon,
  IMAGESELECTOR: EditorImageSelector,
  IMAGESHOWTYPE: EditorImageShowType,
  INPUTNUMBER: EditorInputNumber,
  SLIDER: EditorSlider,
  STYLE: EditorStyle,
  STYLEC: EditorStyleC,
  STYLENEW: StyleNew,
  //STYLE: EditorStyleProperties,
  VALUESELECT: EditorValueSelect,
  ARRAYCHECKBOX: EditorArrayCheckbox,
  MAPCHECKBOX: EditorMapCheckbox,
  EDITORRENDER: EditorRender,
  EXPRESSION: Expression,
  COMSELECTOR: ComSelector,
  LAYOUT: EditorLayout,
  _TYPECHANGE: EditorTypeChange,
  CSSEDITOR: CssEditor,
  I18NINPUT: EditorI18nInput,
  SCENESELECTOR: EditorSceneSelector,
  SCENECOMSELECTOR: EditorSceneComSelector,
  TREE: Tree,
  LINE: EditorLine,
}


// const PcEditorMap: any = {
//   STYLE: EditorStyle,
//   STYLEC: EditorStyleC,
//   STYLENEW: StyleNew,
// };


function PcEditor(props: EditorProps): any {
  const {editConfig} = props;

  // console.log(editConfig)
  // if(editConfig.type==='code'){
  //   debugger
  // }

  let editor;
  try {
    editor = PcEditorMap[editConfig.type.toUpperCase()] || editConfig.render;
  } catch (err) {
    console.error(err);
  }

  if (typeCheck(editor, "function")) {
    // const Editor = editor
    // return <Editor {...props}/>
    return editor(props)
  }

  if (typeCheck(editor, "object") && typeCheck(editor.render, "function")) {
    return editor;
  }

  return;
}

export { PcEditor, PcEditorMap };

