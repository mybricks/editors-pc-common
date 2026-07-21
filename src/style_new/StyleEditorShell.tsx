import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button, message, Tooltip } from 'antd'
import {
  AppstoreOutlined,
  CaretRightOutlined,
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons'

import { copyText } from '../utils'
import { getDefaultConfiguration, getDefaultConfiguration2 } from './core/get-default-configuration'
import type { SuggestOptionsCache } from './core/get-default-configuration'
import { CssEditor } from './CssEditor'
import { useUpdateEffect } from './StyleEditor/hooks'
import { StyleMount } from './StyleMount'
import type { EditorProps } from './type'
import { useAffectedCount } from './hooks/useAffectedCount'
import { useBatchMeta } from './hooks/useBatchMeta'
import { useZoneSelectors } from './hooks/useZoneSelectors'
import { goBackIcon } from './icon'
import css from './index.less'

export default function StyleEditorShell({ editConfig }: EditorProps) {
  const [titleContent, setTitleContent] = useState('')
  const [targetStyle, setTargetStyle] = useState<any>(null)

  const [{ finalOpen, finalDisabledSwitch, finalSelector }, canvasEle] = useMemo(() => {
    return [
      getDefaultConfiguration2(editConfig),
      // @ts-ignore
      editConfig.canvasEle,
    ]
  }, [])

  const [{ open, show, editMode }, setStatus] = useState({
    open: finalOpen,
    show: finalOpen,
    editMode: true,
  })

  const [key, setKey] = useState(0)
  const isResetRef = useRef(false)
  const suggestOptionsCacheRef = useRef<SuggestOptionsCache>(new WeakMap())

  useEffect(() => {
    suggestOptionsCacheRef.current = new WeakMap()
  }, [key])

  // 只从 editConfig 中拿 targetDom，用于 hover 标记效果
  const targetDom = useMemo(() => {
    if (!editConfig.options || Array.isArray(editConfig.options)) return null
    return (editConfig.options as any).targetDom ?? null
  }, [editConfig])

  const { batchMeta, refreshBatchMeta, onBatchDiscard, onBatchCommit } = useBatchMeta(editConfig)
  const { zoneSelectorList, activeZoneIdx, setActiveZoneIdx } = useZoneSelectors(
    editConfig,
    targetDom,
    open
  )
  const affectedCount = useAffectedCount(activeZoneIdx, zoneSelectorList, finalSelector)

  const refresh = useCallback(() => {
    editConfig.value.set({})
    isResetRef.current = true
    setKey((key) => key + 1)
  }, [])

  const copy = useCallback(() => {
    if (finalSelector) {
      if (typeof finalSelector === 'string') {
        copyText(
          JSON.stringify({
            [finalSelector]: {},
          })
        )
      } else {
        copyText(
          JSON.stringify(
            (finalSelector as string[]).reduce((p, c) => {
              p[c] = {}
              return p
            }, {} as any)
          )
        )
      }
      message.success('复制成功')
    }
  }, [])

  function onOpenClick() {
    if (!finalDisabledSwitch) {
      setStatus((status) => {
        return {
          ...status,
          show: true,
          open: !status.open,
        }
      })
    }
  }

  function onEditModeClick() {
    setStatus((status) => {
      return {
        show: true,
        open: true,
        editMode: !status.editMode,
      }
    })
  }

  useUpdateEffect(() => {
    setKey((key) => key + 1)
  }, [editConfig.ifRefresh?.()])

  useEffect(() => {
    refreshBatchMeta()
  }, [refreshBatchMeta, key, activeZoneIdx, editMode])

  const title = useMemo(() => {
    return (
      <>
        {/* 可视化编辑态的工具条 */}
        {editMode && (
          <div className={css.titleContainer}>
            <div className={css.title} onClick={onOpenClick}>
              <div>{editConfig.title}</div>
            </div>
            <div className={css.actions_allawys_display}>
              <div className={css.icon} data-mybricks-tip={'CSS编辑'} onClick={onEditModeClick}>
                {editMode ? <CodeOutlined /> : <AppstoreOutlined />}
              </div>
              <div className={css.selector} data-mybricks-tip={finalSelector} onClick={copy}>
                {finalSelector}
              </div>
            </div>
          </div>
        )}
        {/* 代码编辑的工具条 */}
        {!editMode && (
          <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={css.titleContainer}
          >
            <div className={css.title} style={{ fontWeight: 'normal' }} onClick={onOpenClick}>
              {finalDisabledSwitch ? null : (
                <div
                  className={`${css.icon}${open ? ` ${css.iconOpen}` : ''}`}
                  data-mybricks-tip={open ? '收起' : '展开'}
                >
                  <CaretRightOutlined />
                </div>
              )}
              <div>{editConfig.title}</div>
            </div>
            <div className={css.actions_allawys_display}>
            <div
                className={css.icon}
                data-mybricks-tip={`{content:'返回可视化编辑',position:'left'}`}
                onClick={onEditModeClick}
              >
                {goBackIcon}
              </div>
              <div className={css.selector} data-mybricks-tip={finalSelector} onClick={copy}>
                {finalSelector}
              </div>
              {/* <div className={css.icon} data-mybricks-tip={'复制selector'} onClick={copy}>
                <CopyOutlined />
              </div> */}
              {/* <div className={css.icon} data-mybricks-tip={'重置'} onClick={refresh}>
                <ReloadOutlined />
              </div> */}

            </div>
          </div>
        )}
      </>
    )
  }, [open, editMode, titleContent, batchMeta, onBatchDiscard, onBatchCommit])

  const editor = useMemo(() => {
    const resolvedEditConfig = (() => {
      const originalOptions = editConfig.options
      if (zoneSelectorList.length < 1 || !originalOptions || Array.isArray(originalOptions)) {
        return editConfig
      }
      return {
        ...editConfig,
        options: { ...originalOptions, selector: zoneSelectorList[activeZoneIdx] },
      }
    })()
    const config = getDefaultConfiguration(resolvedEditConfig, suggestOptionsCacheRef.current)
    const activeSelector =
      zoneSelectorList[activeZoneIdx] ||
      (!Array.isArray(resolvedEditConfig.options) && resolvedEditConfig.options
        ? (resolvedEditConfig.options as any).selector
        : undefined) ||
      finalSelector

    if (editMode) {
      const { targetDom: _td, ...activeStyleProps } = config
      if (isResetRef.current) {
        isResetRef.current = false
        const allOptionKeys = (config.options || []).map((t: any) =>
          typeof t === 'string' ? t.toLowerCase() : t?.type?.toLowerCase()
        )
        activeStyleProps.collapsedOptions = allOptionKeys
      }
      return (
        <StyleMount
          editConfig={resolvedEditConfig}
          onBatchMetaChange={refreshBatchMeta}
          {...activeStyleProps}
        />
      )
    }

    return (
      <CssEditor
        popView={(editConfig as any).popView}
        getDefaultOptions={editConfig.getDefaultOptions}
        editConfig={resolvedEditConfig}
        selector={activeSelector}
        initialStyle={config.defaultValue}
        // 代码编辑删除某行时需能落到 deletions；不沿用可视化折叠快照
        collapsedOptions={[]}
        onBatchMetaChange={refreshBatchMeta}
      />
    )
  }, [editMode, key, activeZoneIdx, refreshBatchMeta, zoneSelectorList, finalSelector])

  function onMouseEnter() {
    try {
      if (canvasEle && targetDom.length) {
        setTitleContent('(已标记)')
        const res: any = Array.from(targetDom).reduce(
          (res: any, dom: any) => {
            const rect = dom.getBoundingClientRect()
            if (res.left > rect.left) {
              res.left = rect.left
            }
            if (res.top > rect.top) {
              res.top = rect.top
            }
            const width = rect.left + rect.width
            if (res.width < width) {
              res.width = width
            }
            const height = rect.top + rect.height
            if (res.height < height) {
              res.height = height
            }

            return res
          },
          {
            left: Infinity,
            top: Infinity,
            width: -Infinity,
            height: -Infinity,
          }
        )
        const width = res.width - res.left
        const height = res.height - res.top
        const cRect = canvasEle.getBoundingClientRect()
        setTargetStyle({
          canvas: {
            left: res.left - cRect.left,
            top: res.top - cRect.top,
            width,
            height,
          },
          tips: {
            left: res.left - cRect.left,
            top: res.top - cRect.top + 8,
          },
        })
      } else {
        setTitleContent('(非dom节点)')
      }
    } catch {}
  }

  function onMouseLeave() {
    try {
      if (canvasEle && targetDom.length) {
        setTargetStyle(null)
      }
      setTitleContent('')
    } catch {}
  }

  const zoneTabBar = useMemo(() => {
    if (zoneSelectorList.length < 2) return null
    return (
      <div className={css.zoneTabBar}>
        {zoneSelectorList.map((sel, idx) => {
          const parts = sel.trim().split(/\s+/)
          const lastPart = parts[parts.length - 1]
          // 含伪类的选择器只显示伪类部分（如 ":hover"），基础态选择器保持原逻辑
          const pseudoMatch = lastPart.match(/(:{1,2}[a-zA-Z\-]+(?:\([^)]*\))?)$/)
          const rawLabel = lastPart.replace(/^\./, '')
          let label: string
          if (pseudoMatch) {
            label = pseudoMatch[1]
          } else {
            // 若复合类中含有 CSS Modules 哈希类名（形如 "pages_xxx--cyan"），
            // 只显示哈希类名中 '--' 之后的原始部分（如 "cyan"），避免超长显示
            const classes = rawLabel.split('.')
            const hashedClasses = classes.filter((cls) => cls.includes('--'))
            label =
              hashedClasses.length > 0
                ? hashedClasses.map((cls) => cls.slice(cls.lastIndexOf('--') + 2)).join('.')
                : rawLabel
          }
          return (
            <div
              key={sel}
              className={`${css.zoneTab}${idx === activeZoneIdx ? ` ${css.zoneTabActive}` : ''}`}
              onClick={() => {
                setActiveZoneIdx(idx)
              }}
            >
              {label}
            </div>
          )
        })}
      </div>
    )
  }, [zoneSelectorList, activeZoneIdx])

  return {
    render: (
      <>
        {batchMeta.enabled && (
          <div className={css.batchActionStickyWrap}>
            <div className={css.batchActionBar}>
              <div className={css.batchMetaInfo}>{batchMeta.dirtyCount} 处变更</div>
              <div className={css.batchActions}>
                <Button
                  size="small"
                  type="default"
                  shape="circle"
                  className={css.batchIconBtn}
                  data-tip="全部丢弃"
                  data-mybricks-tip="全部丢弃"
                  disabled={batchMeta.submitting || batchMeta.dirtyCount === 0}
                  onClick={onBatchDiscard}
                  aria-label="清空暂存"
                >
                  <CloseOutlined />
                </Button>
                <Button
                  size="small"
                  type="default"
                  shape="circle"
                  className={`${css.batchIconBtn} ${css.batchConfirmBtn}`}
                  data-tip="交给AI应用"
                  data-mybricks-tip={`{content:'交给AI应用',position:'left'}`}
                  loading={batchMeta.submitting}
                  disabled={batchMeta.dirtyCount === 0}
                  onClick={onBatchCommit}
                  aria-label="提交给AI修改"
                >
                  {!batchMeta.submitting && <CheckOutlined />}
                </Button>
              </div>
            </div>
          </div>
        )}
        {zoneSelectorList.length > 0 && zoneTabBar}
        {zoneSelectorList.length > 0 && affectedCount !== null && affectedCount > 1 && (
          <div
            className={css.affectedHint}
            style={{ marginTop: zoneSelectorList.length > 1 ? '10px' : '0' }}
          >
            修改当前样式会影响 {affectedCount} 个区域
          </div>
        )}
        <div className={css.styleSection}>
          {title}
          <div key={`${key}_${activeZoneIdx}`} style={{ display: open ? 'block' : 'none' }}>
            {show && editor}
          </div>
        </div>
        {canvasEle &&
          targetStyle &&
          createPortal(
            <>
              <div className={css.popupTips} style={targetStyle.canvas}></div>
              <Tooltip
                placement="topLeft"
                title={editConfig.title || '当前dom区域'}
                visible={true}
                overlayInnerStyle={{
                  color: '#555',
                  fontSize: 12,
                  minWidth: 50,
                  textAlign: 'center',
                  boxShadow: '0px 1px 4px 2px rgba(39, 54, 78, 0.37)',
                  borderRadius: 4,
                }}
                color="#fff"
                transitionName=""
              >
                <div className={css.popupTips} style={targetStyle.tips}></div>
              </Tooltip>
            </>,
            canvasEle
          )}
      </>
    ),
  }
}
