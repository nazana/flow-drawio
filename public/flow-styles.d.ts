export type LineStyle = {nativeStyle?:Record<string,string>;name:string;line:'solid'|'dashed'|'dotted'|'double';color:string;width:number;start:'none'|'block'|'open'|'oval';end:'none'|'block'|'open'|'oval'};
export type Styles = Record<'TC'|'EVENT'|'API',LineStyle>;
export const defaultStyles:Styles;
export function validateStyles(styles:unknown):asserts styles is Styles;
export function styleValues(style:LineStyle):Record<string,string>;
export function patchStyle(style:string,values:Record<string,string>):string;
export function followsStyle(style:string,stamp:string):boolean;
export function sampleSvg(style:LineStyle):string;
export function legendLabel(kinds:Array<keyof Styles>,styles:Styles,customCount:number,elements?:Array<{name:string;svg:string}>):string;
export type ElementDefinition = {id:string;name:string;edge:boolean;style:string;width:number;height:number};
export function validateElements(items:unknown):asserts items is ElementDefinition[];

export const nativeStyleKeys:string[];
