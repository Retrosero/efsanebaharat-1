export interface SearchableCategory {
  id: string
  kategori_adi?: string | null
  ust_kategori_id?: string | null
}

export interface SearchableBrand {
  id: string
  marka_adi?: string | null
}

export function normalizeSearchText(value: string): string {
  if (!value) return ''
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function getMatchingCategoryIds(categories: SearchableCategory[], searchText: string): string[] {
  const normSearch = normalizeSearchText(searchText)
  if (!normSearch) return []

  const searchWords = normSearch.split(/\s+/).filter(Boolean)
  if (searchWords.length === 0) return []

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
    const normName = normalizeSearchText(category.kategori_adi || '')
    if (searchWords.every((w) => normName.includes(w)) || normName.includes(normSearch)) {
      visit(category.id)
    }
  }

  return Array.from(result)
}

export function getMatchingBrandIds(brands: SearchableBrand[], searchText: string): string[] {
  const normSearch = normalizeSearchText(searchText)
  if (!normSearch) return []

  const searchWords = normSearch.split(/\s+/).filter(Boolean)
  if (searchWords.length === 0) return []

  const result: string[] = []
  for (const brand of brands) {
    const normName = normalizeSearchText(brand.marka_adi || '')
    if (searchWords.every((w) => normName.includes(w)) || normName.includes(normSearch)) {
      result.push(brand.id)
    }
  }
  return result
}

export function sanitizePostgrestSearchTerm(value: string): string {
  return value.replace(/[,%()]/g, ' ').trim()
}

export function getSearchVariations(term: string): string[] {
  const trimmed = term.trim()
  if (!trimmed) return []

  const variations = new Set<string>()
  variations.add(trimmed)

  const ascii = normalizeSearchText(trimmed)
  variations.add(ascii)

  const trVersion = ascii
    .replace(/c/g, 'ç')
    .replace(/g/g, 'ğ')
    .replace(/o/g, 'ö')
    .replace(/s/g, 'ş')
    .replace(/u/g, 'ü')
  variations.add(trVersion)

  const trDotlessI = trVersion.replace(/i/g, 'ı')
  variations.add(trDotlessI)

  return Array.from(variations).filter((v) => v.length > 0)
}

export function buildProductSearchPostgrestFilter(
  searchTerm: string,
  matchingCategoryIds: string[] = [],
  matchingBrandIds: string[] = []
): string {
  const safeSearch = sanitizePostgrestSearchTerm(searchTerm)
  if (!safeSearch) return ''

  const filters = new Set<string>()
  const variations = getSearchVariations(safeSearch)

  for (const v of variations) {
    const safeV = sanitizePostgrestSearchTerm(v)
    if (safeV) {
      filters.add(`urun_adi.ilike.%${safeV}%`)
      filters.add(`aciklama.ilike.%${safeV}%`)
    }
  }

  const words = safeSearch.split(/\s+/).filter((w) => w.length >= 2)
  if (words.length > 1) {
    for (const w of words) {
      const wordVariations = getSearchVariations(w)
      for (const wv of wordVariations) {
        const safeWv = sanitizePostgrestSearchTerm(wv)
        if (safeWv) {
          filters.add(`urun_adi.ilike.%${safeWv}%`)
        }
      }
    }
  }

  if (matchingCategoryIds.length > 0) {
    filters.add(`kategori_id.in.(${matchingCategoryIds.join(',')})`)
  }

  if (matchingBrandIds.length > 0) {
    filters.add(`marka_id.in.(${matchingBrandIds.join(',')})`)
  }

  return Array.from(filters).join(',')
}

export function scoreProductRelevance(
  product: { urun_adi: string; aciklama?: string | null },
  searchText: string
): number {
  const title = product.urun_adi || ''
  const normTitle = normalizeSearchText(title)
  const normSearch = normalizeSearchText(searchText)

  if (!normSearch) return 0
  if (normTitle === normSearch) return 100
  if (normTitle.startsWith(normSearch)) return 80
  if (title.toLowerCase().includes(searchText.toLowerCase())) return 70
  if (normTitle.includes(normSearch)) return 60

  const searchWords = normSearch.split(/\s+/).filter(Boolean)
  if (searchWords.length > 0) {
    const matchedCount = searchWords.filter((w) => normTitle.includes(w)).length
    if (matchedCount > 0) {
      return 30 + (matchedCount / searchWords.length) * 20
    }
  }

  return 10
}

