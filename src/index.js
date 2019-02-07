// @ts-check

/**
 * Store with cache property.
 * @typedef {{ dispatch: import('vuex').Dispatch }} Store
 */

/**
 * Check if value is a Store.
 * @param {any} value
 * @returns {value is Store}
 */
const isVuexStore = value => value && typeof value.dispatch === 'function'

/**
 * Convert value to `string`.
 * @param {any} value
 * @returns {string}
 */
const toString = value => typeof value === 'string' ? value : JSON.stringify(value)

/**
 * Dispatch parameters.
 * @typedef {[string, any, { timeout?: number }] | [{ type: string, timeout?: number }]} DispatchParams
 */

/**
 * Convert Dispatch parameters to key (`string`).
 * @param {DispatchParams} params
 * @returns {string}
 */
const toKey = params => {
  const type = toString(params[0])
  return params[1] ? type + ':' + toString(params[1]) : type
}

/**
 * Check if timeout property is defined on value.
 * @param {any} value
 * @returns {boolean}
 */
const isTimeoutDefined = (value) => value && 'timeout' in value

/**
 * Resolve timeout option from Dispatch parameters and Options.
 * @param {DispatchParams} params
 * @param {object} options
 * @returns {number}
 */
const resolveTimeout = (params, options) => {
  if (params.length === 1 && isTimeoutDefined(params[0])) {
    return params[0].timeout
  }
  if (params.length === 3 && isTimeoutDefined(params[2])) {
    return params[2].timeout
  }
  if (isTimeoutDefined(options)) {
    return options.timeout
  }
  return 0
}

/**
 * Install cache on Store.
 * @param {Store} store
 * @param {object} [options]
 */
const setupCache = (store, options = {}) => {
  /**
   * Cache instance.
   * @type {Map<string, { value: Promise<any>, expiresIn?: number }>}
   */
  const cache = new Map()

  store.cache = {
    /**
     * Dispatch an action an save it on cache.
     * @type {(...params: DispatchParams) => Promise<void>}
     */
    dispatch: (...params) => {
      const key = toKey(params)
      const timeout = resolveTimeout(params, options)

      if (cache.has(key)) {
        const { expiresIn } = cache.get(key)

        if (expiresIn && Date.now() > expiresIn) {
          cache.delete(key)
        }
      }

      if (!cache.has(key)) {
        const value = store.dispatch.apply(store, params).catch(error => {
          cache.delete(key)
          return Promise.reject(error)
        })

        cache.set(key, {
          value,
          expiresIn: timeout ? Date.now() + timeout : undefined
        })
      }

      const { value } = cache.get(key)
      return value
    },

    /**
     * Check if cache has action.
     * @type {(...params: DispatchParams) => boolean}
     */
    has: (...params) => cache.has(toKey(params)),

    /**
     * Clear cache.
     */
    clear: () => cache.clear(),

    /**
     * Delete action from cache.
     * @type {(...params: DispatchParams) => boolean}
     */
    delete: (...params) => cache.delete(toKey(params))
  }
}

/**
 * Resolve install cache.
 * @param {object | Store} storeOrOptions
 * @returns {void | ((store: Store) => void)}
 */
const resolveInstallCache = storeOrOptions => {
  if (!isVuexStore(storeOrOptions)) {
    return store => setupCache(store, storeOrOptions)
  }
  return setupCache(storeOrOptions)
}

export default resolveInstallCache

/**
 * Cache an action.
 * @param {import('vuex').Action<any, any>} action
 * @return {import('vuex').Action<any, any>}
 */
export const cacheAction = action => (context, payload) => {
  setupCache(context)
  return action(context, payload)
}
