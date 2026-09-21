declare module 'franc-min' {
  function francMin(text: string, options?: { minLength?: number; whitelist?: string[]; blacklist?: string[] }): string;
  export default francMin;
}
