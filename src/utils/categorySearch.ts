export interface SearchableCategory {
  id: string
  kategori_adi?: string | null
  ust_kategori_id?: string | null
}

export function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0131/g, 'i')
    .trim()
}

export function getMatchingCategoryIds(categories: SearchableCategory[], searchText: string) {
  const normalizedSearch = normalizeSearchText(searchText)
  if (!normalizedSearch) return []

  const childrenByParent = new Map<string, string[]>()
  for (const category of categories) {
    if (!category.ust_kategori_id) continue
    const children = childrenByParent.get(category.ust_kategori_id) || []
    children.push(category.id)
    childrenByParent.set(category.ust_kategori_id, children)
  }

  const result = new Set<string>()
  const visit = (categoryId: string) => {
    if (result.has(categoryId)) return
    result.add(categoryId)
    for (const childId of childrenByParent.get(categoryId) || []) {
      visit(childId)
    }
  }

  for (const category of categories) {
    if (normalizeSearchText(category.kategori_adi || '').includes(normalizedSearch)) {
      visit(category.id)
    }
  }

  return [...result]
}

export function sanitizePostgrestSearchTerm(value: string) {
  return value.replace(/[,%()]/g, ' ').trim()
}
