import React, { useState, useEffect, useMemo, FC } from 'react';
import { loadScript } from '../../utils';


class ScriptLoader {
  SortableHocCdn = './mfs/editor_assets/react-sortable/react-sortable-hoc-2.0.0_index.umd.min.js';

  scriptLoading: boolean = false;
  callbacks: Function[] = [];

  loadOnce = (callback: Function) => {
    this.callbacks.push(callback)
    if (this.scriptLoading) {
      return;
    }
    this.scriptLoading = true;
    loadScript(this.SortableHocCdn, () => {
      this.scriptLoading = false;
      this.callbacks.forEach(fn => typeof fn === 'function' && fn());
      this.callbacks = [];
    });

  }
}

const scriptLoader = new ScriptLoader();

const DefaultCom = () => <div></div>


export const useLazy = () => {
  const [loaded, setLoaded] = useState(!!(window as any)?.SortableHOC);
  useEffect(() => {
    if ((window as any)?.SortableHOC) {
      setLoaded(true);
      return;
    }
    scriptLoader.loadOnce(() => {
      setLoaded(true);
    })
  }, []);
  return loaded
}

export const SortableContainer = (comp: FC): FC<{ loaded?: boolean }> => {
  return ({ children, loaded, ...props } = {}) => {
    const Com = useMemo(() => {
      return (window as any)?.SortableHOC ? (window as any).SortableHOC.SortableContainer(comp) : comp;
    }, [comp, loaded]);
    return <Com {...props}>{children}</Com> 
  }
}

export const SortableElement = (comp: FC): FC<{ loaded?: boolean }> => {
  return ({ children, loaded, ...props } = {}) => {
    const Com = useMemo(() => {
      return (window as any)?.SortableHOC ? (window as any).SortableHOC.SortableElement(comp) : comp;
    }, [comp, loaded]);
    return <Com {...props}>{children}</Com> 
  }
}

export const SortableHandle = (comp: FC): FC<{ loaded?: boolean }> => {
  return ({ children, loaded, ...props } = {}) => {
    const Com = useMemo(() => {
      return (window as any)?.SortableHOC ? (window as any).SortableHOC.SortableHandle(comp) : comp;
    }, [comp, loaded]);
    return <Com {...props}>{children}</Com> 
  }
}