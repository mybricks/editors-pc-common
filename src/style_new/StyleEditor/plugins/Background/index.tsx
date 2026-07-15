import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ColorUtil from "color";
import { useStyleEditorContext } from "../..";
import { PanelBaseProps } from "./../../type";
import { Panel, Colorpicker } from "../../components";
import { MinusOutlined, TransparentColorOutlined } from "../../components/Icon";
import { useDragNumber } from "../../hooks";
import css from "./index.less";
import {
  BgLayer,
  generateLayerId,
  getColorOpacity,
  setColorOpacity,
  parseLayers,
  serializeLayers,
  interpretPickerChange,
} from "./layers";

function GripIcon() {
  return (
    <svg viewBox="0 0 8 12" fill="currentColor" width="8" height="12">
      <circle cx="2" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="2" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="2" cy="10" r="1" />
      <circle cx="6" cy="10" r="1" />
    </svg>
  );
}

const ALL_BACKGROUND_KEYS = [
  "backgroundColor",
  "backgroundImage",
  "backgroundRepeat",
  "backgroundPosition",
  "backgroundSize",
] as const;

interface BackgroundProps extends PanelBaseProps {
  value: CSSProperties & Record<string, any>;
  onChange: (
    value: { key: string; value: any } | { key: string; value: any }[]
  ) => void;
}

const DEFAULT_CONFIG = {
  disableBackgroundColor: false,
  disableBackgroundImage: false,
  disableGradient: false,
  useImportant: false,
};

function getSwatchStyle(layer: BgLayer): CSSProperties {
  if (layer.type === "image") {
    return {
      backgroundImage: layer.value,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (layer.type === "gradient") {
    return { backgroundImage: layer.value };
  }
  // Solid color: when partially transparent, split the swatch left=solid /
  // right=actual opacity (Figma style), so the checkered base shows through.
  const alpha = getColorOpacity(layer.value);
  if (alpha < 100) {
    try {
      const solidHex = new ColorUtil(layer.value).alpha(1).hex();
      return {
        backgroundImage: `linear-gradient(to right, ${solidHex} 50%, ${layer.value} 50%)`,
      };
    } catch {
      // fall through to plain backgroundColor
    }
  }
  return { backgroundColor: layer.value || "transparent" };
}

function getLayerLabel(layer: BgLayer): string {
  if (layer.type === "image") return "图片";
  if (layer.type === "gradient") return "渐变";
  try {
    const c = new ColorUtil(layer.value);
    const hex = c.alpha() === 1 ? c.hex() : c.hexa();
    return hex.toUpperCase();
  } catch {
    return layer.value || "纯色";
  }
}

// ── Single Layer Item ───────────────────────────────────────────────────────

interface LayerItemProps {
  layer: BgLayer;
  onLayerChange: (partial: Partial<BgLayer>) => void;
  upload?: (files: File[], args: any) => Promise<string[]>;
  disableBackgroundColor?: boolean;
  disableBackgroundImage?: boolean;
  disableGradient?: boolean;
}

function LayerItem({
  layer,
  onLayerChange,
  upload,
  disableBackgroundColor,
  disableBackgroundImage,
  disableGradient,
}: LayerItemProps) {
  const [colorPickerCtx] = useState<{ open?: () => void }>({});
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  const handlePickerChange = useCallback(
    (change: any) => {
      const partial = interpretPickerChange(change, layer);
      if (partial) onLayerChange(partial);
    },
    [layer, onLayerChange]
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const opacity = Math.max(0, Math.min(100, Number(e.target.value)));
      onLayerChange({ value: setColorOpacity(layer.value, opacity) });
    },
    [layer.value, onLayerChange]
  );

  const opacity = layer.type === "solid" ? getColorOpacity(layer.value) : 100;

  // ── Opacity drag scrubbing (reuses useDragNumber hook) ──────────────────
  const getDragProps = useDragNumber({
    min: 0,
    max: 100,
    onDragStart: () => getColorOpacity(layer.value),
    onDragChange: (value) => {
      onLayerChange({ value: setColorOpacity(layer.value, Math.round(value)) });
    },
    onDragEnd: (finalValue) => {
      onLayerChange({ value: setColorOpacity(layer.value, Math.round(finalValue)) });
    },
  });

  const imageValue = useMemo(
    () => ({
      backgroundImage: layer.value,
      backgroundSize: layer.size,
      backgroundRepeat: layer.repeat,
      backgroundPosition: layer.position,
    }),
    [layer.value, layer.size, layer.repeat, layer.position]
  );

  // ── Inline label editing (solid colors only) ─────────────────────────────

  const startEditing = useCallback(() => {
    if (layer.type !== "solid") {
      colorPickerCtx.open?.();
      return;
    }
    setEditText(getLayerLabel(layer));
    setEditing(true);
    // Focus the input after render
    setTimeout(() => {
      labelInputRef.current?.select();
    }, 0);
  }, [layer, colorPickerCtx]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const raw = editText.trim();
    if (!raw) return;
    try {
      // Preserve original opacity if the user typed a hex without alpha
      const parsed = new ColorUtil(raw);
      const currentOpacity = getColorOpacity(layer.value);
      // If user input has no alpha component (6-digit hex), keep existing opacity
      const hasAlpha = /^#[0-9a-fA-F]{8}$/.test(raw) || raw.toLowerCase().startsWith("rgba");
      const finalColor = hasAlpha
        ? parsed.hexa().toUpperCase()
        : setColorOpacity(parsed.hex().toUpperCase(), currentOpacity);
      onLayerChange({ value: finalColor });
    } catch {
      // Invalid color — revert silently
    }
  }, [editText, layer.value, onLayerChange]);

  const handleLabelKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit();
      } else if (e.key === "Escape") {
        setEditing(false);
      }
    },
    [commitEdit]
  );

  return (
    // style={{ marginLeft: 0 }} overrides Panel.Item's :not(:first-child) { margin-left: 4px }
    // which is designed for horizontal flex and would shift rows in a vertical stack
    <Panel.Item className={css.layerRow} style={{ marginLeft: 0 }} activeWhenBlur={false}>
      {/* Drag handle — visibility toggled via CSS on parent .layerItemWrapper:hover */}
      <div className={css.dragHandle} data-drag-handle>
        <GripIcon />
      </div>

      {/* Swatch + Color Picker trigger */}
      <Colorpicker
        context={colorPickerCtx}
        value={layer.value}
        onChange={handlePickerChange}
        showSubTabs={true}
        upload={upload}
        imageValue={imageValue}
        className={css.colorPickerContainer}
        disableBackgroundColor={disableBackgroundColor}
        disableBackgroundImage={disableBackgroundImage}
        disableGradient={disableGradient}
      >
        <div className={css.block} style={getSwatchStyle(layer)} />
        <div className={css.icon}>
          <TransparentColorOutlined />
        </div>
      </Colorpicker>

      {/* Label — click to edit inline (solid) or open picker (gradient/image) */}
      {editing ? (
        <input
          ref={labelInputRef}
          className={css.layerLabelInput}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleLabelKeyDown}
          spellCheck={false}
        />
      ) : (
        <div
          className={css.layerLabel}
          onClick={startEditing}
        >
          {getLayerLabel(layer)}
        </div>
      )}

      {/* Opacity */}
      <div className={css.opacity}>
        {layer.type === "solid" ? (
          <input
            type="number"
            min={0}
            max={100}
            value={Math.round(opacity)}
            onChange={handleOpacityChange}
          />
        ) : (
          <span style={{ width: 20, textAlign: "right", fontSize: 10 }}>100</span>
        )}
        {layer.type === "solid" ? (
          <div
            {...getDragProps(Math.round(opacity), "{content:'拖拽调整不透明度',position:'left'}")}
            className={css.opacityUnit}
          >
            %
          </div>
        ) : (
          <div>%</div>
        )}
      </div>
    </Panel.Item>
  );
}

