/**
 * Plugin Runner
 * Executes plugins and merges their results
 */

import type {
  Plugin,
  PluginContext,
  PluginResult,
  PluginMode,
  EntityCandidate,
  Entity,
  ThresholdConfig,
} from './types.js'

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  realtime: 0.8,
  commit: 0.5,
}

/**
 * Creates a plugin runner
 */
export function createRunner(
  plugins: Plugin[],
  thresholds: Partial<ThresholdConfig> = {}
) {
  const config: ThresholdConfig = {
    ...DEFAULT_THRESHOLDS,
    ...thresholds,
  }

  // Sort plugins by priority (lower first)
  const sortedPlugins = [...plugins].sort((a, b) => {
    const priorityA = a.priority ?? 100
    const priorityB = b.priority ?? 100
    return priorityA - priorityB
  })

  // Separate by mode
  const realtimePlugins = sortedPlugins.filter((p) => p.mode === 'realtime')
  const commitPlugins = sortedPlugins.filter((p) => p.mode === 'commit')

  /**
   * Get minimum confidence threshold for mode
   */
  function getThreshold(mode: PluginMode): number {
    return mode === 'realtime' ? config.realtime : config.commit
  }

  /**
   * Filter candidates by confidence threshold
   */
  function filterByConfidence(
    candidates: EntityCandidate[],
    mode: PluginMode
  ): EntityCandidate[] {
    const threshold = getThreshold(mode)
    return candidates.filter((c) => c.confidence >= threshold)
  }

  /**
   * Merge multiple plugin results
   */
  function mergeResults(results: PluginResult[]): PluginResult {
    const upsertMap = new Map<string, EntityCandidate>()
    const removeSet = new Set<string>()

    for (const result of results) {
      // Collect upserts (later plugins override earlier ones with same key)
      if (result.upsert) {
        for (const candidate of result.upsert) {
          upsertMap.set(candidate.key, candidate)
        }
      }

      // Collect removals
      if (result.remove) {
        for (const key of result.remove) {
          removeSet.add(key)
          // Remove from upsert if added by earlier plugin
          upsertMap.delete(key)
        }
      }
    }

    return {
      upsert: Array.from(upsertMap.values()),
      remove: Array.from(removeSet),
    }
  }

  /**
   * Run a set of plugins
   */
  async function runPlugins(
    pluginList: Plugin[],
    context: PluginContext
  ): Promise<PluginResult> {
    const results: PluginResult[] = []

    for (const plugin of pluginList) {
      try {
        const result = await plugin.run(context)
        results.push(result)
      } catch (error) {
        // Log error but continue with other plugins
        results.push({
          upsert: [],
          remove: [],
        })
        // Could emit diagnostic event here
      }
    }

    return mergeResults(results)
  }

  return {
    /**
     * Run realtime plugins
     */
    async runRealtime(context: Omit<PluginContext, 'mode'>): Promise<PluginResult> {
      const fullContext: PluginContext = { ...context, mode: 'realtime' }
      const result = await runPlugins(realtimePlugins, fullContext)

      // Filter by realtime threshold
      return {
        upsert: filterByConfidence(result.upsert ?? [], 'realtime'),
        remove: result.remove,
      }
    },

    /**
     * Run commit plugins (includes realtime plugins with lower threshold)
     */
    async runCommit(context: Omit<PluginContext, 'mode'>): Promise<PluginResult> {
      const fullContext: PluginContext = { ...context, mode: 'commit' }

      // Run both realtime and commit plugins during commit
      const allPlugins = [...realtimePlugins, ...commitPlugins]
      const result = await runPlugins(allPlugins, fullContext)

      // Filter by commit threshold (more permissive)
      return {
        upsert: filterByConfidence(result.upsert ?? [], 'commit'),
        remove: result.remove,
      }
    },

    /**
     * Get all plugin names
     */
    getPluginNames(): string[] {
      return sortedPlugins.map((p) => p.name)
    },

    /**
     * Get plugins by mode
     */
    getPluginsByMode(mode: PluginMode): Plugin[] {
      return mode === 'realtime' ? [...realtimePlugins] : [...commitPlugins]
    },

    /**
     * Get current thresholds
     */
    getThresholds(): ThresholdConfig {
      return { ...config }
    },
  }
}

export type Runner = ReturnType<typeof createRunner>
