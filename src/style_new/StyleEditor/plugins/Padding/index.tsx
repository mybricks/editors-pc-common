// import React, { useState, CSSProperties } from 'react'

// import {
//   Panel,
//   Input,
//   Switch,
//   PaddingTopOutlined,
//   PaddingLeftOutlined,
//   PaddingRightOutlined,
//   PaddingBottomOutlined,
//   PaddingLeftRightOutlined,
//   PaddingTopBottomOutlined,
//   PaddingControlsToggleOutlined
// } from '../../components'
// import { useInputNumber, useUpdateEffect } from '../../hooks'

// import type { ChangeEvent } from '../../type'

// import css from './index.less'

// interface PaddingProps {
//   value: CSSProperties
//   onChange: ChangeEvent
//   config: {
//     [key: string]: any
//   }
// }

// export function Padding ({value, onChange, config}: PaddingProps) {
//   const {
//     paddingTop,
//     paddingLeft,
//     paddingRight,
//     paddingBottom
//   } = value
//   const [isNotCombined, setIsNotCombined] = useState((paddingTop !== paddingBottom) || (paddingLeft !== paddingRight))

//   const [top, handleTopChange] = useInputNumber(paddingTop, (value) => {
//     if (isNotCombined) {
//       onChange({key: 'paddingTop', value: value + 'px'})
//     } else {
//       onChange([
//         {key: 'paddingTop', value: value + 'px'},
//         {key: 'paddingBottom', value: value + 'px'}
//       ])
//       handleBottomChange(value)
//     }
//   })
//   const [left, handleLeftChange] = useInputNumber(paddingLeft, (value) => {
//     if (isNotCombined) {
//       onChange({key: 'paddingLeft', value: value + 'px'})
//     } else {
//       onChange([
//         {key: 'paddingLeft', value: value + 'px'},
//         {key: 'paddingRight', value: value + 'px'}
//       ])
//       handleRightChange(value)
//     }
//   })
//   const [right, handleRightChange] = useInputNumber(paddingRight, (value) => {
//     onChange({key: 'paddingRight', value: value + 'px'})
//   })
//   const [bottom, handleBottomChange] = useInputNumber(paddingBottom, (value) => {
//     onChange({key: 'paddingBottom', value: value + 'px'})
//   })

//   useUpdateEffect(() => {
//     if (!isNotCombined) {
//       const changeAry = []
//       if (top !== bottom) {
//         changeAry.push({key: 'paddingBottom', value: top + 'px'})
//         handleBottomChange(top)
//       }
//       if (left !== right) {
//         changeAry.push({key: 'paddingRight', value: left + 'px'})
//         handleRightChange(left)
//       }
//       if (changeAry.length) {
//         onChange(changeAry)
//       }
//     }
//   }, [isNotCombined])

//   return (
//     <Panel title='内边距'>
//       <Panel.Content>
//         <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
//           <div className={css.editArea}>
//             <Input
//               prefix={!isNotCombined ? <PaddingTopBottomOutlined /> : <PaddingTopOutlined />}
//               value={top}
//               onChange={handleTopChange}
//             />
//             <Input
//               prefix={!isNotCombined ? <PaddingLeftRightOutlined /> : <PaddingLeftOutlined />}
//               value={left}
//               onChange={handleLeftChange}
//             />
//             {isNotCombined ? (
//               <>
//                 <Input
//                   prefix={<PaddingBottomOutlined />}
//                   value={bottom}
//                   onChange={handleBottomChange}
//                 />
//                 <Input
//                   prefix={<PaddingRightOutlined />}
//                   value={right}
//                   onChange={handleRightChange}
//                 />
//               </>
//             ) : <></>}
//           </div>
//         </Panel.Item>
//         <Switch
//           style={{width: 30}}
//           defaultValue={isNotCombined}
//           onChange={setIsNotCombined}
//         >
//           <PaddingControlsToggleOutlined />
//         </Switch>
//       </Panel.Content>
//     </Panel>
//   )
// }

import React, { useState, CSSProperties } from 'react'

import {
  Panel,
  Input,
  Switch,
  Select,
  PaddingTopOutlined,
  PaddingLeftOutlined,
  PaddingRightOutlined,
  PaddingBottomOutlined
} from '../../components'
import { useInputNumberObject } from '../../hooks'

import type { ChangeEvent } from '../../type'

import css from './index.less'

interface PaddingProps {
  value: CSSProperties
  onChange: ChangeEvent
  config: {
    [key: string]: any
  }
}

export function Padding ({value, onChange, config}: PaddingProps) {
  const [{
    paddingTop,
    paddingLeft,
    paddingRight,
    paddingBottom
  }, handleChange] = useInputNumberObject({
    paddingTop: value.paddingTop,
    paddingLeft: value.paddingLeft,
    paddingRight: value.paddingRight,
    paddingBottom: value.paddingBottom
  }, ({key, value}) => {
    onChange({key, value: value + 'px'})
  })

  return (
    <Panel title='内边距'>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <Input
              prefix={<PaddingTopOutlined />}
              value={paddingTop}
              onChange={(value) => handleChange({key: 'paddingTop', value})}
            />
            <Input
              prefix={<PaddingRightOutlined />}
              value={paddingRight}
              onChange={(value) => handleChange({key: 'paddingRight', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
      <Panel.Content>
        <Panel.Item style={{padding: 0, backgroundColor: 'transparent'}}>
          <div className={css.editArea}>
            <Input
              prefix={<PaddingBottomOutlined />}
              value={paddingBottom}
              onChange={(value) => handleChange({key: 'paddingBottom', value})}
            />
            <Input
              prefix={<PaddingLeftOutlined />}
              value={paddingLeft}
              onChange={(value) => handleChange({key: 'paddingLeft', value})}
            />
          </div>
        </Panel.Item>
      </Panel.Content>
    </Panel>
  )
}