// ── Main Background Plugin ──────────────────────────────────────────────────

export function Background({
  value,
  onChange,
  config,
  showTitle,
  collapse,
}: BackgroundProps) {
  const context = useStyleEditorContext();
  const [{ disableBackgroundColor, disableBackgroundImage, disableGradient }] =
    useState({ ...DEFAULT_CONFIG, ...config });

  // ── Layer state ──────────────────────────────────────────────────────────

  const [layers, setLayers] = useState<BgLayer[]>(() =>
    parseLayers(
      value?.backgroundImage as string,
      value?.backgroundColor as string,
      value?.backgroundSize as string,
      value?.backgroundRepeat as string,
      value?.backgroundPosition as string
    )
  );

  // Always-fresh ref — avoids stale closures in handlers (Colorpicker's inner
  // Sketch picker may retain an old onChange callback across re-renders)
  const layersRef = useRef<BgLayer[]>(layers);
  layersRef.current = layers;

  // Guard: skip re-parsing when the value change came from our own emit.
  // Initialize with the current backgroundImage so the guard passes on fresh
  // mount (prevents redundant re-parse when the component first renders).
  const lastEmittedRef = useRef((value?.backgroundImage as string) ?? "");

  useEffect(() => {
    const bgImage = (value?.backgroundImage as string) ?? "";
    const bgColor = (value?.backgroundColor as string) ?? "";
    if (bgImage === lastEmittedRef.current) return;
    lastEmittedRef.current = bgImage;
    setLayers(
      parseLayers(
        bgImage,
        bgColor,
        (value?.backgroundSize as string) ?? "",
        (value?.backgroundRepeat as string) ?? "",
        (value?.backgroundPosition as string) ?? ""
      )
    );
  }, [
    value?.backgroundImage,
    value?.backgroundColor,
    value?.backgroundSize,
    value?.backgroundRepeat,
    value?.backgroundPosition,
  ]);

  // ── Emit helper ──────────────────────────────────────────────────────────

  const emitLayers = useCallback(
    (newLayers: BgLayer[]) => {
      const changes = serializeLayers(newLayers);
      const bgImage = changes.find((c) => c.key === "backgroundImage")?.value ?? "";
      lastEmittedRef.current = bgImage;
      setLayers(newLayers);
      (onChange as any)(changes);
    },
    [onChange]
  );

  // ── Layer handlers ───────────────────────────────────────────────────────
  // All handlers read from layersRef.current (not closed-over state) to avoid
  // stale-closure bugs when the Colorpicker's inner Sketch picker retains an
  // old onChange reference across re-renders.

  const handleLayerChange = useCallback(
    (index: number, partial: Partial<BgLayer>) => {
      emitLayers(layersRef.current.map((l, i) => (i === index ? { ...l, ...partial } : l)));
    },
    [emitLayers]
  );

  const handleLayerRemove = useCallback(
    (index: number) => {
      emitLayers(layersRef.current.filter((_, i) => i !== index));
    },
    [emitLayers]
  );

  const handleAddLayer = useCallback(() => {
    const newLayer: BgLayer = {
      id: generateLayerId(),
      type: "solid",
      value: "#00000033", // black at ~20% — avoids fully opaque default that hides layers below
      visible: true,
      size: "",
      repeat: "",
      position: "",
    };
    emitLayers([newLayer, ...layersRef.current]);
  }, [emitLayers]);

  const handleReset = useCallback(() => {
    lastEmittedRef.current = "none";
    setLayers([]);
    (onChange as any)(ALL_BACKGROUND_KEYS.map((key) => ({ key, value: null })));
  }, [onChange]);

  // ── Drag-to-reorder ──────────────────────────────────────────────────────

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overState, setOverState] = useState<{ index: number; half: "top" | "bottom" } | null>(null);

  // mousedown 时 e.target 才是真实的鼠标按下元素（input/textarea 等）；
  // 而 dragstart 的 e.target 始终是带 draggable 的 wrapper div，无法直接判断来源。
  // 用 ref 在 mousedown 阶段记录是否应阻止拖拽，避免不必要的 re-render。
  const dragBlockedRef = useRef(false);

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (dragBlockedRef.current) {
      e.preventDefault();
      dragBlockedRef.current = false;
      return;
    }
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
    setOverState({ index, half });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
      e.preventDefault();
      if (dragIndex === null) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const half = e.clientY < rect.top + rect.height / 2 ? "top" : "bottom";

      let insertAt = half === "top" ? targetIndex : targetIndex + 1;
      if (dragIndex < insertAt) insertAt -= 1;

      setDragIndex(null);
      setOverState(null);

      if (dragIndex === insertAt) return;

      const newLayers = [...layersRef.current];
      const [removed] = newLayers.splice(dragIndex, 1);
      newLayers.splice(insertAt, 0, removed);
      emitLayers(newLayers);
    },
    [dragIndex, emitLayers]
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverState(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  // 没有背景图层时默认折叠
  const effectiveCollapse = layers.length === 0 ? true : collapse;

  return (
    <Panel
      title="背景"
      showTitle={showTitle}
      collapse={effectiveCollapse}
      onAdd={handleAddLayer}
      showDelete={false}
      rightColumn={
        layers.length > 0 ? (
          <div className={css.deleteColumn}>
            {layers.map((layer, index) => (
              <div
                key={layer.id}
                className={css.deleteBtn}
                onClick={() => handleLayerRemove(index)}
              >
                <MinusOutlined />
              </div>
            ))}
          </div>
        ) : <></>
      }
    >
      {layers.length > 0 && (
        <div
          className={css.layerList}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setOverState(null);
            }
          }}
        >
          {layers.map((layer, index) => (
            <div
              key={layer.id}
              className={`${css.layerItemWrapper}${dragIndex === index ? ` ${css.layerDragging}` : ""}`}
              draggable
              onMouseDown={(e) => {
                // 只有从拖拽 handle 按下才允许拖拽，其他区域（label、input、swatch 等）一律阻止
                dragBlockedRef.current = !(e.target as HTMLElement).closest("[data-drag-handle]");
              }}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {overState?.index === index && overState.half === "top" && dragIndex !== index && (
                <div className={css.dropIndicator} />
              )}
              <LayerItem
                layer={layer}
                onLayerChange={(partial) => handleLayerChange(index, partial)}
                upload={context?.editConfig?.upload as any}
                disableBackgroundColor={disableBackgroundColor}
                disableBackgroundImage={disableBackgroundImage}
                disableGradient={disableGradient}
              />
              {overState?.index === index && overState.half === "bottom" && dragIndex !== index && (
                <div className={css.dropIndicator} />
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
