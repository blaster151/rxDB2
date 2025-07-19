export function match<T>(doc: T, filter: Partial<T>): boolean {
  return Object.entries(filter).every(([key, value]) => {
    const docVal = doc[key as keyof T]
    if (Array.isArray(value)) return Array.isArray(docVal) && value.every(v => docVal.includes(v))
    return docVal === value
  })
}

export function filterDocs<T>(docs: T[], filter: Partial<T>): T[] {
  return docs.filter(doc => match(doc, filter))
} 