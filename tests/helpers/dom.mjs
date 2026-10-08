// Controlled DOM bindings only. This is not browser or layout acceptance.
export function domFixture() {
  const listeners=new Map();
  const doc={activeElement:null,addEventListener(type,handler){const set=listeners.get(type)||new Set();set.add(handler);listeners.set(type,set);},removeEventListener(type,handler){listeners.get(type)?.delete(handler);}};
  const dispatch=(type,event)=>{for(const handler of [...(listeners.get(type)||[])])handler(event);};
  class Element {
    constructor(tag,className='',text=''){this.tagName=tag.toUpperCase();this.className=className;this.children=[];this.attributes=new Map();this.dataset={};this.listeners=new Map();this.ownerDocument=doc;this.parentElement=null;this.text=String(text);this.hidden=false;this._disabled=false;this._value='';this.tabIndex=['BUTTON','INPUT','SELECT','TEXTAREA','A','SUMMARY'].includes(this.tagName)?0:-1;this.classList={add:cls=>{this.className+=' '+cls;},remove:cls=>{this.className=this.className.split(' ').filter(item=>item!==cls).join(' ');},toggle:(cls,on)=>on?this.classList.add(cls):this.classList.remove(cls)};}
    get firstChild(){return this.children[0]||null;}
    get isConnected(){return this===doc.body || Boolean(this.parentElement?.isConnected);}
    get textContent(){return this.text+this.children.map(node=>node.textContent).join(' ');}
    set textContent(value){this.replaceChildren();this.text=String(value);}
    get disabled(){return this._disabled;}
    set disabled(value){this._disabled=value;if(value && doc.activeElement===this)doc.activeElement=doc.body;}
    get value(){if(this.tagName==='SELECT')return this._value||this.children[0]?.value||'';return this._value;}
    set value(value){this._value=String(value);}
    append(...nodes){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const child of this.children)child.parentElement=null;this.children=[];this.text='';this._value='';this.append(...nodes);}
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);this.parentElement=null;}
    setAttribute(key,value){this.attributes.set(key,String(value));if(key==='tabindex')this.tabIndex=Number(value);}
    getAttribute(key){return this.attributes.get(key)??null;}
    removeAttribute(key){this.attributes.delete(key);}
    contains(target){return target===this || this.children.some(child=>child.contains(target));}
    focus(){if(this.disabled)return;doc.activeElement=this;dispatch('focusin',{target:this});}
    closest(selector){let node=this;while(node){if(selector==='[hidden]' && node.hidden || selector==='[aria-hidden="true"]' && node.getAttribute('aria-hidden')==='true')return node;node=node.parentElement;}return null;}
    matches(selector){
      if(selector.includes('button:not([disabled])'))return this.tabIndex>=0 && !this.disabled && ['BUTTON','INPUT','SELECT','TEXTAREA','A','SUMMARY'].includes(this.tagName);
      if(selector.startsWith('.'))return this.className.split(' ').includes(selector.slice(1));
      const action=selector.match(/^\[data-feature-action="(.+)"\]$/);if(action)return this.dataset.featureAction===action[1];
      if(selector==='input[type="search"]')return this.tagName==='INPUT' && this.type==='search';
      return this.tagName.toLowerCase()===selector;
    }
    querySelectorAll(selector){const found=[];for(const child of this.children){if(child.matches(selector))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(type,handler){const set=this.listeners.get(type)||new Set();set.add(handler);this.listeners.set(type,set);}
    removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
    async emit(type,values={}){if(type==='click' && this.disabled)return;const event={target:this,preventDefault(){},stopPropagation(){},...values};for(const handler of [...(this.listeners.get(type)||[])])await handler(event);}
    click(){return this.emit('click');}
    scrollIntoView(){}
  }
  const create=(tag,cls,text)=>new Element(tag,cls,text);doc.body=create('body');doc.activeElement=doc.body;doc.querySelector=selector=>doc.body.querySelector(selector);
  const prior={document:globalThis.document,window:globalThis.window};globalThis.document=doc;globalThis.window={addEventListener(){}};
  return {doc,create,dispatch,restore(){globalThis.document=prior.document;globalThis.window=prior.window;}};
}
