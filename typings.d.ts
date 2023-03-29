declare module "*.less" {
  const resource: { [key: string]: string };
  export = resource;
}

declare module "*.svg" {
  const resource: React.ComponentType<CustomIconComponentProps | React.SVGProps<SVGSVGElement>> | React.ForwardRefExoticComponent<CustomIconComponentProps>;
  export = resource;
}

declare module "mp4box";

declare module "css-background-parser";

declare module "@mybricks/expression-editor"
