import React, { useState, useEffect, useMemo, FC } from "react";
import { loadScript } from "../../utils";

class ScriptLoader {
  SortableHocCdn =
    "//f2.eckwai.com/udata/pkg/eshop/fangzhou/pub/pkg/react-sortable-hoc-2.0.0/index.umd.min.js";

  scriptLoading: boolean = false;
  callbacks: Function[] = [];

  loadOnce = (callback: Function, sortableHocCDN?: string) => {
    sortableHocCDN && (this.SortableHocCdn = sortableHocCDN);
    this.callbacks.push(callback);
    if (this.scriptLoading) {
      return;
    }
    this.scriptLoading = true;
    loadScript(this.SortableHocCdn, () => {
      this.scriptLoading = false;
      this.callbacks.forEach((fn) => typeof fn === "function" && fn());
      this.callbacks = [];
    });
  };
}

const scriptLoader = new ScriptLoader();

const DefaultCom = () => <div></div>;

export const useLazy = (sortableHocCDN?: string) => {
  const [loaded, setLoaded] = useState(!!(window as any)?.SortableHOC);
  useEffect(() => {
    if ((window as any)?.SortableHOC) {
      setLoaded(true);
      return;
    }
    scriptLoader.loadOnce(() => {
      setLoaded(true);
    }, sortableHocCDN);
  }, [sortableHocCDN]);
  return loaded;
};

export type SortableType = {
  loaded?: boolean;
  children?: any;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: any) => void;
  [k: string]: any;
};
export const SortableContainer = (comp: FC<SortableType>): FC<SortableType> => {
  return ({ children, loaded, ...props } = {}) => {
    const Com = useMemo(() => {
      return (window as any)?.SortableHOC
        ? (window as any).SortableHOC.SortableContainer(comp)
        : comp;
    }, [comp, loaded]);
    return <Com {...props}>{children}</Com>;
  };
};

export const SortableElement = (comp: FC<SortableType>): FC<SortableType> => {
  return ({ children, loaded, ...props } = {}) => {
    const Com = useMemo(() => {
      return (window as any)?.SortableHOC
        ? (window as any).SortableHOC.SortableElement(comp)
        : comp;
    }, [comp, loaded]);
    return <Com {...props}>{children}</Com>;
  };
};

export const SortableHandle = (comp: FC<SortableType>): FC<SortableType> => {
  return ({ children, loaded, ...props } = {}) => {
    const Com = useMemo(() => {
      return (window as any)?.SortableHOC
        ? (window as any).SortableHOC.SortableHandle(comp)
        : comp;
    }, [comp, loaded]);
    return <Com {...props}>{children}</Com>;
  };
};
