import {EditorProps} from "./interface";
import EditorCharacter from "./character";
import EditorSelect from "./select";
import EditorColorPicker from "./colorPicker";
import EditorList from "./list";
import EditorInputNumber from "./inputNumber";
import EditorSwitch from "./switch";
import EditorTextInput from "./textInput";
import EditorIconRadio from "./iconRadio";
import EditorImageSelector from "./imageSelector";
import EditorImageShowType from "./imageShowType";
import EditorTextArea from "./textArea";
import EditorAlign from "./align";
import EditorBetween from "./between";
import EditorIcon from "./icon";
import EditorRadio from "./radio";
import EditorMap from "./map";
import EditorRichText from "./richText";
import EditorDragList from "./draglist";
import EditorSlider from "./slider";
import EditorArray from "./array";
import expressionCodeEditor from "./expressionCode";
import EditorArrayCheckbox from "./arrayCheckbox";
import EditorMapCheckbox from "./mapCheckbox";
import {typeCheck} from "./utils";
import EditorRender from "./editorRender";
import EditorValueSelect from "./valueSelect";
import Expression from "./_expression";
import ComSelector from "./comSelector";
import EditorLayout from "./layout";
import EditorStyle from "./style";
import EditorStyleC from "./style_c";
import EditorTypeChange from "./_typeChange";
import EditorI18nInput from "./i18nInput";
import EditorSceneSelector from "./sceneSelector";
import EditorSceneComSelector from "./sceneComSelector";
import Code from "./code";
import EditorJSON from "./json";
import Tree from "./tree";
import EditorLine from "./line";
import "./index.less";
import StyleNew from "./style_new";
import CssEditor from "./css-editor";
import json from "@/json";

export {config} from "./configProvider";

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

export {PcEditor, PcEditorMap};
