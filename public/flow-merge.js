// Apply only the sender's differences; server arrival order resolves same-field edits.
export function mergeXml(base, edited, current, Parser, Serializer) {
  const serializer = new Serializer();
  const xml = node => serializer.serializeToString(node);
  const parse = value => {
    if (typeof value !== 'string' || value.length > 16000000 || /<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error('유효한 공동편집 XML이 필요합니다.');
    const doc = new Parser().parseFromString(value, 'text/xml');
    if (!['mxfile', 'mxGraphModel'].includes(doc.documentElement?.nodeName) || doc.getElementsByTagName('parsererror').length || !doc.getElementsByTagName('mxGraphModel').length) throw new Error('공동편집 문서 형식을 확인하세요.');
    return doc;
  };
  const before = parse(base), after = parse(edited), result = parse(current);
  const children = node => Array.from(node.childNodes).filter(child => child.nodeType === 1);
  const index = node => {
    const counts = new Map(), entries = new Map();
    for (const child of children(node)) {
      const count = counts.get(child.nodeName) || 0; counts.set(child.nodeName, count + 1);
      const key = child.hasAttribute('id') ? 'id:' + child.getAttribute('id') : child.nodeName + ':' + (child.getAttribute('as') || count);
      if (entries.has(key)) throw new Error('중복된 도형 또는 페이지 ID입니다.');
      entries.set(key, child);
    }
    return entries;
  };
  function apply(old, next, target) {
    if (xml(old) === xml(next)) return;
    if (old.nodeName !== next.nodeName || target.nodeName !== old.nodeName) {
      target.parentNode.replaceChild(result.importNode(next, true), target); return;
    }
    const names = new Set([...Array.from(old.attributes), ...Array.from(next.attributes)].map(attribute => attribute.name));
    for (const name of names) {
      if (old.getAttribute(name) !== next.getAttribute(name) || old.hasAttribute(name) !== next.hasAttribute(name)) {
        if (next.hasAttribute(name)) target.setAttribute(name, next.getAttribute(name)); else target.removeAttribute(name);
      }
    }
    const previous = index(old), changed = index(next), existing = index(target);
    if (!previous.size && !changed.size) {
      if (old.textContent !== next.textContent) target.textContent = next.textContent;
      return;
    }
    for (const [key, node] of previous) {
      const destination = existing.get(key), source = changed.get(key);
      if (!source) { if (destination) target.removeChild(destination); }
      else if (destination) apply(node, source, destination);
      // A concurrent deletion wins over updates to the deleted cell.
    }
    for (const [key, node] of changed) if (!previous.has(key)) {
      if (existing.has(key)) {
        if (xml(existing.get(key)) !== xml(node)) throw new Error('새 도형 ID가 충돌했습니다. 다시 연결하세요.');
      } else target.appendChild(result.importNode(node, true));
    }
    const oldOrder = [...previous.keys()].filter(key => changed.has(key));
    const newOrder = [...changed.keys()].filter(key => previous.has(key));
    if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) {
      let prior = null; const ordered = index(target);
      for (const key of changed.keys()) {
        const node = ordered.get(key);
        if (node) { target.insertBefore(node, prior ? prior.nextSibling : target.firstChild); prior = node; }
      }
    }
  }
  apply(before.documentElement, after.documentElement, result.documentElement);
  for (const root of Array.from(result.getElementsByTagName('root'))) {
    let nodes = index(root), removed;
    if (!nodes.has('id:0')) throw new Error('문서의 루트 도형은 삭제할 수 없습니다.');
    do {
      removed = false;
      for (const [key, node] of nodes) {
        const cell = node.nodeName === 'mxCell' ? node : node.getElementsByTagName('mxCell')[0];
        if (cell?.hasAttribute('parent') && !nodes.has('id:' + cell.getAttribute('parent'))) {
          root.removeChild(node); nodes.delete(key); removed = true;
        }
      }
    } while (removed);
    for (const node of nodes.values()) {
      const cell = node.nodeName === 'mxCell' ? node : node.getElementsByTagName('mxCell')[0];
      for (const key of ['source', 'target']) if (cell?.hasAttribute(key) && !nodes.has('id:' + cell.getAttribute(key))) cell.removeAttribute(key);
      const seen = new Set(); let parent = cell?.getAttribute('parent');
      while (parent) {
        if (seen.has(parent)) throw new Error('도형의 소속 구조가 순환합니다.');
        seen.add(parent); const ancestor = nodes.get('id:' + parent);
        const parentCell = ancestor?.nodeName === 'mxCell' ? ancestor : ancestor?.getElementsByTagName('mxCell')[0];
        parent = parentCell?.getAttribute('parent');
      }
    }
  }
  const output = xml(result);
  if (output.length > 16000000) throw new Error('공동편집 문서는 최대 16MB입니다.');
  return output;
}
