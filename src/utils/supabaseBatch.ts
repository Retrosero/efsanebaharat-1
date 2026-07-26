const DEFAULT_BATCH_SIZE = 100

type BatchQueryResult<T> = {
  data: T[] | null
  error?: unknown
}

export async function fetchInBatches<T>(
  ids: Array<string | null | undefined>,
  queryFactory: (batchIds: string[]) => PromiseLike<BatchQueryResult<T>>,
  batchSize = DEFAULT_BATCH_SIZE
): Promise<{ data: T[]; error: unknown | null }> {
  const uniqueIds = [...new Set(ids.filter((id): id is string => Boolean(id)))]

  if (uniqueIds.length === 0) {
    return { data: [], error: null }
  }

  const data: T[] = []

  for (let start = 0; start < uniqueIds.length; start += batchSize) {
    const batchIds = uniqueIds.slice(start, start + batchSize)
    const result = await queryFactory(batchIds)

    if (result.error) {
      return { data, error: result.error }
    }

    if (result.data) {
      data.push(...result.data)
    }
  }

  return { data, error: null }
}
